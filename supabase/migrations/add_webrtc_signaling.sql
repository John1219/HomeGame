-- Migration: Add WebRTC Signaling and Game State fields
-- Run this in your Supabase SQL Editor to add P2P functionality

-- Add game state fields to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_state JSONB;
ALTER TABLE games ADD COLUMN IF NOT EXISTS current_hand INTEGER DEFAULT 0;

-- Create webrtc_signals table for P2P connection coordination
CREATE TABLE IF NOT EXISTS webrtc_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES games(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  signal JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webrtc_signals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'webrtc_signals' 
        AND policyname = 'Users can read own signals'
    ) THEN
        CREATE POLICY "Users can read own signals"
          ON webrtc_signals FOR SELECT
          USING (auth.uid() = to_user_id);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'webrtc_signals' 
        AND policyname = 'Users can send signals'
    ) THEN
        CREATE POLICY "Users can send signals"
          ON webrtc_signals FOR INSERT
          WITH CHECK (auth.uid() = from_user_id);
    END IF;
END$$;

-- Function to auto-delete old signals
CREATE OR REPLACE FUNCTION delete_old_webrtc_signals()
RETURNS void AS $$
BEGIN
  DELETE FROM webrtc_signals
  WHERE created_at < NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_to_user ON webrtc_signals(to_user_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_room ON webrtc_signals(room_id);

-- Enable Realtime for webrtc_signals table
ALTER PUBLICATION supabase_realtime ADD TABLE webrtc_signals;

COMMENT ON TABLE webrtc_signals IS 'Stores WebRTC signaling data for peer-to-peer game connections';
COMMENT ON COLUMN games.game_state IS 'Serialized poker engine state for persistence and recovery';
COMMENT ON COLUMN games.current_hand IS 'Current hand number being played';

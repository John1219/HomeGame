-- Migration: Add player_actions table for Realtime game state sync
-- This replaces WebRTC P2P with Supabase Realtime

-- Create player_actions table
CREATE TABLE IF NOT EXISTS player_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'fold', 'check', 'call', 'raise', 'all-in'
  amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE player_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    -- Users can insert their own actions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'player_actions' 
        AND policyname = 'Users can insert own actions'
    ) THEN
        CREATE POLICY "Users can insert own actions"
          ON player_actions FOR INSERT
          WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Users can read actions in their games
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'player_actions' 
        AND policyname = 'Users can read game actions'
    ) THEN
        CREATE POLICY "Users can read game actions"
          ON player_actions FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM game_participants
              WHERE game_participants.game_id = player_actions.game_id
              AND game_participants.user_id = auth.uid()
            )
          );
    END IF;

    -- Host can update actions (mark as processed)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'player_actions' 
        AND policyname = 'Host can update actions'
    ) THEN
        CREATE POLICY "Host can update actions"
          ON player_actions FOR UPDATE
          USING (
            EXISTS (
              SELECT 1 FROM games
              WHERE games.id = player_actions.game_id
              AND games.host_id = auth.uid()
            )
          );
    END IF;
END$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_actions_game ON player_actions(game_id, processed, created_at);
CREATE INDEX IF NOT EXISTS idx_player_actions_user ON player_actions(user_id);

-- Enable Realtime for player_actions
ALTER PUBLICATION supabase_realtime ADD TABLE player_actions;

-- Enable Realtime for games table (if not already enabled)
DO $$
BEGIN
    -- This may error if already added, which is fine
    ALTER PUBLICATION supabase_realtime ADD TABLE games;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Ignore error if already exists
END$$;

-- Function to auto-delete old processed actions (keep table clean)
CREATE OR REPLACE FUNCTION delete_old_player_actions()
RETURNS void AS $$
BEGIN
  DELETE FROM player_actions 
  WHERE processed = true 
  AND created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE player_actions IS 'Stores player actions for host to process in realtime multiplayer games';
COMMENT ON COLUMN player_actions.action_type IS 'Type of poker action: fold, check, call, raise, all-in';
COMMENT ON COLUMN player_actions.processed IS 'Whether the host has processed this action';

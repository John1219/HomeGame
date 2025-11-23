-- HomeGame Poker - Supabase Database Schema
-- This schema defines the database structure for the P2P poker game
-- Run this in your Supabase SQL Editor after creating your project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  avatar_url TEXT,
  chips_balance INTEGER DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================================
-- GAMES TABLE
-- ============================================================================
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('cash', 'tournament')),
  variant VARCHAR(20) DEFAULT 'holdem',
  small_blind INTEGER NOT NULL,
  big_blind INTEGER NOT NULL,
  buy_in INTEGER NOT NULL,
  max_players INTEGER DEFAULT 9 CHECK (max_players >= 2 AND max_players <= 9),
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  host_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Live game state
  game_state JSONB, -- Serialized PokerEngine state for persistence
  current_hand INTEGER DEFAULT 0,
  
  -- Tournament specific fields
  tournament_blind_schedule JSONB, -- Array of {level, small_blind, big_blind, duration_minutes}
  prize_structure JSONB -- Array of {placement, percentage}
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Games are viewable by everyone
CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT
  USING (true);

-- Anyone can create a game
CREATE POLICY "Authenticated users can create games"
  ON games FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- Only host can update game
CREATE POLICY "Only host can update game"
  ON games FOR UPDATE
  USING (auth.uid() = host_id);

-- Only host can delete game
CREATE POLICY "Only host can delete game"
  ON games FOR DELETE
  USING (auth.uid() = host_id);

-- ============================================================================
-- PLAYER STATS TABLE
-- ============================================================================
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  
  -- Overall stats
  total_hands_played INTEGER DEFAULT 0,
  hands_won INTEGER DEFAULT 0,
  total_chips_won BIGINT DEFAULT 0,
  total_chips_lost BIGINT DEFAULT 0,
  biggest_pot INTEGER DEFAULT 0,
  
  -- Cash game stats
  cash_games_played INTEGER DEFAULT 0,
  cash_game_profit BIGINT DEFAULT 0,
  
  -- Tournament stats
  tournaments_played INTEGER DEFAULT 0,
  tournaments_won INTEGER DEFAULT 0,
  tournament_top_3 INTEGER DEFAULT 0,
  
  -- Best hands
  best_hand JSONB, -- {rank: string, cards: string[], handName: string, achievedAt: timestamp}
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Stats are viewable by everyone
CREATE POLICY "Stats are viewable by everyone"
  ON player_stats FOR SELECT
  USING (true);

-- Users can update own stats (actually done by game results)
CREATE POLICY "Users can update own stats"
  ON player_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow insert for new users
CREATE POLICY "Users can insert own stats"
  ON player_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- GAME PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE game_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seat_position INTEGER CHECK (seat_position >= 0 AND seat_position < 9),
  starting_chips INTEGER NOT NULL,
  ending_chips INTEGER,
  placement INTEGER, -- for tournaments (1 = winner)
  hands_won INTEGER DEFAULT 0,
  biggest_pot INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  
  UNIQUE(game_id, user_id),
  UNIQUE(game_id, seat_position)
);

ALTER TABLE game_participants ENABLE ROW LEVEL SECURITY;

-- Participants are viewable by everyone
CREATE POLICY "Participants are viewable by everyone"
  ON game_participants FOR SELECT
  USING (true);

-- Users can join games
CREATE POLICY "Users can join games"
  ON game_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users or host can update participant records
CREATE POLICY "Users or host can update participants"
  ON game_participants FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    auth.uid() = (SELECT host_id FROM games WHERE id = game_id)
  );

-- ============================================================================
-- FRIENDS TABLE
-- ============================================================================
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Users can view their own friends
CREATE POLICY "Users can view their own friends"
  ON friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can create friend requests
CREATE POLICY "Users can create friend requests"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update friend status
CREATE POLICY "Users can update friend status"
  ON friends FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can delete friendships
CREATE POLICY "Users can delete friendships"
  ON friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles table
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for player_stats table
CREATE TRIGGER update_player_stats_updated_at
  BEFORE UPDATE ON player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, chips_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substr(NEW.id::text, 1, 8)),
    10000
  );
  
  INSERT INTO public.player_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile and stats on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- WEBRTC SIGNALS TABLE (for P2P connection coordination)
-- ============================================================================
CREATE TABLE webrtc_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES games(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  signal JSONB NOT NULL, -- WebRTC signal data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Users can read signals sent to them
CREATE POLICY "Users can read own signals"
  ON webrtc_signals FOR SELECT
  USING (auth.uid() = to_user_id);

-- Users can send signals
CREATE POLICY "Users can send signals"
  ON webrtc_signals FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Auto-delete old signals after 1 minute
CREATE OR REPLACE FUNCTION delete_old_webrtc_signals()
RETURNS void AS $$
BEGIN
  DELETE FROM webrtc_signals
  WHERE created_at < NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES for better performance
-- ============================================================================
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_host_id ON games(host_id);
CREATE INDEX idx_game_participants_game_id ON game_participants(game_id);
CREATE INDEX idx_game_participants_user_id ON game_participants(user_id);
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_webrtc_signals_to_user ON webrtc_signals(to_user_id);
CREATE INDEX idx_webrtc_signals_room ON webrtc_signals(room_id);

-- ============================================================================
-- INITIAL DATA (Optional - for testing)
-- ============================================================================

-- You can uncomment this to create a default tournament blind structure
-- INSERT INTO public.games (game_type, variant, small_blind, big_blind, buy_in, max_players, host_id, tournament_blind_schedule, prize_structure)
-- VALUES (
--   'tournament',
--   'holdem',
--   10,
--   20,
--   1000,
--   9,
--   NULL, -- Set to actual user ID
--   '[
--     {"level": 1, "small_blind": 10, "big_blind": 20, "duration_minutes": 10},
--     {"level": 2, "small_blind": 20, "big_blind": 40, "duration_minutes": 10},
--     {"level": 3, "small_blind": 30, "big_blind": 60, "duration_minutes": 10}
--   ]'::jsonb,
--   '[
--     {"placement": 1, "percentage": 50},
--     {"placement": 2, "percentage": 30},
--     {"placement": 3, "percentage": 20}
--   ]'::jsonb
-- );

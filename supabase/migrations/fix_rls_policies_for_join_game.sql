-- ============================================================================
-- Fix RLS Policies for Join Game and State Updates
-- This migration fixes Row Level Security policies to allow proper game operations
-- ============================================================================

-- Drop and recreate game_participants policies with proper permissions
DROP POLICY IF EXISTS "Users can join games" ON game_participants;
DROP POLICY IF EXISTS "Users or host can update participants" ON game_participants;

-- Allow users to join games (INSERT)
CREATE POLICY "Users can join games"
  ON game_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own participant record OR host can update any participant
CREATE POLICY "Users or host can update participants"
  ON game_participants FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT host_id FROM games WHERE id = game_id)
  );

-- Allow cleanup of participants when leaving games
CREATE POLICY "Users can leave games"
  ON game_participants FOR DELETE
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT host_id FROM games WHERE id = game_id)
  );

-- ============================================================================
-- Fix games table UPDATE policy to allow host to update game state
-- ============================================================================

DROP POLICY IF EXISTS "Only host can update game" ON games;

-- Host can update their games (including game_state JSONB updates during gameplay)
CREATE POLICY "Host can update their games"
  ON games FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- ============================================================================
-- Ensure hand history tables have proper RLS policies
-- ============================================================================

-- Check if hand_history table exists and has RLS enabled
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hand_history') THEN
        -- Enable RLS if not already enabled
        ALTER TABLE hand_history ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Anyone can view hand history" ON hand_history;
        DROP POLICY IF EXISTS "Host can insert hand history" ON hand_history;
        
        -- Allow everyone to view hand history
        CREATE POLICY "Anyone can view hand history"
          ON hand_history FOR SELECT
          USING (true);
        
        -- Allow game host to insert hand history records
        CREATE POLICY "Host can insert hand history"
          ON hand_history FOR INSERT
          WITH CHECK (
            auth.uid() IN (SELECT host_id FROM games WHERE id = game_id)
          );
    END IF;
END $$;

-- Check if hand_player_results table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hand_player_results') THEN
        ALTER TABLE hand_player_results ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Anyone can view player results" ON hand_player_results;
        DROP POLICY IF EXISTS "Host can insert player results" ON hand_player_results;
        
        CREATE POLICY "Anyone can view player results"
          ON hand_player_results FOR SELECT
          USING (true);
        
        CREATE POLICY "Host can insert player results"
          ON hand_player_results FOR INSERT
          WITH CHECK (
            auth.uid() IN (
              SELECT host_id FROM games 
              WHERE id IN (SELECT game_id FROM hand_history WHERE id = hand_id)
            )
          );
    END IF;
END $$;

-- Check if hand_actions table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'hand_actions') THEN
        ALTER TABLE hand_actions ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Anyone can view hand actions" ON hand_actions;
        DROP POLICY IF EXISTS "Host can insert hand actions" ON hand_actions;
        
        CREATE POLICY "Anyone can view hand actions"
          ON hand_actions FOR SELECT
          USING (true);
        
        CREATE POLICY "Host can insert hand actions"
          ON hand_actions FOR INSERT
          WITH CHECK (
            auth.uid() IN (
              SELECT host_id FROM games 
              WHERE id IN (SELECT game_id FROM hand_history WHERE id = hand_id)
            )
          );
    END IF;
END $$;

-- ============================================================================
-- Grant necessary permissions to authenticated users
-- ============================================================================

-- Ensure authenticated users can execute functions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

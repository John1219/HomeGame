-- Add game_name column to games table
-- This allows hosts to give their games custom names for easier identification

ALTER TABLE games 
ADD COLUMN game_name VARCHAR(100);

-- Set default game names for existing games
UPDATE games 
SET game_name = 'Poker Game #' || id::text
WHERE game_name IS NULL;

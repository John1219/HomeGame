-- Add activity tracking to games table for auto-cleanup
-- This allows us to automatically delete games that have been empty for 10+ minutes

-- Add last_activity_at column
ALTER TABLE games 
ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for efficient querying of old games
CREATE INDEX idx_games_last_activity ON games(last_activity_at);

-- Update existing games to have current timestamp
UPDATE games SET last_activity_at = NOW() WHERE last_activity_at IS NULL;

-- Create function to update last_activity_at
CREATE OR REPLACE FUNCTION update_game_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update activity on game changes
CREATE TRIGGER update_game_activity_trigger
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_game_activity();

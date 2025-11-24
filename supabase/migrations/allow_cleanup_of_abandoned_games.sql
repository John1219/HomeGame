-- Update DELETE policy to allow cleanup of abandoned games
-- Currently only hosts can delete games, which prevents the auto-cleanup from working
-- when run by other clients.

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Only host can delete game" ON games;

-- Create new policy that allows deletion if:
-- 1. User is the host
-- 2. OR Game is abandoned (inactive for > 10 minutes)
CREATE POLICY "Allow cleanup of abandoned games"
  ON games FOR DELETE
  USING (
    auth.uid() = host_id 
    OR 
    (last_activity_at < NOW() - INTERVAL '10 minutes')
  );

# Setup WebRTC Signaling for Multiplayer

## Quick Setup

1. **Open your Supabase Dashboard**:
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Run the Migration**:
   - Click on "SQL Editor" in the left sidebar
   - Click "+ New Query"
   - Copy and paste the contents of `supabase/migrations/add_webrtc_signaling.sql`
   - Click "Run" or press `Ctrl/Cmd + Enter`

3. **Verify Setup**:
   - Go to "Table Editor"
   - You should see a new table called `webrtc_signals`
   - Check that the `games` table now has `game_state`, `current_hand`, and `updated_at` columns

4. **Enable Realtime** (Usually automatic, but verify):
   - The migration includes this command: `ALTER PUBLICATION supabase_realtime ADD TABLE webrtc_signals;`
   - This should enable Realtime automatically when you run the migration
   
   **To verify it's enabled:**
   - Go to "Database" → "Publications" in the left sidebar
   - Find the `supabase_realtime` publication
   - Click on it and verify `webrtc_signals` is listed in the tables
   
   **If you need to enable manually:**
   - In SQL Editor, run: `ALTER PUBLICATION supabase_realtime ADD TABLE webrtc_signals;`
   
   > **Note**: "ETL Replication" is for data syncing to external systems and is NOT the same as Realtime. You can ignore that section.

## What This Does

- **webrtc_signals table**: Stores WebRTC signaling data for establishing peer-to-peer connections between players
- **game_state column**: Saves the current poker game state for persistence
- **Realtime subscription**: Enables instant delivery of WebRTC signals between browsers

## Testing Multiplayer

Once the migration is complete, you can test multiplayer:

1. **Start the dev server**: `npm run dev`
2. **Open 2 browser windows** (or use incognito for the second)
3. **Window 1**: Register/login → Create a game → You're the host
4. **Window 2**: Register/login → Join the game created in Window 1
5. **Watch the magic**:  P2P connection should establish automatically!

Check the browser console for connection logs:
- `[P2P] Initialized as HOST...`
- `[P2P] Subscribing to signal channel...`
- `[P2P] Connected to peer...`

## Troubleshooting

**No P2P connection?**
- Check browser console for errors
- Verify Realtime is enabled for `webrtc_signals`
- Make sure both users are in the same game
- Try refreshing both windows

**RLS Policy errors?**
- Re-run the migration
- Check SQL Editor for any errors during migration

**Connection timeout?**
- WebRTC may be blocked by firewall
- Try using a different network or disabling firewall temporarily

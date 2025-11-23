# WebRTC Connection Issues - Quick Diagnosis

## Current Status
❌ Client cannot connect to host  
❌ "Invalid domain" error in Realtime subscription  
✅ Database tables exist  
✅ Signals are being sent  

## Root Cause
The Supabase Realtime subscription is failing with "invalid domain" error. This prevents the host from receiving WebRTC signals from the client.

## Immediate Solutions

### Option 1: Enable Realtime (Recommended)
1. Go to Supabase Dashboard
2. Navigate to **Database → Replication**
3. Find `webrtc_signals` table
4. **Toggle it ON**
5. Click Save

### Option 2: Fallback to Polling (If Realtime doesn't work)
Instead of using Realtime subscriptions, poll the database for new signals every few seconds.

**Pros:**
- Simple, works without Realtime
- No subscription issues

**Cons:**
- Slightly higher latency (1-2 seconds)
- More database queries

## Testing After Fix
1. Refresh both browsers
2. Host a game (player1)
3. Join game (player2)
4. Should connect within 5 seconds

## If Still Not Working
Check console for:
- Authentication errors
- Database permission errors  
- Network connectivity issues

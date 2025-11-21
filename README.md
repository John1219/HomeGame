# 🎰 HomeGame - P2P Online Poker

A peer-to-peer online poker platform that recreates the home game experience with friends. Features real-time gameplay, video/voice chat, statistics tracking, and both tournament and cash game modes.

## 🏗️ Architecture

**Hybrid P2P Approach:**
- **Lightweight Backend**: Supabase (authentication, database, real-time signaling) - FREE tier
- **Game Hosting**: One player hosts each game in their browser (client-side poker engine)
- **P2P Communication**: WebRTC data channels for game state synchronization
- **Video/Voice/Text**: WebRTC peer-to-peer connections

**Benefits:**
- ✅ Minimal server costs (Supabase free tier)
- ✅ No game server to deploy or maintain
- ✅ Perfect for playing with friends
- ✅ Low latency for small groups
- ✅ No real money gambling - play money only

## 🚀 Tech Stack

### Frontend
- **React 19** + **TypeScript** + **Vite** - Fast, modern development
- **Redux Toolkit** - State management
- **React Router** - Navigation
- **Supabase JS Client** - Database and auth
- **Simple-peer** - WebRTC P2P connections
- **Pokersolver** - Hand evaluation library

### Backend (Supabase Cloud - Free Tier)
- **Supabase Auth** - User authentication
- **PostgreSQL** - Database (managed by Supabase)
- **Supabase Realtime** - WebRTC signaling and lobby updates
- **Supabase Storage** - Avatar images

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Supabase Account** (free tier is sufficient)

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd HomeGame
npm install
```

### 2. Set Up Supabase

#### Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new account or sign in
3. Click "New Project"
4. Fill in project details and wait for setup to complete (1-2 minutes)

#### Run the Database Schema
1. In your Supabase project dashboard, go to the **SQL Editor**
2. Copy the contents of `supabase/schema.sql`
3. Paste into the SQL Editor and click **Run**
4. This creates all tables, policies, triggers, and functions

#### Create Storage Bucket for Avatars
1. Go to **Storage** in the Supabase dashboard
2. Click "Create a new bucket"
3. Name it `avatars`
4. Make it **public** (for avatar images)

#### Get Your API Credentials
1. Go to **Settings** > **API** in your Supabase dashboard
2. Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy your **anon public** key

### 3. Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_STUN_SERVER_URL=stun:stun.l.google.com:19302
   ```

### 4. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 🎮 How to Play

### Create an Account
1. Navigate to the registration page
2. Enter your email, username, and password
3. Your account is created with 10,000 starting chips

### Host a Game
1. Go to the Lobby
2. Click "Host New Game"
3. Choose game type (Cash or Tournament)
4. Set blinds and buy-in
5. Share the game code with friends

### Join a Game
1. Go to the Lobby
2. See list of active games
3. Click "Join" on any waiting game
4. Or enter a friend's game code

### Play Poker
- **Actions**: Fold, Check, Call, Raise
- **Communication**: Text chat, voice, and video built-in
- **Stats**: All games are tracked in your statistics

## 🏗️ Project Structure

```
HomeGame/
├── supabase/
│   └── schema.sql              # Database schema
├── src/
│   ├── game/
│   │   ├── PokerEngine.ts      # Core poker logic (host-side)
│   │   ├── TournamentManager.ts # Tournament logic (TODO)
│   │   ├── GameHost.ts         # Host controller (TODO)
│   │   └── GameClient.ts       # Client controller (TODO)
│   ├── services/
│   │   ├── authService.ts      # Authentication
│   │   ├── statsService.ts     # Statistics tracking
│   │   ├── p2pService.ts       # WebRTC P2P (TODO)
│   │   └── signalingService.ts # WebRTC signaling (TODO)
│   ├── lib/
│   │   └── supabaseClient.ts   # Supabase initialization
│   ├── components/             # React components (TODO)
│   ├── store/                  # Redux store (TODO)
│   └── App.tsx                 # Main app
├── .env.local                  # Your credentials (DO NOT COMMIT)
├── .env.local.example          # Template for .env.local
├── package.json
└── README.md
```

## 🔒 Security & Privacy

- **Play Money Only**: No real money gambling
- **Row Level Security**: Supabase RLS policies protect user data
- **P2P Trust Model**: Players must trust the host (ideal for friends)
- **Environment Variables**: Never commit `.env.local` to version control

## 🚧 Current Status

✅ **Completed:**
- Project setup with React + Vite + TypeScript
- Supabase integration (auth, database)
- Core poker engine with full Texas Hold'em logic
- Authentication service
- Statistics tracking service
- Database schema with RLS policies

🚧 **In Progress:**
- WebRTC P2P communication
- React UI components
- Redux state management

📋 **TODO:**
- Tournament manager
- Video/voice chat
- Game lobby UI
- Poker table UI
- Stats dashboard
- Testing & polish

## 🤝 Contributing

This is a personal project for playing poker with friends. Feel free to fork and customize for your own use!

## 📝 License

MIT License - Play responsibly and have fun!

## 🎯 Features

### Current
- ✅ User authentication with Supabase
- ✅ Player statistics tracking
- ✅ Game history
- ✅ Leaderboards
- ✅ Full Texas Hold'em poker engine

### Coming Soon
- 🚧 P2P game hosting
- 🚧 Real-time gameplay
- 🚧 Text, voice, and video chat
- 🚧 Tournament mode
- 🚧 Cash game mode
- 🚧 Beautiful poker table UI
- 🚧 Mobile responsive design

## 💬 Support

For questions or issues, please open a GitHub issue.

---

**Remember**: This is for entertainment purposes only. Play money, no real gambling. Enjoy your home game! 🎲

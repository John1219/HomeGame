# Setting Up Supabase for HomeGame Poker

This guide walks you through setting up Supabase for the HomeGame poker application.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: HomeGame (or your preferred name)
   - **Database Password**: Create a strong password (save it somewhere safe!)
   - **Region**: Choose the closest region to your location
   - **Pricing Plan**: Free tier is perfect for this project
4. Click **"Create new project"**
5. Wait 1-2 minutes for the project to be provisioned

## Step 2: Run the Database Schema

1. In your Supabase dashboard, click on **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/schema.sql` from this project
4. Copy ALL the contents and paste into the SQL Editor
5. Click **"Run"** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned" - this is correct!

**What this does:**
- Creates all database tables (profiles, games, player_stats, etc.)
- Sets up Row Level Security (RLS) policies
- Creates triggers for auto-updating timestamps
- Creates a trigger to auto-create profiles when users sign up
- Adds indexes for better performance

## Step 3: Create Storage Bucket for Avatars

1. Click on **"Storage"** in the left sidebar
2. Click **"Create a new bucket"**
3. Enter details:
   - **Name**: `avatars`
   - **Public bucket**: Toggle ON (so avatar images can be viewed)
4. Click **"Create bucket"**

## Step 4: Get Your API Credentials

1. Click on **"Settings"** (gear icon) in the left sidebar
2. Click on **"API"**
3. You'll see two important values:

   **Project URL** (looks like: `https://abcdefghijk.supabase.co`)
   - Copy this value

   **anon public** key (under "Project API keys")
   - Copy this value (it's a long string starting with "eyJ...")

4. Keep these values handy - you'll need them in the next step!

## Step 5: Configure Your Application

1. In your HomeGame project folder, find the file `.env.local.example`
2. Copy it to create `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
3. Open `.env.local` in your text editor
4. Replace the placeholder values:
   ```env
   VITE_SUPABASE_URL=https://abcdefghijk.supabase.co  # Paste your Project URL
   VITE_SUPABASE_ANON_KEY=eyJ...                      # Paste your anon key
   VITE_STUN_SERVER_URL=stun:stun.l.google.com:19302  # Keep as-is
   ```
5. Save the file

⚠️ **IMPORTANT**: Never commit `.env.local` to git! It's already in `.gitignore`.

## Step 6: Enable Email Authentication (Optional)

By default, Supabase sends confirmation emails. For development, you might want to disable this:

1. Go to **"Authentication"** > **"Providers"** > **"Email"**
2. Scroll down to **"Confirm email"**
3. Toggle OFF for development (toggle ON for production)
4. Click **"Save"**

## Step 7: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Try creating a test account through your app
3. Check in Supabase:
   - Go to **"Authentication"** > **"Users"** - you should see your new user
   - Go to **"Table Editor"** > **"profiles"** - you should see your profile
   - Go to **"Table Editor"** > **"player_stats"** - you should see your stats

If everything works, you're all set! 🎉

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure `.env.local` exists in your project root
- Make sure the variable names start with `VITE_`
- Restart your dev server after creating/editing `.env.local`

### User created but no profile
- Check that the `on_auth_user_created` trigger is created
- Run the schema.sql again to create the trigger

### Can't insert into tables
- Check Row Level Security (RLS) policies in **"Authentication"** > **"Policies"**
- Make sure RLS is enabled and policies are correct

### Storage upload fails
- Make sure the `avatars` bucket exists and is public
- Check that your Supabase project has storage enabled (free tier includes 1GB)

## Viewing Your Data

You can view and edit your data directly in Supabase:

1. **Table Editor**: View/edit data in tables
2. **SQL Editor**: Run custom SQL queries
3. **Authentication**: Manage users
4. **Storage**: View uploaded files
5. **Database**: View schema, relationships, and indexes

## Next Steps

Once Supabase is set up, you can:
- ✅ Create user accounts
- ✅ Track statistics
- ✅ Store game history
- ✅ Upload avatars
- ✅ Use Realtime for WebRTC signaling

Happy poker playing! 🎰

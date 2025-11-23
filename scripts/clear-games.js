import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function clearGames() {
    console.log('🗑️  Clearing all games...\n');

    // Delete all game participants first (due to foreign key)
    const { error: participantsError } = await supabase
        .from('game_participants')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (participantsError) {
        console.error('❌ Error deleting participants:', participantsError);
    } else {
        console.log('✅ Cleared all game participants');
    }

    // Delete all games
    const { error: gamesError } = await supabase
        .from('games')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (gamesError) {
        console.error('❌ Error deleting games:', gamesError);
    } else {
        console.log('✅ Cleared all games');
    }

    console.log('\n✅ Database cleaned!');
}

clearGames().catch(console.error);

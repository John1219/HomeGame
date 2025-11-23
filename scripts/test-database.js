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

async function testDatabase() {
    console.log('🔍 Testing HomeGame Database Setup\n');

    // Test 1: Check if profiles table exists and has data
    console.log('1️⃣  Testing profiles table...');
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(5);

    if (profilesError) {
        console.error('   ❌ Profiles table error:', profilesError.message);
    } else {
        console.log(`   ✅ Profiles table exists with ${profiles.length} users`);
    }

    // Test 2: Check if games table exists
    console.log('\n2️⃣  Testing games table...');
    const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .limit(5);

    if (gamesError) {
        console.error('   ❌ Games table error:', gamesError.message);
    } else {
        console.log(`   ✅ Games table exists with ${games.length} games`);
    }

    // Test 3: Check if webrtc_signals table exists (THIS IS THE KEY ONE)
    console.log('\n3️⃣  Testing webrtc_signals table...');
    const { data: signals, error: signalsError } = await supabase
        .from('webrtc_signals')
        .select('*')
        .limit(1);

    if (signalsError) {
        console.error('   ❌ WEBRTC_SIGNALS TABLE ERROR:', signalsError.message);
        console.error('   ⚠️  This table is REQUIRED for P2P connections!');
        console.error('   📋 You need to run: supabase/migrations/add_webrtc_signaling.sql');
    } else {
        console.log('   ✅ webrtc_signals table exists');
    }

    // Test 4: Try to insert a test signal
    console.log('\n4️⃣  Testing webrtc_signals insert...');
    const { error: insertError } = await supabase
        .from('webrtc_signals')
        .insert({
            room_id: '00000000-0000-0000-0000-000000000000',
            from_user_id: '00000000-0000-0000-0000-000000000000',
            to_user_id: '00000000-0000-0000-0000-000000000000',
            signal: { type: 'test' }
        });

    if (insertError) {
        console.error('   ❌ Insert failed:', insertError.message);
    } else {
        console.log('   ✅ Can insert signals successfully');

        // Clean up test signal
        await supabase
            .from('webrtc_signals')
            .delete()
            .eq('room_id', '00000000-0000-0000-0000-000000000000');
    }

    console.log('\n✅ Database test complete!\n');
}

testDatabase().catch(console.error);

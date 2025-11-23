import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing required environment variables');
    console.error('   Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const TEST_ACCOUNTS = [
    { email: 'player1@test.com', password: 'test123', username: 'Player1' },
    { email: 'player2@test.com', password: 'test123', username: 'Player2' }
];

async function deleteAllUsers() {
    console.log('🗑️  Deleting existing users...');

    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('❌ Error listing users:', error);
        return;
    }

    if (!users || users.users.length === 0) {
        console.log('   No existing users to delete');
        return;
    }

    for (const user of users.users) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
            console.error(`❌ Error deleting user ${user.email}:`, deleteError);
        } else {
            console.log(`   ✅ Deleted user: ${user.email}`);
        }
    }
}

async function createTestUsers() {
    console.log('\n👤 Creating test accounts...');

    for (const account of TEST_ACCOUNTS) {
        const { data, error } = await supabase.auth.admin.createUser({
            email: account.email,
            password: account.password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                username: account.username
            }
        });

        if (error) {
            console.error(`❌ Error creating ${account.email}:`, error);
        } else {
            console.log(`   ✅ Created: ${account.email} (password: ${account.password})`);

            // Also create the player profile in the database
            const { error: profileError } = await supabase
                .from('players')
                .insert({
                    id: data.user.id,
                    username: account.username,
                    chips: 10000
                });

            if (profileError) {
                console.error(`   ⚠️  Warning: Could not create player profile:`, profileError.message);
            } else {
                console.log(`   ✅ Created player profile with 10,000 chips`);
            }
        }
    }
}

async function main() {
    console.log('🎮 HomeGame Test User Setup\n');

    await deleteAllUsers();
    await createTestUsers();

    console.log('\n✅ Setup complete!');
    console.log('\nTest Accounts:');
    TEST_ACCOUNTS.forEach(account => {
        console.log(`   📧 ${account.email} / 🔑 ${account.password}`);
    });
}

main().catch(console.error);

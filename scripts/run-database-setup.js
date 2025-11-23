import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
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

async function setupDatabase() {
    console.log('🗄️  Setting up database schema...\n');

    // Read SQL file
    const sqlPath = join(__dirname, 'setup-database.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
        // If the RPC doesn't exist, we'll need to use the SQL Editor
        console.log('⚠️  Note: Please run this SQL in your Supabase SQL Editor:');
        console.log('   1. Go to your Supabase project dashboard');
        console.log('   2. Navigate to SQL Editor');
        console.log('   3. Copy and paste the contents of: scripts/setup-database.sql');
        console.log('   4. Click "Run"\n');
        console.log('📋 SQL file location:', sqlPath);
    } else {
        console.log('✅ Database schema created successfully!');
    }
}

setupDatabase().catch(console.error);

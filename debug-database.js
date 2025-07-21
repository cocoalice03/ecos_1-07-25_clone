
import postgres from 'postgres';

async function testDatabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL environment variable is missing');
    return;
  }

  console.log('Current URL (masked):', process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@'));
  
  // Test 1: URL actuelle
  await testUrl(process.env.DATABASE_URL, 'URL actuelle');
  
  // Test 2: URL avec pooler (si pas déjà présent)
  if (!process.env.DATABASE_URL.includes('-pooler')) {
    const poolerUrl = process.env.DATABASE_URL.replace('@db.', '@db.');
    const poolerUrlFixed = poolerUrl.replace('@db.', '@db.') + '-pooler';
    await testUrl(poolerUrlFixed, 'URL avec pooler');
  }
}

async function testUrl(url, description) {
  try {
    console.log(`\n⏳ Testing ${description}...`);
    const client = postgres(url, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      connect_timeout: 15,
      idle_timeout: 15,
      prepare: false,
    });
    
    const result = await client`SELECT 1 as test, current_timestamp as time`;
    console.log(`✅ ${description} - Connection successful:`, result[0]);
    
    await client.end();
    return true;
  } catch (error) {
    console.log(`❌ ${description} - Connection failed:`, {
      name: error.name,
      message: error.message,
      code: error.code
    });
    return false;
  }
}</async_function>

testDatabaseConnection();


import postgres from 'postgres';

async function testDatabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Present' : 'Missing');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL environment variable is missing');
    return;
  }
  
  try {
    // Test basic connection
    const client = postgres(process.env.DATABASE_URL, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      connect_timeout: 10,
      idle_timeout: 10,
      prepare: false,
    });
    
    console.log('⏳ Attempting connection...');
    const result = await client`SELECT 1 as test, current_timestamp as time`;
    console.log('✅ Connection successful:', result[0]);
    
    await client.end();
  } catch (error) {
    console.log('❌ Connection failed:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errno: error.errno
    });
  }
}

testDatabaseConnection();

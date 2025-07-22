import pg from 'pg';
const { Client } = pg;

async function testConnection() {
  console.log('🔧 Testing Supabase connection...');
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set');
    return;
  }
  
  // Extract host from DATABASE_URL
  const url = process.env.DATABASE_URL;
  const hostMatch = url.match(/postgresql:\/\/[^@]+@([^:\/]+)/);
  if (hostMatch) {
    console.log('🔍 Host extracted:', hostMatch[1]);
  }
  
  // Try different connection methods
  const methods = [
    {
      name: 'Direct URL',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      }
    },
    {
      name: 'Pooler (port 6543)',
      config: {
        connectionString: process.env.DATABASE_URL.replace(':5432', ':6543'),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      }
    },
    {
      name: 'Without SSL',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: false,
        connectionTimeoutMillis: 10000,
      }
    }
  ];
  
  for (const method of methods) {
    console.log(`\n🔌 Trying ${method.name}...`);
    const client = new Client(method.config);
    
    try {
      await client.connect();
      const result = await client.query('SELECT NOW()');
      console.log(`✅ SUCCESS with ${method.name}!`);
      console.log('Server time:', result.rows[0].now);
      
      // Try to query scenarios table
      try {
        const scenarios = await client.query('SELECT COUNT(*) FROM ecos_scenarios');
        console.log('Scenarios count:', scenarios.rows[0].count);
      } catch (e) {
        console.log('Scenarios table query failed:', e.message);
      }
      
      await client.end();
      break;
    } catch (error) {
      console.error(`❌ ${method.name} failed:`, error.message);
      if (error.code) {
        console.error('Error code:', error.code);
      }
    }
  }
}

testConnection().catch(console.error);
import { createClient } from '@supabase/supabase-js';

async function testSupabaseConnection() {
  console.log('🔧 Testing Supabase connection...');
  
  let supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  // If SUPABASE_URL is a PostgreSQL URL, extract the project ID and construct the HTTP URL
  if (supabaseUrl && supabaseUrl.startsWith('postgresql://')) {
    const match = supabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
    if (match) {
      const projectId = match[1];
      supabaseUrl = `https://${projectId}.supabase.co`;
      console.log('🔄 Converted PostgreSQL URL to Supabase HTTP URL:', supabaseUrl);
    }
  }
  
  console.log('SUPABASE_URL exists:', !!supabaseUrl);
  console.log('SUPABASE_KEY exists:', !!supabaseKey);
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    return;
  }
  
  try {
    console.log('🔌 Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test basic connection
    console.log('📊 Testing database connection...');
    const { data, error } = await supabase
      .from('ecos_scenarios')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Database query error:', error.message);
      
      if (error.message.includes('does not exist')) {
        console.log('⚠️ Table ecos_scenarios does not exist');
        
        // Try to list existing tables
        const { data: tables, error: tablesError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .limit(10);
        
        if (tablesError) {
          console.error('❌ Cannot list tables:', tablesError.message);
        } else {
          console.log('📋 Existing tables:', tables?.map(t => t.table_name).join(', '));
        }
      }
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('Data:', data);
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testSupabaseConnection().catch(console.error);
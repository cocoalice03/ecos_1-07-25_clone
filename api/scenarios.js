// Enhanced scenarios API endpoint for Vercel deployment
// Production-ready with comprehensive error handling and logging

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Set comprehensive CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check endpoint
  if (req.url === '/api/scenarios/health') {
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      uptime: process.uptime()
    });
  }

  if (req.method === 'GET') {
    try {
      console.log(`[${new Date().toISOString()}] Starting scenarios fetch request`);
      
      // Environment validation with detailed logging
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      
      console.log(`Environment check:
        - SUPABASE_URL: ${supabaseUrl ? '✓ Present' : '❌ Missing'}
        - SERVICE_KEY: ${supabaseServiceKey ? '✓ Present' : '❌ Missing'}
        - ANON_KEY: ${supabaseAnonKey ? '✓ Present' : '❌ Missing'}`);

      if (!supabaseUrl) {
        console.error('❌ SUPABASE_URL is missing');
        return res.status(500).json({
          scenarios: [],
          connected: false,
          error: 'SUPABASE_URL environment variable is missing',
          source: 'env-validation-error',
          timestamp: new Date().toISOString()
        });
      }

      const supabaseKey = supabaseServiceKey || supabaseAnonKey;
      if (!supabaseKey) {
        console.error('❌ No Supabase key available');
        return res.status(500).json({
          scenarios: [],
          connected: false,
          error: 'No Supabase authentication key available',
          source: 'auth-key-missing',
          timestamp: new Date().toISOString()
        });
      }

      console.log(`Using key type: ${supabaseServiceKey ? 'service_role' : 'anon'}`);

      // Multiple fetch strategies for maximum reliability
      const fetchStrategies = [
        {
          name: 'direct-rest-api',
          url: `${supabaseUrl}/rest/v1/scenarios?order=created_at.desc&limit=100`,
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          }
        },
        {
          name: 'simple-rest-api',
          url: `${supabaseUrl}/rest/v1/scenarios`,
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      ];

      let lastError = null;
      
      for (const strategy of fetchStrategies) {
        try {
          console.log(`🔄 Trying strategy: ${strategy.name}`);
          console.log(`   URL: ${strategy.url}`);
          
          const response = await fetch(strategy.url, {
            method: 'GET',
            headers: strategy.headers,
            timeout: 10000 // 10 second timeout
          });

          console.log(`   Response status: ${response.status} ${response.statusText}`);

          if (response.ok) {
            const scenarios = await response.json();
            const responseTime = Date.now() - startTime;
            
            console.log(`✅ Success with ${strategy.name}: Retrieved ${scenarios?.length || 0} scenarios in ${responseTime}ms`);
            
            return res.status(200).json({
              scenarios: scenarios || [],
              connected: true,
              source: `scenarios-api-${strategy.name}`,
              count: scenarios?.length || 0,
              responseTime,
              timestamp: new Date().toISOString(),
              keyType: supabaseServiceKey ? 'service_role' : 'anon'
            });
          } else {
            const errorText = await response.text();
            lastError = `${strategy.name}: ${response.status} ${response.statusText} - ${errorText}`;
            console.warn(`⚠️  Strategy ${strategy.name} failed: ${lastError}`);
            continue;
          }
        } catch (error) {
          lastError = `${strategy.name}: ${error.message}`;
          console.warn(`⚠️  Strategy ${strategy.name} error: ${error.message}`);
          continue;
        }
      }

      // All strategies failed
      console.error('❌ All fetch strategies failed');
      return res.status(200).json({
        scenarios: [],
        connected: false,
        error: `All connection strategies failed. Last error: ${lastError}`,
        source: 'all-strategies-failed',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      });

    } catch (error) {
      console.error('❌ Unexpected error in scenarios handler:', error);
      return res.status(200).json({
        scenarios: [],
        connected: false,
        error: `Unexpected error: ${error.message}`,
        source: 'handler-exception',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      });
    }
  }

  return res.status(405).json({ 
    error: 'Method not allowed', 
    allowedMethods: ['GET', 'OPTIONS'],
    timestamp: new Date().toISOString()
  });
}
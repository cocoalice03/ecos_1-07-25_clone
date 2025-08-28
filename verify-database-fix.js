#!/usr/bin/env node

/**
 * Database Fix Verification Script
 * 
 * Run this after manually creating tables to verify everything works
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Verifying Database Fix');
console.log('='.repeat(40));

async function verifyTables() {
  console.log('\n🔧 Checking if required tables exist...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const requiredTables = [
    'ecos_scenarios',
    'ecos_sessions', 
    'ecos_messages',
    'ecos_evaluations',
    'users',
    'exchanges'
  ];

  const results = {};

  for (const tableName of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        results[tableName] = { exists: false, error: error.message };
      } else {
        const { count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        results[tableName] = { exists: true, count: count || 0 };
      }
    } catch (err) {
      results[tableName] = { exists: false, error: err.message };
    }
  }

  console.log('\n📊 Table Status:');
  let allTablesExist = true;
  
  for (const [table, status] of Object.entries(results)) {
    const icon = status.exists ? '✅' : '❌';
    const info = status.exists ? `(${status.count} records)` : `(${status.error})`;
    console.log(`${icon} ${table}: ${status.exists ? 'EXISTS' : 'MISSING'} ${info}`);
    
    if (!status.exists) allTablesExist = false;
  }

  return { allTablesExist, results };
}

async function testAPIEndpoints() {
  console.log('\n🔧 Testing API endpoints...');
  
  const PORT = 3001; // The correct port for this project
  
  try {
    // Test health endpoint
    const healthResponse = await fetch(`http://localhost:${PORT}/health`);
    const healthData = await healthResponse.json();
    
    console.log(`🏥 Health endpoint: ${healthResponse.status === 200 ? '✅' : '❌'}`);
    if (healthData.services) {
      console.log(`   Database: ${healthData.services.database}`);
    }

    // Test teacher scenarios endpoint
    const scenarioResponse = await fetch(`http://localhost:${PORT}/api/teacher/scenarios?email=cherubindavid@gmail.com`);
    const scenarioData = await scenarioResponse.json();
    
    console.log(`🎓 Teacher scenarios: ${scenarioResponse.status === 200 ? '✅' : '❌'}`);
    if (scenarioResponse.status !== 200) {
      console.log(`   Error: ${scenarioResponse.status} - ${scenarioData.message || 'Unknown error'}`);
    } else if (scenarioData.scenarios) {
      console.log(`   Found ${scenarioData.scenarios.length} scenarios`);
      console.log(`   Connected: ${scenarioData.connected}`);
      console.log(`   Source: ${scenarioData.source}`);
    }

    // Test dashboard endpoint
    const dashboardResponse = await fetch(`http://localhost:${PORT}/api/teacher/dashboard?email=cherubindavid@gmail.com`);
    const dashboardData = await dashboardResponse.json();
    
    console.log(`📊 Teacher dashboard: ${dashboardResponse.status === 200 ? '✅' : '❌'}`);
    if (dashboardData.totalScenarios !== undefined) {
      console.log(`   Total scenarios: ${dashboardData.totalScenarios}`);
    }

    return {
      health: healthResponse.status === 200,
      scenarios: scenarioResponse.status === 200,
      dashboard: dashboardResponse.status === 200
    };

  } catch (error) {
    console.error('❌ Error testing endpoints:', error.message);
    console.log(`⚠️ Make sure the server is running on http://localhost:${PORT}`);
    return { health: false, scenarios: false, dashboard: false, serverDown: true };
  }
}

async function main() {
  try {
    // Verify database tables
    const { allTablesExist, results } = await verifyTables();
    
    if (!allTablesExist) {
      console.log('\n❌ SETUP INCOMPLETE');
      console.log('Missing tables detected. Please:');
      console.log('1. Go to https://supabase.com/dashboard/project/bgrxjdcpxgdunanwtpvv/editor');
      console.log('2. Run the SQL from URGENT-DATABASE-SETUP.md');
      console.log('3. Re-run this verification script');
      return;
    }

    // Test API endpoints
    const apiResults = await testAPIEndpoints();
    
    console.log('\n' + '='.repeat(40));
    
    if (allTablesExist && apiResults.health && apiResults.scenarios && apiResults.dashboard) {
      console.log('🎉 DATABASE FIX SUCCESSFUL!');
      console.log('✅ All tables exist');
      console.log('✅ All API endpoints working');
      console.log('✅ Database connection restored');
      console.log('\n🚀 Your application should now work properly!');
    } else if (apiResults.serverDown) {
      console.log('⚠️ DATABASE FIX COMPLETE - SERVER NOT RUNNING');
      console.log('✅ All tables exist and configured properly');
      console.log('🔄 Please start your server: npm run dev');
    } else {
      console.log('⚠️ PARTIAL SUCCESS');
      console.log(`Database tables: ${allTablesExist ? '✅' : '❌'}`);
      console.log(`API endpoints: ${Object.values(apiResults).some(v => v) ? '⚠️' : '❌'}`);
      console.log('\nSome issues remain. Check server logs for details.');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

main();
#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * Validates that all required environment variables are present and properly formatted
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = {
  // Database connection
  'SUPABASE_URL': {
    required: true,
    pattern: /^https:\/\/[a-z0-9]{20}\.supabase\.co$/,
    description: 'Supabase project URL'
  },
  'SUPABASE_SERVICE_ROLE_KEY': {
    required: true,
    pattern: /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/,
    description: 'Supabase service role key (JWT format)'
  },
  'SUPABASE_ANON_KEY': {
    required: false,
    pattern: /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/,
    description: 'Supabase anonymous key (JWT format)'
  },
  // Client-side variables (if needed)
  'VITE_SUPABASE_URL': {
    required: false,
    pattern: /^https:\/\/[a-z0-9]{20}\.supabase\.co$/,
    description: 'Client-side Supabase URL'
  },
  'VITE_SUPABASE_ANON_KEY': {
    required: false,
    pattern: /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/,
    description: 'Client-side Supabase anonymous key'
  }
};

function validateEnvironment() {
  console.log('🔍 Validating environment variables...\n');
  
  let hasErrors = false;
  let hasWarnings = false;

  for (const [varName, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[varName];
    
    if (!value) {
      if (config.required) {
        console.error(`❌ MISSING REQUIRED: ${varName}`);
        console.error(`   Description: ${config.description}`);
        hasErrors = true;
      } else {
        console.warn(`⚠️  MISSING OPTIONAL: ${varName}`);
        console.warn(`   Description: ${config.description}`);
        hasWarnings = true;
      }
      console.log('');
      continue;
    }

    // Validate pattern
    if (config.pattern && !config.pattern.test(value)) {
      console.error(`❌ INVALID FORMAT: ${varName}`);
      console.error(`   Expected pattern: ${config.pattern}`);
      console.error(`   Description: ${config.description}`);
      hasErrors = true;
    } else {
      const maskedValue = value.length > 20 ? 
        `${value.substring(0, 8)}...${value.substring(value.length - 4)}` : 
        value.substring(0, 8) + '...';
      console.log(`✅ ${varName}: ${maskedValue}`);
    }
    console.log('');
  }

  // Additional checks
  if (process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    if (process.env.SUPABASE_URL !== process.env.VITE_SUPABASE_URL) {
      console.warn('⚠️  SUPABASE_URL and VITE_SUPABASE_URL are different');
      console.warn('   This may cause client/server inconsistencies');
      hasWarnings = true;
    }
  }

  // Summary
  console.log('📋 VALIDATION SUMMARY:');
  if (hasErrors) {
    console.error('❌ Validation FAILED - missing required environment variables');
    process.exit(1);
  } else if (hasWarnings) {
    console.warn('⚠️  Validation PASSED with warnings');
  } else {
    console.log('✅ All environment variables validated successfully');
  }
}

async function testSupabaseConnection() {
  console.log('\n🔗 Testing Supabase connection...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Cannot test connection - missing credentials');
    return;
  }

  try {
    // Test direct REST API access
    const response = await fetch(`${supabaseUrl}/rest/v1/scenarios?limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Supabase connection successful (found ${data.length} scenarios)`);
    } else {
      console.error(`❌ Supabase connection failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`   Error details: ${errorText}`);
    }
  } catch (error) {
    console.error(`❌ Supabase connection error: ${error.message}`);
  }
}

// Main execution
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    validateEnvironment();
    await testSupabaseConnection();
  })();
}

export { validateEnvironment, testSupabaseConnection };
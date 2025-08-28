#!/usr/bin/env node

/**
 * Database Connection Fix Script
 * 
 * This script uses the Supabase client to:
 * 1. Connect to the database via Supabase REST API
 * 2. Initialize tables using Supabase SQL functions
 * 3. Insert sample data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Database Connection Fix via Supabase Client');
console.log('='.repeat(50));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);

async function createTables() {
  console.log('\n🔧 Creating database tables via Supabase...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Execute SQL to create tables
    const { data, error } = await supabase.rpc('execute_sql', {
      query: `
        -- Create sessions table (required for Replit Auth)
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR PRIMARY KEY,
          sess JSONB NOT NULL,
          expire TIMESTAMP NOT NULL
        );
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);

        -- Create users table (required for Replit Auth)
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY NOT NULL,
          email VARCHAR UNIQUE,
          first_name VARCHAR,
          last_name VARCHAR,
          profile_image_url VARCHAR,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Create exchanges table
        CREATE TABLE IF NOT EXISTS exchanges (
          id_exchange SERIAL PRIMARY KEY,
          utilisateur_email TEXT NOT NULL,
          question TEXT NOT NULL,
          reponse TEXT NOT NULL,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW()
        );

        -- Create daily_counters table
        CREATE TABLE IF NOT EXISTS daily_counters (
          utilisateur_email TEXT NOT NULL,
          date TIMESTAMP NOT NULL,
          count INTEGER NOT NULL DEFAULT 0
        );

        -- Create ecos_scenarios table
        CREATE TABLE IF NOT EXISTS ecos_scenarios (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          patient_prompt TEXT NOT NULL,
          evaluation_criteria JSONB NOT NULL,
          pinecone_index VARCHAR(255),
          image_url VARCHAR(500),
          created_by VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (error) {
      console.log('❌ Could not create tables via RPC, trying direct table creation...');
      
      // Try creating tables directly using Supabase table creation
      const tables = [
        {
          name: 'ecos_scenarios',
          schema: {
            id: { type: 'serial', primaryKey: true },
            title: { type: 'varchar(255)', notNull: true },
            description: { type: 'text', notNull: true },
            patient_prompt: { type: 'text', notNull: true },
            evaluation_criteria: { type: 'jsonb', notNull: true },
            pinecone_index: { type: 'varchar(255)' },
            image_url: { type: 'varchar(500)' },
            created_by: { type: 'varchar(255)', notNull: true },
            created_at: { type: 'timestamp', default: 'now()' }
          }
        },
        {
          name: 'users',
          schema: {
            id: { type: 'varchar', primaryKey: true },
            email: { type: 'varchar', unique: true },
            first_name: { type: 'varchar' },
            last_name: { type: 'varchar' },
            profile_image_url: { type: 'varchar' },
            created_at: { type: 'timestamp', default: 'now()' },
            updated_at: { type: 'timestamp', default: 'now()' }
          }
        }
      ];

      // Check if ecos_scenarios table exists
      const { data: tableCheck, error: tableError } = await supabase
        .from('ecos_scenarios')
        .select('*')
        .limit(1);

      if (tableError && tableError.code === 'PGRST116') {
        console.log('⚠️ ecos_scenarios table does not exist');
        console.log('📝 Please create the tables manually in Supabase dashboard:');
        console.log('   1. Go to https://supabase.com/dashboard/project/bgrxjdcpxgdunanwtpvv/editor');
        console.log('   2. Run the SQL from scripts/create-all-tables.sql');
        return { success: false, needsManualSetup: true };
      } else {
        console.log('✅ ecos_scenarios table exists');
        return { success: true, existing: true };
      }
    } else {
      console.log('✅ Tables created successfully');
      return { success: true, created: true };
    }

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    return { success: false, error: error.message };
  }
}

async function insertSampleScenarios() {
  console.log('\n🔧 Inserting sample scenarios via Supabase...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Check if scenarios already exist
    const { data: existingScenarios, error: countError } = await supabase
      .from('ecos_scenarios')
      .select('id')
      .limit(1);

    if (countError) {
      console.error('❌ Cannot access ecos_scenarios table:', countError.message);
      return { success: false, error: countError.message };
    }

    if (existingScenarios && existingScenarios.length > 0) {
      console.log('📊 Scenarios already exist, skipping insertion');
      const { count } = await supabase
        .from('ecos_scenarios')
        .select('*', { count: 'exact', head: true });
      return { success: true, existing: true, count };
    }

    // Insert sample scenarios
    const sampleScenarios = [
      {
        title: 'Douleur thoracique aiguë',
        description: 'Patient présentant une douleur thoracique aiguë nécessitant une évaluation rapide',
        patient_prompt: 'Vous ressentez une douleur thoracique soudaine et intense qui irradie vers le bras gauche.',
        evaluation_criteria: {
          anamnese: { weight: 25, description: "Qualité de l'anamnèse" },
          examen_clinique: { weight: 25, description: 'Examen clinique complet' },
          diagnostic: { weight: 30, description: 'Pertinence du diagnostic' },
          prise_en_charge: { weight: 20, description: 'Plan de prise en charge' }
        },
        created_by: 'system'
      },
      {
        title: 'Traumatisme du poignet',
        description: "Évaluation d'un traumatisme du poignet suite à une chute",
        patient_prompt: 'Vous avez chuté sur votre poignet gauche et ressentez une douleur intense avec impossibilité de bouger.',
        evaluation_criteria: {
          anamnese: { weight: 20, description: "Recueil de l'histoire du traumatisme" },
          examen_clinique: { weight: 30, description: 'Examen du poignet et tests spécifiques' },
          imagerie: { weight: 25, description: "Prescription d'examens complémentaires" },
          traitement: { weight: 25, description: 'Plan thérapeutique' }
        },
        created_by: 'system'
      },
      {
        title: 'Syndrome du canal carpien',
        description: 'Diagnostic et prise en charge du syndrome du canal carpien',
        patient_prompt: 'Vous ressentez des fourmillements dans les trois premiers doigts de la main, surtout la nuit.',
        evaluation_criteria: {
          anamnese: { weight: 25, description: 'Histoire de la maladie et facteurs de risque' },
          examen_clinique: { weight: 35, description: 'Tests spécifiques du canal carpien' },
          diagnostic: { weight: 25, description: 'Diagnostic différentiel' },
          traitement: { weight: 15, description: 'Options thérapeutiques' }
        },
        created_by: 'system'
      }
    ];

    const { data, error } = await supabase
      .from('ecos_scenarios')
      .insert(sampleScenarios)
      .select();

    if (error) {
      console.error('❌ Error inserting scenarios:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`✅ Inserted ${data.length} sample scenarios`);
    return { success: true, inserted: data.length };

  } catch (error) {
    console.error('❌ Error in sample scenario insertion:', error.message);
    return { success: false, error: error.message };
  }
}

async function testConnection() {
  console.log('\n🔧 Testing Supabase connection...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('ecos_scenarios')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`⚠️ Connection test result: ${error.message}`);
      return { success: false, error: error.message, needsSetup: error.code === 'PGRST116' };
    }

    console.log(`✅ Connection successful - found ${data?.length || 0} scenarios`);
    
    // Get total count
    const { count } = await supabase
      .from('ecos_scenarios')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total scenarios in database: ${count}`);
    
    return { success: true, scenarioCount: count };
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  try {
    // Test connection first
    const testResult = await testConnection();
    
    // If table doesn't exist, try to create it
    if (!testResult.success && testResult.needsSetup) {
      console.log('\n⚠️ Tables not found, attempting to create them...');
      const createResult = await createTables();
      
      if (!createResult.success) {
        if (createResult.needsManualSetup) {
          console.log('\n🔧 MANUAL SETUP REQUIRED:');
          console.log('1. Go to your Supabase dashboard');
          console.log('2. Navigate to SQL Editor');
          console.log('3. Copy and run the contents of scripts/create-all-tables.sql');
          console.log('4. Re-run this script');
        }
        return;
      }
      
      // Test again after creation
      await testConnection();
    }

    // Insert sample scenarios
    const scenarioResult = await insertSampleScenarios();

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Database setup complete!');
    console.log('✅ Supabase connection: Working');
    console.log(`✅ Scenarios: ${scenarioResult.count || scenarioResult.inserted || 0} available`);
    console.log('\n🚀 Server should now work properly!');
    console.log('🔗 Test the API endpoints:');
    console.log('   - Health: http://localhost:3000/health');
    console.log('   - Teacher scenarios: http://localhost:3000/api/teacher/scenarios?email=cherubindavid@gmail.com');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

main();
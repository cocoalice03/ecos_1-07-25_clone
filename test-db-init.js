#!/usr/bin/env node

/**
 * Database Connection Test and Initialization Script
 * 
 * This script:
 * 1. Tests the database connection with new Supabase credentials
 * 2. Checks if tables exist
 * 3. Runs initialization scripts if needed
 * 4. Inserts sample scenarios for testing
 */

import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Database Connection and Initialization Test');
console.log('='.repeat(50));

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not found');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`📊 Database URL: ${DATABASE_URL.replace(/:[^:@]*@/, ':***@')}`);
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);

async function testDirectConnection() {
  console.log('\n🔧 Testing direct PostgreSQL connection...');
  
  try {
    // Force IPv4 by replacing hostname
    const dbUrl = DATABASE_URL.replace('db.bgrxjdcpxgdunanwtpvv.supabase.co', '3.7.84.111');
    console.log(`🔄 Using IPv4 address to bypass IPv6 issues...`);
    
    const client = postgres(dbUrl, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      idle_timeout: 30,
      connect_timeout: 10
    });

    // Test basic connection
    const result = await client`SELECT NOW() as current_time, version() as pg_version`;
    console.log('✅ Direct PostgreSQL connection successful');
    console.log(`📊 Server time: ${result[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result[0].pg_version.split(' ')[0]}`);

    // Check if tables exist
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log(`\n📋 Found ${tables.length} tables in public schema:`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    await client.end();
    return { success: true, tablesExist: tables.length > 0, tableCount: tables.length };
  } catch (error) {
    console.error('❌ Direct PostgreSQL connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testSupabaseClient() {
  console.log('\n🔧 Testing Supabase client connection...');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️ Supabase credentials not available, skipping client test');
    return { success: false, error: 'Missing Supabase credentials' };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Test connection with a simple query
    const { data, error } = await supabase
      .from('ecos_scenarios')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`⚠️ Supabase query failed: ${error.message}`);
      // This might be expected if tables don't exist yet
      return { success: false, error: error.message };
    }

    console.log('✅ Supabase client connection successful');
    console.log(`📊 Found ${data?.length || 0} scenarios`);
    return { success: true, scenarioCount: data?.length || 0 };
  } catch (error) {
    console.error('❌ Supabase client connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function initializeDatabase() {
  console.log('\n🔧 Initializing database tables...');
  
  try {
    // Force IPv4 by replacing hostname
    const dbUrl = DATABASE_URL.replace('db.bgrxjdcpxgdunanwtpvv.supabase.co', '3.7.84.111');
    
    const client = postgres(dbUrl, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      idle_timeout: 30,
      connect_timeout: 10
    });

    // Read and execute the table creation script
    const sqlScript = fs.readFileSync(path.join(__dirname, 'scripts', 'create-all-tables.sql'), 'utf8');
    
    console.log('📝 Executing table creation script...');
    await client.unsafe(sqlScript);
    
    console.log('✅ Tables created successfully');

    // Check tables again after creation
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log(`📋 After initialization: ${tables.length} tables exist:`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

    await client.end();
    return { success: true, tablesCreated: tables.length };
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function insertSampleScenarios() {
  console.log('\n🔧 Inserting sample scenarios...');
  
  try {
    // Force IPv4 by replacing hostname
    const dbUrl = DATABASE_URL.replace('db.bgrxjdcpxgdunanwtpvv.supabase.co', '3.7.84.111');
    
    const client = postgres(dbUrl, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      idle_timeout: 30,
      connect_timeout: 10
    });

    // Check if scenarios already exist
    const existingScenarios = await client`SELECT COUNT(*) as count FROM ecos_scenarios`;
    const scenarioCount = parseInt(existingScenarios[0].count);
    
    if (scenarioCount > 0) {
      console.log(`📊 Found ${scenarioCount} existing scenarios, skipping sample data insertion`);
      await client.end();
      return { success: true, existing: true, count: scenarioCount };
    }

    // Insert sample scenarios
    const sampleScenarios = [
      {
        title: 'Douleur thoracique aiguë',
        description: 'Patient présentant une douleur thoracique aiguë nécessitant une évaluation rapide',
        patient_prompt: 'Vous ressentez une douleur thoracique soudaine et intense qui irradie vers le bras gauche.',
        evaluation_criteria: JSON.stringify({
          anamnese: { weight: 25, description: 'Qualité de l\'anamnèse' },
          examen_clinique: { weight: 25, description: 'Examen clinique complet' },
          diagnostic: { weight: 30, description: 'Pertinence du diagnostic' },
          prise_en_charge: { weight: 20, description: 'Plan de prise en charge' }
        }),
        created_by: 'system'
      },
      {
        title: 'Traumatisme du poignet',
        description: 'Évaluation d\'un traumatisme du poignet suite à une chute',
        patient_prompt: 'Vous avez chuté sur votre poignet gauche et ressentez une douleur intense avec impossibilité de bouger.',
        evaluation_criteria: JSON.stringify({
          anamnese: { weight: 20, description: 'Recueil de l\'histoire du traumatisme' },
          examen_clinique: { weight: 30, description: 'Examen du poignet et tests spécifiques' },
          imagerie: { weight: 25, description: 'Prescription d\'examens complémentaires' },
          traitement: { weight: 25, description: 'Plan thérapeutique' }
        }),
        created_by: 'system'
      },
      {
        title: 'Syndrome du canal carpien',
        description: 'Diagnostic et prise en charge du syndrome du canal carpien',
        patient_prompt: 'Vous ressentez des fourmillements dans les trois premiers doigts de la main, surtout la nuit.',
        evaluation_criteria: JSON.stringify({
          anamnese: { weight: 25, description: 'Histoire de la maladie et facteurs de risque' },
          examen_clinique: { weight: 35, description: 'Tests spécifiques du canal carpien' },
          diagnostic: { weight: 25, description: 'Diagnostic différentiel' },
          traitement: { weight: 15, description: 'Options thérapeutiques' }
        }),
        created_by: 'system'
      }
    ];

    for (const scenario of sampleScenarios) {
      await client`
        INSERT INTO ecos_scenarios (title, description, patient_prompt, evaluation_criteria, created_by)
        VALUES (${scenario.title}, ${scenario.description}, ${scenario.patient_prompt}, ${scenario.evaluation_criteria}, ${scenario.created_by})
      `;
    }

    console.log(`✅ Inserted ${sampleScenarios.length} sample scenarios`);
    
    // Verify insertion
    const finalCount = await client`SELECT COUNT(*) as count FROM ecos_scenarios`;
    console.log(`📊 Total scenarios in database: ${finalCount[0].count}`);

    await client.end();
    return { success: true, inserted: sampleScenarios.length, total: parseInt(finalCount[0].count) };
  } catch (error) {
    console.error('❌ Sample scenario insertion failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  try {
    // Test direct connection
    const directResult = await testDirectConnection();
    
    if (!directResult.success) {
      console.error('\n❌ Cannot proceed without database connection');
      process.exit(1);
    }

    // If no tables exist, initialize database
    if (!directResult.tablesExist) {
      console.log('\n⚠️ No tables found, initializing database...');
      const initResult = await initializeDatabase();
      
      if (!initResult.success) {
        console.error('❌ Database initialization failed');
        process.exit(1);
      }
    } else {
      console.log('\n✅ Database tables already exist');
    }

    // Test Supabase client
    await testSupabaseClient();

    // Insert sample scenarios if none exist
    const scenarioResult = await insertSampleScenarios();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Database initialization complete!');
    console.log('✅ Database connection: Working');
    console.log(`✅ Tables: ${directResult.tableCount || 'Unknown'} tables exist`);
    if (scenarioResult.success) {
      console.log(`✅ Scenarios: ${scenarioResult.total || scenarioResult.count} scenarios available`);
    }
    console.log('\n🚀 Server should now work properly with the new database');
    console.log('🔗 Test the API endpoints at: http://localhost:3000/health');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

main();
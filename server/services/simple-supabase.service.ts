import postgres from 'postgres';

export class SimpleSupabaseService {
  private sql: any = null;
  
  async connect(): Promise<void> {
    if (this.sql) return;
    
    try {
      console.log('🔧 Connecting to Supabase database...');
      
      // Direct connection with explicit configuration
      this.sql = postgres('postgresql://postgres:ceerrfbeaujon@db.zateicubgktisdtnihiu.supabase.co:5432/postgres', {
        ssl: { rejectUnauthorized: false },
        max: 5,
        connect_timeout: 60,
        idle_timeout: 60,
        prepare: false,
      });
      
      // Test connection
      await this.sql`SELECT 1`;
      console.log('✅ Connected to Supabase successfully');
    } catch (error: any) {
      console.error('❌ Supabase connection failed:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }
  
  async getScenarios(): Promise<any[]> {
    await this.connect();
    
    try {
      const scenarios = await this.sql`
        SELECT 
          id, 
          title, 
          description, 
          patient_prompt as "patientPrompt",
          evaluation_criteria as "evaluationCriteria",
          image_url as "imageUrl",
          created_by as "createdBy",
          created_at as "createdAt"
        FROM ecos_scenarios 
        ORDER BY created_at DESC
      `;
      
      console.log(`✅ Retrieved ${scenarios.length} scenarios from database`);
      return scenarios;
    } catch (error: any) {
      console.error('❌ Failed to fetch scenarios:', error.message);
      throw new Error(`Scenario retrieval failed: ${error.message}`);
    }
  }
  
  async testConnection(): Promise<void> {
    await this.connect();
    
    const result = await this.sql`SELECT version()`;
    console.log('PostgreSQL version:', result[0].version.substring(0, 50));
  }
  
  async close(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
      this.sql = null;
    }
  }
}

export const simpleSupabaseService = new SimpleSupabaseService();
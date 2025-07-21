import postgres from 'postgres';

export class DirectDBConnectionService {
  private sql: any;
  
  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }
    
    // Create a direct connection with more aggressive settings
    this.sql = postgres(process.env.DATABASE_URL, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      connect_timeout: 120, // 2 minutes
      idle_timeout: 120,
      max_lifetime: 60 * 10, // 10 minutes
      prepare: false,
      onnotice: () => {},
      transform: {
        column: {
          from: postgres.camel,
          to: postgres.camel,
        },
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🔧 Testing direct database connection...');
      const result = await this.sql`SELECT version() as version`;
      console.log('✅ Direct database connection successful');
      console.log('PostgreSQL version:', result[0].version.substring(0, 50) + '...');
      return true;
    } catch (error: any) {
      console.error('❌ Direct database connection failed:', error.message);
      return false;
    }
  }

  async getScenarios(): Promise<any[]> {
    try {
      console.log('🔍 Fetching scenarios from database...');
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
      
      console.log(`✅ Found ${scenarios.length} scenarios in database`);
      return scenarios;
    } catch (error: any) {
      console.error('❌ Error fetching scenarios:', error.message);
      throw error;
    }
  }

  async insertScenario(scenario: {
    title: string;
    description: string;
    patientPrompt: string;
    evaluationCriteria?: any;
    imageUrl?: string;
    createdBy?: string;
  }): Promise<number> {
    try {
      const result = await this.sql`
        INSERT INTO ecos_scenarios (
          title, 
          description, 
          patient_prompt, 
          evaluation_criteria, 
          image_url, 
          created_by
        ) VALUES (
          ${scenario.title},
          ${scenario.description}, 
          ${scenario.patientPrompt},
          ${JSON.stringify(scenario.evaluationCriteria || {})},
          ${scenario.imageUrl || null},
          ${scenario.createdBy || 'system'}
        )
        RETURNING id
      `;
      
      console.log(`✅ Inserted scenario: ${scenario.title}`);
      return result[0].id;
    } catch (error: any) {
      console.error('❌ Error inserting scenario:', error.message);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
    }
  }
}

export const directDBService = new DirectDBConnectionService();
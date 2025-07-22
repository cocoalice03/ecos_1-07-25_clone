import { Client } from 'pg';

export class DirectUrlSupabaseService {
  private client: Client | null = null;
  private isConnected: boolean = false;
  
  async connect(): Promise<void> {
    if (this.isConnected && this.client) return;
    
    console.log('🔧 Attempting direct URL connection to Supabase...');
    
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }
      
      console.log('🔌 Using direct connection URL');
      
      this.client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
      });
      
      await this.client.connect();
      
      // Test the connection
      const result = await this.client.query('SELECT 1');
      console.log('✅ Connected to Supabase successfully!');
      this.isConnected = true;
    } catch (error: any) {
      console.error('❌ Direct URL connection failed:', error.message);
      
      // Try alternative connection methods
      if (error.code === 'ENOTFOUND' || error.code === 'EADDRNOTAVAIL') {
        console.log('🔧 DNS resolution failed, trying with pooler endpoint...');
        await this.connectWithPooler();
      } else {
        throw error;
      }
    }
  }
  
  private async connectWithPooler(): Promise<void> {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }
      
      // Transform the direct connection URL to use the pooler endpoint
      const poolerUrl = databaseUrl.replace('5432/postgres', '6543/postgres');
      console.log('🔌 Trying pooler connection...');
      
      this.client = new Client({
        connectionString: poolerUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
      });
      
      await this.client.connect();
      
      // Test the connection
      const result = await this.client.query('SELECT 1');
      console.log('✅ Connected to Supabase via pooler!');
      this.isConnected = true;
    } catch (error: any) {
      console.error('❌ Pooler connection also failed:', error.message);
      throw new Error('All connection methods failed');
    }
  }
  
  async getScenarios(): Promise<any[]> {
    await this.connect();
    
    if (!this.client) throw new Error('No database connection');
    
    try {
      const result = await this.client.query(`
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
      `);
      
      console.log(`✅ Retrieved ${result.rows.length} scenarios from database`);
      return result.rows;
    } catch (error: any) {
      console.error('❌ Error fetching scenarios:', error.message);
      
      // If table doesn't exist, return empty array
      if (error.message.includes('does not exist')) {
        console.log('⚠️ Scenarios table does not exist yet');
        return [];
      }
      
      throw error;
    }
  }
  
  async createScenario(scenarioData: any): Promise<any> {
    await this.connect();
    
    if (!this.client) throw new Error('No database connection');
    
    try {
      const result = await this.client.query(
        `INSERT INTO ecos_scenarios (
          title, 
          description, 
          patient_prompt, 
          evaluation_criteria, 
          image_url, 
          created_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          scenarioData.title,
          scenarioData.description,
          scenarioData.patientPrompt,
          scenarioData.evaluationCriteria,
          scenarioData.imageUrl || null,
          scenarioData.createdBy,
          new Date()
        ]
      );
      
      return result.rows[0];
    } catch (error: any) {
      console.error('❌ Error creating scenario:', error.message);
      throw error;
    }
  }
  
  async updateScenario(id: string, updates: any): Promise<any> {
    await this.connect();
    
    if (!this.client) throw new Error('No database connection');
    
    try {
      const result = await this.client.query(
        `UPDATE ecos_scenarios SET
          title = COALESCE($2, title),
          description = COALESCE($3, description),
          patient_prompt = COALESCE($4, patient_prompt),
          evaluation_criteria = COALESCE($5, evaluation_criteria),
          image_url = COALESCE($6, image_url),
          updated_at = $7
        WHERE id = $1
        RETURNING *`,
        [
          id,
          updates.title,
          updates.description,
          updates.patientPrompt,
          updates.evaluationCriteria,
          updates.imageUrl,
          new Date()
        ]
      );
      
      return result.rows[0];
    } catch (error: any) {
      console.error('❌ Error updating scenario:', error.message);
      throw error;
    }
  }
  
  async deleteScenario(id: string): Promise<void> {
    await this.connect();
    
    if (!this.client) throw new Error('No database connection');
    
    try {
      await this.client.query('DELETE FROM ecos_scenarios WHERE id = $1', [id]);
    } catch (error: any) {
      console.error('❌ Error deleting scenario:', error.message);
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.isConnected = false;
    }
  }
}
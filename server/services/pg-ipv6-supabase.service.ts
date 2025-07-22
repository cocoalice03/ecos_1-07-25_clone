import { Client } from 'pg';

export class PgIPv6SupabaseService {
  private client: Client | null = null;
  private isConnected: boolean = false;
  
  private extractPasswordFromDatabaseUrl(): string {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');
    const match = dbUrl.match(/postgresql:\/\/[^:]+:([^@]+)@/);
    if (!match || !match[1]) throw new Error('Could not extract password from DATABASE_URL');
    return match[1];
  }
  
  async connect(): Promise<void> {
    if (this.isConnected && this.client) return;
    
    console.log('🔧 Attempting IPv6 connection to Supabase with pg client...');
    
    try {
      const password = this.extractPasswordFromDatabaseUrl();
      const ipv6Address = '2a05:d012:42e:5708:6587:d1da:68cb:40dc';
      
      console.log(`🔌 Connecting to IPv6 address: ${ipv6Address}`);
      
      this.client = new Client({
        host: ipv6Address,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
      });
      
      await this.client.connect();
      
      // Test the connection
      const result = await this.client.query('SELECT 1');
      console.log('✅ Connected to Supabase via IPv6!');
      this.isConnected = true;
    } catch (error: any) {
      console.error('❌ IPv6 connection failed:', error.message);
      throw error;
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
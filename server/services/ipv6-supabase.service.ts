import postgres from 'postgres';

export class IPv6SupabaseService {
  private sql: any = null;
  private isConnected: boolean = false;
  
  private extractPasswordFromDatabaseUrl(): string {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');
    const match = dbUrl.match(/postgresql:\/\/[^:]+:([^@]+)@/);
    if (!match || !match[1]) throw new Error('Could not extract password from DATABASE_URL');
    return match[1];
  }
  
  async connect(): Promise<void> {
    if (this.isConnected && this.sql) return;
    
    console.log('🔧 Attempting IPv6 connection to Supabase...');
    
    try {
      const password = this.extractPasswordFromDatabaseUrl();
      // Use the IPv6 address we discovered
      const ipv6Address = '2a05:d012:42e:5708:6587:d1da:68cb:40dc';
      
      // For IPv6, we need to use configuration object instead of URL
      console.log(`🔌 Connecting to IPv6 address: [${ipv6Address}]`);
      
      this.sql = postgres({
        host: ipv6Address,
        port: 5432,
        database: 'postgres',
        username: 'postgres',
        password: password,
        ssl: { rejectUnauthorized: false },
        max: 5,
        connect_timeout: 30,
        idle_timeout: 60,
        prepare: false,
      });
      
      // Test the connection
      await this.sql`SELECT 1`;
      console.log('✅ Connected to Supabase via IPv6!');
      this.isConnected = true;
    } catch (error: any) {
      console.error('❌ IPv6 connection failed:', error.message);
      throw error;
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
      console.error('❌ Error fetching scenarios:', error.message);
      throw error;
    }
  }
  
  async createScenario(scenarioData: any): Promise<any> {
    await this.connect();
    
    try {
      const [scenario] = await this.sql`
        INSERT INTO ecos_scenarios (
          title, 
          description, 
          patient_prompt, 
          evaluation_criteria, 
          image_url, 
          created_by,
          created_at
        ) VALUES (
          ${scenarioData.title},
          ${scenarioData.description},
          ${scenarioData.patientPrompt},
          ${scenarioData.evaluationCriteria},
          ${scenarioData.imageUrl || null},
          ${scenarioData.createdBy},
          ${new Date()}
        ) RETURNING *
      `;
      
      return scenario;
    } catch (error: any) {
      console.error('❌ Error creating scenario:', error.message);
      throw error;
    }
  }
  
  async updateScenario(id: string, updates: any): Promise<any> {
    await this.connect();
    
    try {
      const [scenario] = await this.sql`
        UPDATE ecos_scenarios SET
          title = COALESCE(${updates.title}, title),
          description = COALESCE(${updates.description}, description),
          patient_prompt = COALESCE(${updates.patientPrompt}, patient_prompt),
          evaluation_criteria = COALESCE(${updates.evaluationCriteria}, evaluation_criteria),
          image_url = COALESCE(${updates.imageUrl}, image_url),
          updated_at = ${new Date()}
        WHERE id = ${id}
        RETURNING *
      `;
      
      return scenario;
    } catch (error: any) {
      console.error('❌ Error updating scenario:', error.message);
      throw error;
    }
  }
  
  async deleteScenario(id: string): Promise<void> {
    await this.connect();
    
    try {
      await this.sql`DELETE FROM ecos_scenarios WHERE id = ${id}`;
    } catch (error: any) {
      console.error('❌ Error deleting scenario:', error.message);
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
      this.sql = null;
      this.isConnected = false;
    }
  }
}
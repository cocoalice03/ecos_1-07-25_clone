import postgres from 'postgres';

function extractHostFromDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || '';
  const match = url.match(/postgresql:\/\/[^@]+@([^:]+):/);
  return match ? match[1] : 'localhost';
}

function extractPasswordFromDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || '';
  const match = url.match(/postgresql:\/\/postgres:([^@]+)@/);
  return match ? match[1] : '';
}

export class DirectSupabaseService {
  private sql: any;
  private isInitialized: boolean = false;
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🔧 Initializing direct Supabase connection...');
      
      // Direct connection configuration using object format to avoid URL parsing issues
      const connectionOptions = [
        {
          name: 'IPv6 direct connection',
          host: '2a05:d012:42e:5708:6587:d1da:68cb:40dc',
          port: 5432,
          database: 'postgres',
          username: 'postgres',
          password: 'ceerrfbeaujon'
        },
        {
          name: 'Hostname direct connection',
          host: process.env.SUPABASE_DB_HOST || extractHostFromDatabaseUrl(),
          port: 5432,
          database: 'postgres',
          username: 'postgres',
          password: process.env.SUPABASE_DB_PASSWORD || extractPasswordFromDatabaseUrl()
        }
      ];
      
      let connectionEstablished = false;
      
      for (const option of connectionOptions) {
        try {
          console.log(`🔧 Trying ${option.name}...`);
          
          const sql = postgres({
            host: option.host,
            port: 5432,
            database: 'postgres',
            username: 'postgres',
            password: 'ceerrfbeaujon',
            ssl: { rejectUnauthorized: false },
            max: 10,
            connect_timeout: 30,
            idle_timeout: 60,
            max_lifetime: 60 * 30,
            prepare: false,
            onnotice: () => {},
            transform: { undefined: null },
          });
          
          this.sql = sql;
          
          // Test the connection
          await this.sql`SELECT 1`;
          console.log(`✅ Successfully connected to Supabase via ${option.name}`);
          connectionEstablished = true;
          break;
        } catch (connError: any) {
          console.log(`❌ Failed to connect via ${option.name}: ${connError.message}`);
          if (this.sql) {
            try { await this.sql.end(); } catch {}
          }
        }
      }
      
      if (!connectionEstablished) {
        throw new Error('Unable to establish connection to any Supabase server');
      }
      
      this.isInitialized = true;
      console.log('✅ Supabase service initialized successfully');
    } catch (error: any) {
      console.error('❌ Failed to initialize Supabase service:', error.message);
      throw error;
    }
  }

  async testConnection(): Promise<void> {
    try {
      await this.initialize();
      console.log('🔧 Testing direct Supabase connection...');
      const result = await this.sql`SELECT version()`;
      console.log('✅ Connexion Supabase réussie');
      console.log('PostgreSQL version:', result[0].version.substring(0, 50));
    } catch (error: any) {
      console.error('❌ Erreur de connexion Supabase:', error.message);
      throw new Error(`Impossible de se connecter à Supabase: ${error.message}`);
    }
  }

  async getScenarios(): Promise<any[]> {
    try {
      await this.initialize();
      console.log('🔍 Récupération des scénarios depuis Supabase...');
      
      const scenarios = await this.sql`
        SELECT 
          id, 
          title, 
          description, 
          patient_prompt as "patientPrompt",
          evaluation_criteria as "evaluationCriteria",
          image_url as "imageUrl",
          created_by as "createdBy",
          created_at as "createdAt",
          pinecone_index as "pineconeIndex"
        FROM ecos_scenarios 
        ORDER BY created_at DESC
      `;
      
      console.log(`✅ ${scenarios.length} scénarios trouvés dans Supabase`);
      return scenarios;
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des scénarios:', error.message);
      throw new Error(`Échec de récupération des scénarios: ${error.message}`);
    }
  }

  async createScenario(scenarioData: {
    title: string;
    description: string;
    patientPrompt: string;
    evaluationCriteria?: any;
    imageUrl?: string;
    createdBy?: string;
    pineconeIndex?: string;
  }): Promise<number> {
    try {
      const result = await this.sql`
        INSERT INTO ecos_scenarios (
          title, 
          description, 
          patient_prompt, 
          evaluation_criteria, 
          image_url, 
          created_by,
          pinecone_index
        ) VALUES (
          ${scenarioData.title},
          ${scenarioData.description}, 
          ${scenarioData.patientPrompt},
          ${JSON.stringify(scenarioData.evaluationCriteria || {})},
          ${scenarioData.imageUrl || null},
          ${scenarioData.createdBy || 'system'},
          ${scenarioData.pineconeIndex || null}
        )
        RETURNING id
      `;
      
      console.log(`✅ Scénario créé: ${scenarioData.title}`);
      return result[0].id;
    } catch (error: any) {
      console.error('❌ Erreur lors de la création du scénario:', error.message);
      throw new Error(`Échec de création du scénario: ${error.message}`);
    }
  }

  async getScenarioById(id: number): Promise<any | null> {
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
          created_at as "createdAt",
          pinecone_index as "pineconeIndex"
        FROM ecos_scenarios 
        WHERE id = ${id}
      `;
      
      return scenarios[0] || null;
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération du scénario:', error.message);
      throw new Error(`Échec de récupération du scénario: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
    }
  }
}

export const directSupabaseService = new DirectSupabaseService();
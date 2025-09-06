import { Client } from 'pg';
export class AlternativeSupabaseService {
    client = null;
    isConnected = false;
    extractPasswordFromDatabaseUrl() {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl)
            throw new Error('DATABASE_URL not set');
        const match = dbUrl.match(/postgresql:\/\/[^:]+:([^@]+)@/);
        if (!match || !match[1])
            throw new Error('Could not extract password from DATABASE_URL');
        return match[1];
    }
    extractHostFromDatabaseUrl() {
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl)
            throw new Error('DATABASE_URL not set');
        const match = dbUrl.match(/postgresql:\/\/[^@]+@([^:\/]+)/);
        if (!match || !match[1])
            throw new Error('Could not extract host from DATABASE_URL');
        return match[1];
    }
    async connect() {
        if (this.isConnected && this.client)
            return;
        console.log('🔧 Attempting alternative PostgreSQL connection...');
        // Try with pg client directly using different connection approaches
        const connectionConfigs = [
            {
                host: this.extractHostFromDatabaseUrl(),
                port: 5432,
                database: 'postgres',
                user: 'postgres',
                password: this.extractPasswordFromDatabaseUrl(),
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 10000,
            },
            {
                connectionString: process.env.DATABASE_URL,
                connectionTimeoutMillis: 10000,
            }
        ];
        for (let i = 0; i < connectionConfigs.length; i++) {
            try {
                console.log(`🔧 Trying connection method ${i + 1}...`);
                this.client = new Client(connectionConfigs[i]);
                await this.client.connect();
                // Test the connection
                const result = await this.client.query('SELECT 1');
                if (result.rows.length > 0) {
                    console.log(`✅ Connected via method ${i + 1}`);
                    this.isConnected = true;
                    return;
                }
            }
            catch (error) {
                console.log(`❌ Method ${i + 1} failed: ${error.message}`);
                if (this.client) {
                    try {
                        await this.client.end();
                    }
                    catch { }
                    this.client = null;
                }
            }
        }
        throw new Error('All PostgreSQL connection methods failed');
    }
    async getScenarios() {
        await this.connect();
        if (!this.client)
            throw new Error('No database connection');
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
        }
        catch (error) {
            console.error('❌ Failed to fetch scenarios:', error.message);
            throw new Error(`Scenario retrieval failed: ${error.message}`);
        }
    }
    async testConnection() {
        await this.connect();
        if (!this.client)
            throw new Error('No database connection');
        const result = await this.client.query('SELECT version()');
        console.log('PostgreSQL version:', result.rows[0].version.substring(0, 50));
    }
    async close() {
        if (this.client) {
            await this.client.end();
            this.client = null;
            this.isConnected = false;
        }
    }
}
export const alternativeSupabaseService = new AlternativeSupabaseService();

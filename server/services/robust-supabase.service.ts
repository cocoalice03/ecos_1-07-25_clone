import postgres from 'postgres';
import { promisify } from 'util';
import { lookup } from 'dns';

const dnsLookup = promisify(lookup);

export class RobustSupabaseService {
  private sql: any = null;
  private isConnected: boolean = false;
  
  async connect(): Promise<void> {
    if (this.isConnected && this.sql) return;
    
    console.log('🔧 Attempting robust Supabase connection...');
    
    const connectionStrategies = [
      {
        name: 'Direct URL with custom DNS',
        method: () => this.connectWithCustomDNS()
      },
      {
        name: 'IPv4 forced connection', 
        method: () => this.connectWithIPv4()
      },
      {
        name: 'Manual IP resolution',
        method: () => this.connectWithManualIP()
      }
    ];
    
    for (const strategy of connectionStrategies) {
      try {
        console.log(`🔧 Trying ${strategy.name}...`);
        await strategy.method();
        
        // Test the connection
        await this.sql`SELECT 1`;
        console.log(`✅ Connected via ${strategy.name}`);
        this.isConnected = true;
        return;
      } catch (error: any) {
        console.log(`❌ ${strategy.name} failed: ${error.message}`);
        if (this.sql) {
          try { await this.sql.end(); } catch {}
          this.sql = null;
        }
      }
    }
    
    throw new Error('All connection strategies failed');
  }
  
  private async connectWithCustomDNS(): Promise<void> {
    // Try to resolve with custom DNS
    try {
      const resolved = await dnsLookup('db.zateicubgktisdtnihiu.supabase.co', { family: 4 });
      console.log(`🔍 Resolved to IPv4: ${resolved.address}`);
      
      this.sql = postgres(`postgresql://postgres:ceerrfbeaujon@${resolved.address}:5432/postgres`, {
        ssl: { rejectUnauthorized: false },
        max: 5,
        connect_timeout: 30,
        prepare: false,
      });
    } catch (error) {
      throw new Error(`DNS resolution failed: ${error.message}`);
    }
  }
  
  private async connectWithIPv4(): Promise<void> {
    // Direct connection forcing IPv4
    this.sql = postgres('postgresql://postgres:ceerrfbeaujon@db.zateicubgktisdtnihiu.supabase.co:5432/postgres', {
      ssl: { rejectUnauthorized: false },
      max: 5,
      connect_timeout: 30,
      prepare: false,
      family: 4, // Force IPv4
    });
  }
  
  private async connectWithManualIP(): Promise<void> {
    // Use known Supabase IP ranges (AWS us-west-1)
    const knownIPs = [
      '54.215.226.166',  // Common Supabase IP
      '13.56.147.173',   // Alternative Supabase IP
      '52.8.112.93',     // Another Supabase IP
    ];
    
    for (const ip of knownIPs) {
      try {
        console.log(`🔧 Trying IP: ${ip}`);
        this.sql = postgres(`postgresql://postgres:ceerrfbeaujon@${ip}:5432/postgres`, {
          ssl: { rejectUnauthorized: false },
          max: 5,
          connect_timeout: 10,
          prepare: false,
        });
        
        // Quick test
        await this.sql`SELECT 1`;
        console.log(`✅ IP ${ip} works!`);
        return;
      } catch (error) {
        console.log(`❌ IP ${ip} failed`);
        if (this.sql) {
          try { await this.sql.end(); } catch {}
          this.sql = null;
        }
      }
    }
    
    throw new Error('No working IP found');
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
      
      console.log(`✅ Retrieved ${scenarios.length} scenarios from Supabase`);
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
      this.isConnected = false;
    }
  }
}

export const robustSupabaseService = new RobustSupabaseService();
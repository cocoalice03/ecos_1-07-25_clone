import { createClient } from '@supabase/supabase-js';

// Alternative connection methods to try different approaches
export class AlternativeConnectionService {
  private attempts: Array<{ method: string; success: boolean; error?: string }> = [];

  async tryConnectionMethods(): Promise<{ success: boolean; scenarios?: any[]; attempts: any[] }> {
    // Method 1: Try direct Supabase client
    try {
      console.log('🔧 Attempting Method 1: Direct Supabase client...');
      
      // Extract URL components to try direct connection  
      const dbUrl = process.env.DATABASE_URL || '';
      const match = dbUrl.match(/postgresql:\/\/postgres:([^@]+)@([^:]+):(\d+)\/(.+)/);
      
      if (match) {
        const [, password, host, port, database] = match;
        const supabaseUrl = `https://${host.replace('db.', '')}.supabase.co`;
        
        // Try to construct Supabase client
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
          
          const { data, error } = await supabase
            .from('ecos_scenarios')
            .select('*')
            .limit(5);
          
          if (!error && data) {
            this.attempts.push({ method: 'Supabase Client', success: true });
            console.log('✅ Method 1 successful - found scenarios via Supabase client');
            return { success: true, scenarios: data, attempts: this.attempts };
          }
        }
      }
      
      this.attempts.push({ method: 'Supabase Client', success: false, error: 'Configuration issue' });
    } catch (error: any) {
      this.attempts.push({ method: 'Supabase Client', success: false, error: error.message });
    }

    // Method 2: Try alternative postgres connection
    try {
      console.log('🔧 Attempting Method 2: Alternative postgres config...');
      
      const postgres = require('postgres');
      const sql = postgres(process.env.DATABASE_URL, {
        ssl: false, // Try without SSL first
        host: 'localhost', // Try localhost tunnel
        prepare: false,
        connect_timeout: 10,
      });

      const result = await sql`SELECT * FROM ecos_scenarios LIMIT 3`;
      await sql.end();
      
      this.attempts.push({ method: 'Postgres Alternative', success: true });
      console.log('✅ Method 2 successful');
      return { success: true, scenarios: result, attempts: this.attempts };
      
    } catch (error: any) {
      this.attempts.push({ method: 'Postgres Alternative', success: false, error: error.message });
    }

    // Method 3: Try with IP resolution
    try {
      console.log('🔧 Attempting Method 3: IP resolution...');
      
      // Try to resolve the hostname to IP first
      const dns = require('dns').promises;
      const addresses = await dns.resolve4('db.zateicubgktisdtnihiu.supabase.co');
      
      if (addresses.length > 0) {
        console.log('📍 Resolved IP:', addresses[0]);
        
        const postgres = require('postgres');
        const modifiedUrl = process.env.DATABASE_URL?.replace('db.zateicubgktisdtnihiu.supabase.co', addresses[0]);
        
        const sql = postgres(modifiedUrl, {
          ssl: { rejectUnauthorized: false },
          connect_timeout: 30,
          prepare: false,
        });

        const result = await sql`SELECT * FROM ecos_scenarios LIMIT 3`;
        await sql.end();
        
        this.attempts.push({ method: 'IP Resolution', success: true });
        console.log('✅ Method 3 successful');
        return { success: true, scenarios: result, attempts: this.attempts };
      }
      
    } catch (error: any) {
      this.attempts.push({ method: 'IP Resolution', success: false, error: error.message });
    }

    // Method 4: Create fallback with real structure
    console.log('🔧 All connection methods failed, creating structured fallback');
    this.attempts.push({ method: 'Structured Fallback', success: true });
    
    const structuredScenarios = [
      {
        id: 1,
        title: 'Cardiologie - Consultation urgente',
        description: 'Patient de 65 ans avec douleurs thoraciques et dyspnée',
        patientPrompt: 'Vous êtes un homme de 65 ans qui présente des douleurs thoraciques depuis ce matin. Vous ressentez aussi un essoufflement et une fatigue inhabituelle.',
        evaluationCriteria: {
          anamnese: { weight: 25, description: 'Qualité de l\'anamnèse et de l\'interrogatoire' },
          examen: { weight: 35, description: 'Examen clinique cardiovasculaire complet' },
          diagnostic: { weight: 25, description: 'Hypothèses diagnostiques pertinentes' },
          conduite: { weight: 15, description: 'Conduite à tenir et examens complémentaires' }
        },
        imageUrl: '/images/cardiology.jpg',
        createdBy: 'system',
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Pédiatrie - Fièvre et détresse respiratoire',
        description: 'Enfant de 3 ans avec fièvre, toux et difficultés respiratoires',
        patientPrompt: 'Votre enfant de 3 ans est malade depuis hier soir avec de la fièvre et une toux. Il a du mal à respirer et refuse de manger.',
        evaluationCriteria: {
          approche: { weight: 30, description: 'Approche pédiatrique adaptée à l\'âge' },
          examen: { weight: 30, description: 'Examen pédiatrique complet' },
          communication: { weight: 25, description: 'Communication avec les parents' },
          decision: { weight: 15, description: 'Décision thérapeutique appropriée' }
        },
        imageUrl: '/images/pediatrics.jpg',
        createdBy: 'system',
        createdAt: new Date().toISOString()
      },
      {
        id: 3,
        title: 'Gynécologie - Consultation préventive',
        description: 'Femme de 35 ans pour suivi gynécologique et contraception',
        patientPrompt: 'Je viens pour mon suivi gynécologique annuel. J\'aimerais aussi discuter de ma contraception car nous envisageons d\'avoir un enfant dans les prochaines années.',
        evaluationCriteria: {
          anamnese: { weight: 25, description: 'Anamnèse gynécologique complète' },
          examen: { weight: 30, description: 'Examen gynécologique' },
          conseil: { weight: 30, description: 'Conseils et informations sur la contraception' },
          prevention: { weight: 15, description: 'Dépistage et prévention' }
        },
        imageUrl: '/images/gynecology.jpg',
        createdBy: 'system',
        createdAt: new Date().toISOString()
      }
    ];

    return { success: false, scenarios: structuredScenarios, attempts: this.attempts };
  }
}

export const alternativeConnectionService = new AlternativeConnectionService();
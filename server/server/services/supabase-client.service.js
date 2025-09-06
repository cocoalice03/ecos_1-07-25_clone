import { createClient } from '@supabase/supabase-js';
export class SupabaseClientService {
    supabase = null;
    isConnected = false;
    async connect() {
        if (this.isConnected && this.supabase)
            return;
        console.log('🔧 Attempting Supabase client connection...');
        try {
            let supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
            if (!supabaseUrl || !supabaseKey) {
                throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY are required');
            }
            // If SUPABASE_URL is a PostgreSQL URL, extract the project ID and construct the HTTP URL
            if (supabaseUrl.startsWith('postgresql://')) {
                const match = supabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
                if (match) {
                    const projectId = match[1];
                    supabaseUrl = `https://${projectId}.supabase.co`;
                    console.log('🔄 Converted PostgreSQL URL to Supabase HTTP URL:', supabaseUrl);
                }
            }
            console.log('🔌 Creating Supabase client...');
            this.supabase = createClient(supabaseUrl, supabaseKey);
            // Test the connection
            const { data, error } = await this.supabase
                .from('scenarios')
                .select('count')
                .limit(1);
            if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
                console.log('⚠️ Table scenarios does not exist, creating it...');
                await this.createTables();
            }
            else if (error) {
                throw error;
            }
            console.log('✅ Connected to Supabase successfully!');
            this.isConnected = true;
        }
        catch (error) {
            console.error('❌ Supabase client connection failed:', error.message);
            throw error;
        }
    }
    async createTables() {
        // Create scenarios table if it doesn't exist
        const { error } = await this.supabase.rpc('exec_sql', {
            sql: `
        CREATE TABLE IF NOT EXISTS scenarios (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          patient_prompt TEXT,
          evaluation_criteria TEXT,
          image_url TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
        }).catch(() => {
            // If exec_sql doesn't exist, we'll handle it differently
            console.log('⚠️ Cannot create table automatically');
        });
    }
    async getScenarios() {
        await this.connect();
        try {
            const { data, error } = await this.supabase
                .from('scenarios')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                if (error.message.includes('does not exist')) {
                    console.log('⚠️ Scenarios table does not exist');
                    return [];
                }
                throw error;
            }
            console.log(`✅ Retrieved ${data?.length || 0} scenarios from database`);
            return data || [];
        }
        catch (error) {
            console.error('❌ Error fetching scenarios:', error.message);
            throw error;
        }
    }
    async createScenario(scenarioData) {
        await this.connect();
        try {
            const { data, error } = await this.supabase
                .from('scenarios')
                .insert({
                title: scenarioData.title,
                description: scenarioData.description,
                patient_prompt: scenarioData.patientPrompt,
                evaluation_criteria: scenarioData.evaluationCriteria,
                image_url: scenarioData.imageUrl || null,
                created_by: scenarioData.createdBy,
            })
                .select()
                .single();
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            console.error('❌ Error creating scenario:', error.message);
            throw error;
        }
    }
    async updateScenario(id, updates) {
        await this.connect();
        try {
            const updateData = {
                updated_at: new Date().toISOString()
            };
            if (updates.title)
                updateData.title = updates.title;
            if (updates.description !== undefined)
                updateData.description = updates.description;
            if (updates.patientPrompt)
                updateData.patient_prompt = updates.patientPrompt;
            if (updates.evaluationCriteria)
                updateData.evaluation_criteria = updates.evaluationCriteria;
            if (updates.imageUrl !== undefined)
                updateData.image_url = updates.imageUrl;
            const { data, error } = await this.supabase
                .from('scenarios')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            console.error('❌ Error updating scenario:', error.message);
            throw error;
        }
    }
    async deleteScenario(id) {
        await this.connect();
        try {
            const { error } = await this.supabase
                .from('scenarios')
                .delete()
                .eq('id', id);
            if (error)
                throw error;
        }
        catch (error) {
            console.error('❌ Error deleting scenario:', error.message);
            throw error;
        }
    }
}

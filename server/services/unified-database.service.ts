import { createClient } from '@supabase/supabase-js';

interface DatabaseMetrics {
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  lastConnectionTime: Date;
  isHealthy: boolean;
  responseTime: number;
}

/**
 * Unified Database Service
 * 
 * Single point of access for all database operations.
 * Uses Supabase REST API exclusively for stability.
 * Eliminates connection pooling conflicts and race conditions.
 */
export class UnifiedDatabaseService {
  private supabase: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private metrics: DatabaseMetrics;
  private startupTime: Date;
  
  constructor() {
    this.startupTime = new Date();
    this.metrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      lastConnectionTime: new Date(),
      isHealthy: false,
      responseTime: 0
    };
  }

  /**
   * Initialize the database service (called once)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  private async _performInitialization(): Promise<void> {
    this.metrics.connectionAttempts++;
    const startTime = Date.now();
    
    try {
      console.log('🔧 Initializing Unified Database Service...');

      let supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
      }

      // Convert PostgreSQL URL to HTTP URL if needed
      if (supabaseUrl.startsWith('postgresql://')) {
        const match = supabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
        if (match) {
          const projectId = match[1];
          supabaseUrl = `https://${projectId}.supabase.co`;
          console.log('🔄 Converted to Supabase HTTP URL');
        }
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test connection with health check
      await this._performHealthCheck();
      
      this.isInitialized = true;
      this.metrics.successfulConnections++;
      this.metrics.responseTime = Date.now() - startTime;
      this.metrics.isHealthy = true;
      this.metrics.lastConnectionTime = new Date();
      
      console.log('✅ Unified Database Service initialized successfully');
    } catch (error: any) {
      this.metrics.failedConnections++;
      this.metrics.isHealthy = false;
      console.error('❌ Database service initialization failed:', error.message);
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async _performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simple health check query
      const { error } = await this.supabase
        .from('scenarios')
        .select('id')
        .limit(1);
        
      if (error && !error.message.includes('does not exist')) {
        throw error;
      }
      
      this.metrics.responseTime = Date.now() - startTime;
      console.log(`✅ Health check passed (${this.metrics.responseTime}ms)`);
    } catch (error: any) {
      console.warn('⚠️ Health check warning:', error.message);
      // Don't throw for table existence issues
      if (!error.message.includes('does not exist')) {
        throw error;
      }
    }
  }

  /**
   * Get database client (ensures initialization)
   */
  private async getClient(): Promise<any> {
    await this.initialize();
    
    if (!this.supabase) {
      throw new Error('Database service not initialized');
    }
    
    return this.supabase;
  }

  /**
   * Get all scenarios
   */
  async getScenarios(): Promise<any[]> {
    try {
      const client = await this.getClient();
      
      const { data, error } = await client
        .from('scenarios')
        .select(`
          id,
          title,
          description,
          patient_prompt,
          evaluation_criteria,
          image_url,
          created_by,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log('⚠️ Scenarios table does not exist, returning empty array');
          return [];
        }
        throw error;
      }

      console.log(`✅ Retrieved ${data?.length || 0} scenarios`);
      
      // Map database column names to expected property names
      const mappedData = (data || []).map(scenario => ({
        ...scenario,
        patient_prompt: scenario.patient_prompt || null,
        evaluation_criteria: scenario.evaluation_criteria || null
      }));
      
      return mappedData;
    } catch (error: any) {
      console.error('❌ Error fetching scenarios:', error.message);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<any> {
    try {
      const client = await this.getClient();
      
      // Get scenarios count using the same method as getScenarios()
      const scenarios = await this.getScenarios();
      const totalScenarios = scenarios.length;

      console.log(`📊 Dashboard stats: ${totalScenarios} scenarios found`);

      // For now, return basic stats - expand as needed
      return {
        totalScenarios,
        activeSessions: 0,
        completedSessions: 0,
        totalStudents: 0
      };
    } catch (error: any) {
      console.error('❌ Error fetching dashboard stats:', error.message);
      return {
        totalScenarios: 0,
        activeSessions: 0,
        completedSessions: 0,
        totalStudents: 0
      };
    }
  }

  /**
   * Get students (placeholder for future implementation)
   */
  async getStudents(): Promise<any[]> {
    try {
      const client = await this.getClient();
      
      // For now, return empty array - implement based on your needs
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching students:', error.message);
      return [];
    }
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{ status: string; metrics: DatabaseMetrics; uptime: number }> {
    try {
      await this._performHealthCheck();
      
      return {
        status: 'healthy',
        metrics: { ...this.metrics },
        uptime: Date.now() - this.startupTime.getTime()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: { ...this.metrics, isHealthy: false },
        uptime: Date.now() - this.startupTime.getTime()
      };
    }
  }

  /**
   * Create a new scenario
   */
  async createScenario(scenarioData: any): Promise<any> {
    const client = await this.getClient();
    
    const { data, error } = await client
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

    if (error) throw error;
    return data;
  }

  /**
   * Update scenario
   */
  async updateScenario(id: string, updates: any): Promise<any> {
    const client = await this.getClient();
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.title) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.patientPrompt) updateData.patient_prompt = updates.patientPrompt;
    if (updates.evaluationCriteria) updateData.evaluation_criteria = updates.evaluationCriteria;
    if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;

    const { data, error } = await client
      .from('scenarios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete scenario
   */
  async deleteScenario(id: string): Promise<void> {
    const client = await this.getClient();
    
    const { error } = await client
      .from('scenarios')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Store conversation exchange in database
   */
  async storeConversationExchange(exchange: {
    email: string;
    question: string;
    response: string;
    sessionId?: string;
    scenarioId?: number;
    studentRole?: string;
    contextData?: any;
  }): Promise<any> {
    try {
      const client = await this.getClient();
      
      const { data, error } = await client
        .from('exchanges')
        .insert({
          utilisateur_email: exchange.email,
          question: exchange.question,
          reponse: exchange.response,
          session_id: exchange.sessionId,
          scenario_id: exchange.scenarioId,
          student_role: exchange.studentRole,
          context_data: exchange.contextData,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error storing conversation exchange:', error);
        throw error;
      }

      console.log(`💾 Stored conversation exchange for session ${exchange.sessionId}`);
      return data;
    } catch (error: any) {
      console.error('❌ Failed to store conversation exchange:', error);
      // Don't throw - conversation storage failure shouldn't break the flow
      return null;
    }
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string, limit: number = 50): Promise<any[]> {
    try {
      const client = await this.getClient();
      
      const { data, error } = await client
        .from('exchanges')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching conversation history:', error);
        return [];
      }

      console.log(`📚 Retrieved ${data?.length || 0} conversation exchanges for session ${sessionId}`);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error fetching conversation history:', error.message);
      return [];
    }
  }

  /**
   * Get recent conversations for a student
   */
  async getStudentConversations(email: string, limit: number = 100): Promise<any[]> {
    try {
      const client = await this.getClient();
      
      const { data, error } = await client
        .from('exchanges')
        .select('*')
        .eq('utilisateur_email', email)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      console.log(`📚 Retrieved ${data?.length || 0} conversations for student ${email}`);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error fetching student conversations:', error.message);
      return [];
    }
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.metrics.isHealthy;
  }
}

// Export singleton instance
export const unifiedDb = new UnifiedDatabaseService();
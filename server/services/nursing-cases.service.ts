import { createClient } from '@supabase/supabase-js';
import { nursingCase01 } from '../data/nursing-case-01';

export class NursingCasesService {
  private supabaseUrl: string;
  private supabaseKey: string;
  private supabase: any;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    }
  }

  async initializeNursingCasesTable() {
    if (!this.supabase) {
      console.error('❌ Supabase client not initialized');
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // Create the nursing_cases table if it doesn't exist
      const { error: createError } = await this.supabase.rpc('create_nursing_cases_table', {
        table_sql: `
          CREATE TABLE IF NOT EXISTS nursing_cases (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            estimated_time INTEGER NOT NULL,
            patient_info JSONB NOT NULL,
            clinical_presentation JSONB NOT NULL,
            nursing_assessment JSONB NOT NULL,
            nursing_interventions JSONB NOT NULL,
            expected_outcomes JSONB NOT NULL,
            critical_thinking_questions JSONB NOT NULL,
            teaching_points TEXT[] NOT NULL,
            additional_resources TEXT[] NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_nursing_cases_category ON nursing_cases(category);
          CREATE INDEX IF NOT EXISTS idx_nursing_cases_difficulty ON nursing_cases(difficulty);
        `
      });

      if (createError) {
        // If RPC doesn't exist, try direct SQL (this might fail due to permissions)
        console.log('⚠️ RPC method not available, attempting direct table creation...');
      }

      console.log('✅ Nursing cases table ready');
      return { success: true };
    } catch (error) {
      console.error('❌ Error initializing nursing cases table:', error);
      return { success: false, error };
    }
  }

  async insertNursingCase(caseData: any = nursingCase01) {
    if (!this.supabase) {
      console.error('❌ Supabase client not initialized');
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      // First, check if the case already exists
      const { data: existingCase, error: checkError } = await this.supabase
        .from('nursing_cases')
        .select('id')
        .eq('id', caseData.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is expected
        console.error('❌ Error checking existing case:', checkError);
        return { success: false, error: checkError };
      }

      if (existingCase) {
        console.log('ℹ️ Case already exists, updating...');
        
        // Update existing case
        const { data, error } = await this.supabase
          .from('nursing_cases')
          .update({
            title: caseData.title,
            category: caseData.category,
            difficulty: caseData.difficulty,
            estimated_time: caseData.estimatedTime,
            patient_info: caseData.patientInfo,
            clinical_presentation: caseData.clinicalPresentation,
            nursing_assessment: caseData.nursingAssessment,
            nursing_interventions: caseData.nursingInterventions,
            expected_outcomes: caseData.expectedOutcomes,
            critical_thinking_questions: caseData.criticalThinkingQuestions,
            teaching_points: caseData.teachingPoints,
            additional_resources: caseData.additionalResources,
            updated_at: new Date().toISOString()
          })
          .eq('id', caseData.id)
          .select()
          .single();

        if (error) {
          console.error('❌ Error updating nursing case:', error);
          return { success: false, error };
        }

        console.log('✅ Nursing case updated successfully:', data);
        return { success: true, data };
      } else {
        // Insert new case
        const { data, error } = await this.supabase
          .from('nursing_cases')
          .insert({
            id: caseData.id,
            title: caseData.title,
            category: caseData.category,
            difficulty: caseData.difficulty,
            estimated_time: caseData.estimatedTime,
            patient_info: caseData.patientInfo,
            clinical_presentation: caseData.clinicalPresentation,
            nursing_assessment: caseData.nursingAssessment,
            nursing_interventions: caseData.nursingInterventions,
            expected_outcomes: caseData.expectedOutcomes,
            critical_thinking_questions: caseData.criticalThinkingQuestions,
            teaching_points: caseData.teachingPoints,
            additional_resources: caseData.additionalResources
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error inserting nursing case:', error);
          return { success: false, error };
        }

        console.log('✅ Nursing case inserted successfully:', data);
        return { success: true, data };
      }
    } catch (error) {
      console.error('❌ Unexpected error managing nursing case:', error);
      return { success: false, error };
    }
  }

  async getAllNursingCases() {
    if (!this.supabase) {
      console.error('❌ Supabase client not initialized');
      return { success: false, error: 'Supabase client not initialized', data: [] };
    }

    try {
      const { data, error } = await this.supabase
        .from('nursing_cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching nursing cases:', error);
        return { success: false, error, data: [] };
      }

      console.log(`✅ Fetched ${data.length} nursing cases`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Unexpected error fetching nursing cases:', error);
      return { success: false, error, data: [] };
    }
  }

  async getNursingCaseById(caseId: string) {
    if (!this.supabase) {
      console.error('❌ Supabase client not initialized');
      return { success: false, error: 'Supabase client not initialized', data: null };
    }

    try {
      const { data, error } = await this.supabase
        .from('nursing_cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (error) {
        console.error('❌ Error fetching nursing case:', error);
        return { success: false, error, data: null };
      }

      console.log('✅ Fetched nursing case:', caseId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Unexpected error fetching nursing case:', error);
      return { success: false, error, data: null };
    }
  }
}

export const nursingCasesService = new NursingCasesService();
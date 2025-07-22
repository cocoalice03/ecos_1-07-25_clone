import { Pinecone } from '@pinecone-database/pinecone';
import { SupabaseClientService } from './supabase-client.service';

interface PineconeMetadata {
  title?: string;
  description?: string;
  patientPrompt?: string;
  evaluationCriteria?: any;
  imageUrl?: string;
  createdBy?: string;
}

export class ScenarioSyncService {
  private pinecone: Pinecone;
  private indexName: string;
  private namespace: string;
  private dbService: SupabaseClientService;

  constructor() {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required');
    }
    
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    this.indexName = process.env.PINECONE_INDEX_NAME || 'arthrologie-du-membre-superieur';
    this.namespace = process.env.PINECONE_NAMESPACE || 'default';
    this.dbService = new SupabaseClientService();
  }

  async syncScenariosFromPinecone(): Promise<void> {
    try {
      console.log('🔍 Synchronizing scenarios from Pinecone...');
      
      await this.dbService.connect();
      
      const index = this.pinecone.index(this.indexName);
      
      // Query all vectors from Pinecone with metadata
      const queryResponse = await index.namespace(this.namespace).query({
        vector: new Array(1536).fill(0), // OpenAI embeddings dimension
        topK: 100, // Get up to 100 scenarios
        includeMetadata: true,
        includeValues: false
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        console.log('📭 No scenarios found in Pinecone');
        return;
      }

      console.log(`📋 Found ${queryResponse.matches.length} scenarios in Pinecone`);

      for (const match of queryResponse.matches) {
        if (!match.metadata) continue;
        
        const metadata = match.metadata as PineconeMetadata;
        
        // Skip if essential fields are missing
        if (!metadata.title || !metadata.description || !metadata.patientPrompt) {
          console.log(`⚠️ Skipping scenario ${match.id} - missing essential fields`);
          continue;
        }

        try {
          // Create scenario in Supabase
          await this.dbService.createScenario({
            title: metadata.title,
            description: metadata.description,
            patientPrompt: metadata.patientPrompt,
            evaluationCriteria: metadata.evaluationCriteria || {},
            imageUrl: metadata.imageUrl,
            createdBy: metadata.createdBy || 'system'
          });
          
          console.log(`✅ Created scenario: ${metadata.title}`);
        } catch (error: any) {
          if (error.message?.includes('duplicate')) {
            console.log(`⚠️ Scenario already exists: ${metadata.title}`);
          } else {
            console.error(`❌ Error creating scenario ${metadata.title}:`, error.message);
          }
        }
      }

      console.log('✅ Scenario synchronization completed');
    } catch (error) {
      console.error('❌ Error syncing scenarios from Pinecone:', error);
      throw error;
    }
  }

  async getAvailableScenarios(): Promise<any[]> {
    try {
      await this.dbService.connect();
      return await this.dbService.getScenarios();
    } catch (error) {
      console.error('❌ Error fetching scenarios from Supabase:', error);
      throw error;
    }
  }

  async getScenarioById(id: string): Promise<any | null> {
    try {
      await this.dbService.connect();
      const scenarios = await this.dbService.getScenarios();
      return scenarios.find(s => s.id === id) || null;
    } catch (error) {
      console.error('❌ Error fetching scenario by ID from Supabase:', error);
      throw error;
    }
  }
}

export const scenarioSyncService = new ScenarioSyncService();
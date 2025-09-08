import { Pinecone } from '@pinecone-database/pinecone';
import { unifiedDb } from './unified-database.service.js';

interface PineconeMetadata {
  title?: string;
  description?: string;
  patientPrompt?: string;
  evaluationCriteria?: any;
  imageUrl?: string;
  createdBy?: string;
}

export class ScenarioSyncService {
  private pinecone: Pinecone | null;
  private indexName: string;
  private namespace: string;
  // Remove dbService as we're using the unified database service
  private pineconeEnabled: boolean;

  constructor() {
    
    if (!process.env.PINECONE_API_KEY) {
      console.warn('⚠️  PINECONE_API_KEY not provided, Pinecone features will be disabled');
      this.pinecone = null;
      this.pineconeEnabled = false;
      this.indexName = '';
      this.namespace = '';
      return;
    }
    
    this.pineconeEnabled = true;
    
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    this.indexName = process.env.PINECONE_INDEX_NAME || 'arthrologie-du-membre-superieur';
    this.namespace = process.env.PINECONE_NAMESPACE || 'default';
  }

  async syncScenariosFromPinecone(): Promise<void> {
    if (!this.pineconeEnabled || !this.pinecone) {
      console.log('⚠️ Pinecone not enabled, skipping sync');
      return;
    }
    
    try {
      console.log('🔍 Synchronizing scenarios from Pinecone...');
      
      await unifiedDb.initialize(); // Ensure database is initialized
      
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
          // Create scenario using unified database service
          await unifiedDb.initialize(); // Ensure database is initialized
          await unifiedDb.createScenario({
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
      await unifiedDb.initialize(); // Ensure database is initialized
      return await unifiedDb.getScenarios();
    } catch (error) {
      console.error('❌ Error fetching scenarios from Supabase:', error);
      throw error;
    }
  }

  async getScenarioById(id: string): Promise<any | null> {
    try {
      await unifiedDb.initialize(); // Ensure database is initialized
      const scenarios = await unifiedDb.getScenarios();
      return scenarios.find(s => s.id === id) || null;
    } catch (error) {
      console.error('❌ Error fetching scenario by ID from Supabase:', error);
      throw error;
    }
  }
}

export const scenarioSyncService = new ScenarioSyncService();
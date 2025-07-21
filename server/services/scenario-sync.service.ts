import { Pinecone } from '@pinecone-database/pinecone';
import { db, ecosScenarios } from '../db';
import { eq } from 'drizzle-orm';

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

  constructor() {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required');
    }
    
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    
    this.indexName = process.env.PINECONE_INDEX_NAME || 'n8n-awbg3z6';
    this.namespace = process.env.PINECONE_NAMESPACE || 'default';
  }

  async syncScenariosFromPinecone(): Promise<void> {
    try {
      console.log('🔍 Synchronizing scenarios from Pinecone...');
      
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

        // Check if scenario already exists in Supabase
        const existingScenarios = await db
          .select()
          .from(ecosScenarios)
          .where(eq(ecosScenarios.pineconeIndex, match.id));

        if (existingScenarios.length === 0) {
          // Create new scenario
          await db.insert(ecosScenarios).values({
            title: metadata.title,
            description: metadata.description,
            patientPrompt: metadata.patientPrompt,
            evaluationCriteria: metadata.evaluationCriteria || {},
            pineconeIndex: match.id,
            imageUrl: metadata.imageUrl,
            createdBy: metadata.createdBy || 'system'
          });
          
          console.log(`✅ Created scenario: ${metadata.title}`);
        } else {
          // Update existing scenario
          await db
            .update(ecosScenarios)
            .set({
              title: metadata.title,
              description: metadata.description,
              patientPrompt: metadata.patientPrompt,
              evaluationCriteria: metadata.evaluationCriteria || {},
              imageUrl: metadata.imageUrl,
            })
            .where(eq(ecosScenarios.pineconeIndex, match.id));
          
          console.log(`🔄 Updated scenario: ${metadata.title}`);
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
      const scenarios = await db
        .select({
          id: ecosScenarios.id,
          title: ecosScenarios.title,
          description: ecosScenarios.description,
          imageUrl: ecosScenarios.imageUrl,
          createdBy: ecosScenarios.createdBy,
          createdAt: ecosScenarios.createdAt
        })
        .from(ecosScenarios);

      return scenarios;
    } catch (error) {
      console.error('❌ Error fetching scenarios from database:', error);
      throw error;
    }
  }

  async getScenarioById(id: number): Promise<any | null> {
    try {
      const scenarios = await db
        .select()
        .from(ecosScenarios)
        .where(eq(ecosScenarios.id, id));

      return scenarios[0] || null;
    } catch (error) {
      console.error('❌ Error fetching scenario by ID:', error);
      throw error;
    }
  }
}

export const scenarioSyncService = new ScenarioSyncService();
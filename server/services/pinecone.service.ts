import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from "openai";
import { RAGContent } from './openai.service';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ""
});

export class PineconeService {
  private pinecone;
  private index;
  private indexName: string = '';
  private namespace: string = '';

  constructor() {
    try {
      // Get Pinecone credentials from environment variables
      const apiKey = process.env.PINECONE_API_KEY;
      this.indexName = process.env.PINECONE_INDEX_NAME || 'arthrologie-du-membre-superieur';
      this.namespace = process.env.PINECONE_NAMESPACE || 'default';

      if (!apiKey) {
        console.warn('Missing Pinecone API key - running in fallback mode');
        this.pinecone = null;
        this.index = null;
        return;
      }

      // Initialize Pinecone client
      this.pinecone = new Pinecone({
        apiKey,
      });

      // Get the index
      this.index = this.pinecone.index(this.indexName);
      console.log(`Connected to Pinecone index: ${this.indexName}`);
    } catch (error) {
      console.error('Error initializing Pinecone service:', error);
      console.warn('Running in fallback mode without Pinecone');
      this.pinecone = null;
      this.index = null;
    }
  }

  /**
   * Gets the vector embedding for a text string using OpenAI
   */
  public async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error getting embedding:", error);
      throw new Error("Failed to generate embedding for query");
    }
  }

  /**
   * Search for relevant content based on the question
   */
  async searchRelevantContent(question: string, topK: number = 3): Promise<RAGContent[]> {
    try {
      // Check if Pinecone is available
      if (!this.pinecone || !this.index) {
        console.warn('Pinecone not available - returning empty results');
        return [];
      }

      // Get embedding for the question
      const embedding = await this.getEmbedding(question);

      // Query Pinecone
      const queryResponse = await this.index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
      });

      // Process and return the results
      const results: RAGContent[] = [];

      for (const match of queryResponse.matches) {
        if (match.metadata && typeof match.metadata.text === 'string') {
          results.push({
            content: match.metadata.text,
            metadata: {
              source: typeof match.metadata.source === 'string' ? match.metadata.source : undefined,
            }
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Error searching Pinecone:", error);
      return [];
    }
  }

  /**
   * Bulk upsert vectors to Pinecone
   */
  async upsertVectors(vectors: any[]): Promise<void> {
    try {
      if (!this.pinecone || !this.index) {
        console.warn('Pinecone not available - skipping upsert');
        return;
      }

      await this.index.upsert(vectors);
      console.log(`Successfully upserted ${vectors.length} vectors to Pinecone`);
    } catch (error) {
      console.error("Error upserting vectors:", error);
      throw new Error("Failed to store vectors in knowledge base");
    }
  }

  /**
   * Get all document sources from Pinecone
   */
  async getAllSources(): Promise<string[]> {
    try {
      if (!this.pinecone || !this.index) {
        console.warn('Pinecone not available - returning empty sources');
        return [];
      }

      // Query with empty vector to get random samples and extract sources
      const dummyVector = new Array(1536).fill(0); // text-embedding-3-small dimension
      const queryResponse = await this.index.query({
        vector: dummyVector,
        topK: 100,
        includeMetadata: true,
      });

      const sources = new Set<string>();
      queryResponse.matches.forEach(match => {
        if (match.metadata && match.metadata.source) {
          sources.add(match.metadata.source as string);
        }
      });

      return Array.from(sources);
    } catch (error) {
      console.error("Error getting sources:", error);
      return [];
    }
  }

  /**
   * Delete all vectors for a specific document
   */
  async deleteDocument(documentTitle: string): Promise<void> {
    try {
      if (!this.pinecone || !this.index) {
        console.warn('Pinecone not available - skipping delete');
        return;
      }

      // Find all vector IDs for this document
      const dummyVector = new Array(1536).fill(0);
      const queryResponse = await this.index.query({
        vector: dummyVector,
        topK: 1000,
        includeMetadata: true,
        filter: { source: documentTitle }
      });

      const idsToDelete = queryResponse.matches.map(match => match.id);

      if (idsToDelete.length > 0) {
        await this.index.deleteMany(idsToDelete);
        console.log(`Deleted ${idsToDelete.length} vectors for document: ${documentTitle}`);
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      throw new Error("Failed to delete document from knowledge base");
    }
  }

  /**
   * Create a new Pinecone index
   */
  async createIndex(indexName: string, dimension: number = 1536): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone not initialized - please check your API key');
    }

    try {
      console.log(`Attempting to create Pinecone index: ${indexName} with dimension: ${dimension}`);

      const result = await this.pinecone.createIndex({
        name: indexName,
        dimension: dimension,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      console.log(`Successfully created Pinecone index: ${indexName}`, result);
    } catch (error: any) {
      console.error('Detailed error creating Pinecone index:', {
        message: error.message,
        status: error.status,
        response: error.response?.data,
        indexName,
        dimension
      });

      // Provide more specific error messages
      if (error.message && error.message.includes('ALREADY_EXISTS')) {
        throw new Error(`L'index "${indexName}" existe déjà. Veuillez choisir un nom différent ou attendre quelques minutes si vous venez de le supprimer.`);
      } else if (error.status === 403) {
        throw new Error('Permission denied. Please check your Pinecone API key.');
      } else if (error.status === 400) {
        throw new Error(`Invalid index configuration: ${error.message}`);
      } else {
        throw new Error(`Failed to create index: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * List all available Pinecone indexes
   */
  async listIndexes(): Promise<Array<{name: string, status?: string, dimension?: number}>> {
    console.log('🔍 Starting listIndexes operation...');

    if (!this.pinecone) {
      console.error('❌ Pinecone not initialized');
      throw new Error('Pinecone not initialized');
    }

    try {
      console.log('📡 Calling Pinecone listIndexes API...');
      const indexesList = await this.pinecone.listIndexes();
      console.log('✅ Pinecone API response received:', JSON.stringify(indexesList, null, 2));

      if (!indexesList || !indexesList.indexes) {
        console.log('⚠️ No indexes found in response or empty response');
        return [];
      }

      console.log('📝 Processing indexes data...');
      const indexes = indexesList.indexes.map((index, idx) => {
        console.log(`Processing index ${idx}:`, JSON.stringify(index, null, 2));
        return {
          name: index.name,
          status: index.status?.ready ? 'ready' : 'not ready',
          dimension: index.dimension
        };
      });

      console.log('✅ Successfully processed indexes:', JSON.stringify(indexes, null, 2));
      return indexes;
    } catch (error) {
      console.error('❌ Error in listIndexes:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        code: (error as any)?.code,
        status: (error as any)?.status
      });
      throw error;
    }
  }

  /**
   * Switch to a different index
   */
  async switchIndex(indexName: string): Promise<void> {
    if (!this.pinecone) {
      throw new Error('Pinecone not initialized');
    }

    try {
      this.indexName = indexName;
      this.index = this.pinecone.index(indexName);
      console.log(`Switched to Pinecone index: ${indexName}`);
    } catch (error) {
      console.error('Error switching Pinecone index:', error);
      throw error;
    }
  }

  /**
   * Process PDF content into chunks and upload to Pinecone
   */
  async processPDFContent(
    content: string, 
    title: string, 
    category: string,
    chunkSize: number = 1000,
    overlap: number = 200
  ): Promise<void> {
    if (!this.index) {
      throw new Error('Pinecone not available');
    }

    try {
      // Split content into chunks
      const chunks = this.splitIntoChunks(content, chunkSize, overlap);

      // Create embeddings for all chunks
      const embeddings = await this.getEmbeddingsForChunks(chunks);

      // Prepare vectors for upsert
      const vectors = chunks.map((chunk, index) => ({
        id: `${title}_chunk_${index}`,
        values: embeddings[index],
        metadata: {
          source: title,
          text: chunk,
          category: category,
          chunk_index: index,
          total_chunks: chunks.length
        }
      }));

      // Upload to Pinecone in batches
      await this.upsertVectors(vectors);
      console.log(`Processed PDF: ${title} with ${chunks.length} chunks`);
    } catch (error) {
      console.error('Error processing PDF content:', error);
      throw error;
    }
  }

  /**
   * Split text into chunks with overlap
   */
  private splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk.trim());

      if (end === text.length) break;
      start = end - overlap;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Get embeddings for multiple text chunks
   */
  private async getEmbeddingsForChunks(chunks: string[]): Promise<number[][]> {
    const embeddings = [];

    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(chunk => this.getEmbedding(chunk))
      );
      embeddings.push(...batchEmbeddings);

      // Small delay between batches
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return embeddings;
  }

  async queryVectors(query: string, indexName: string, topK: number = 5): Promise<RAGContent[]> {
    try {
      // Get embedding for the question
      const embedding = await this.getEmbedding(query);

      // Get specific index
      const targetIndex = this.pinecone.index(indexName);

      const queryResponse = await targetIndex.query({
        vector: embedding,
        topK,
        includeMetadata: true,
      });

      // Process and return the results
      const results: RAGContent[] = [];

      for (const match of queryResponse.matches) {
        if (match.metadata && typeof match.metadata.text === 'string') {
          results.push({
            content: match.metadata.text,
            metadata: {
              source: typeof match.metadata.source === 'string' ? match.metadata.source : undefined,
            }
          });
        }
      }

      return results;
    } catch (error) {
      console.error(`Error querying Pinecone index ${indexName}:`, error);
      return [];
    }
  }
}

export const pineconeService = new PineconeService();
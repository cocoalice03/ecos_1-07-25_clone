import { openaiService } from './openai.service.js';
import { pineconeService } from './pinecone.service.js';
import { storage } from '../storage.js';

export class LearnWorldsService {
  // Max questions per day per user
  private MAX_DAILY_QUESTIONS = 20;

  /**
   * Process a chatbot query from LearnWorlds
   */
  async processQuery(email: string, query: string) {
    try {
      // Get today's date (UTC+2 timezone)
      const now = new Date();
      // Adjust to UTC+2 (2 hours ahead of UTC)
      now.setHours(now.getHours() + 2);
      
      // Check if user has reached daily limit
      const counter = await storage.getDailyCounter(email, now);
      const questionsUsed = counter?.count || 0;
      
      if (questionsUsed >= this.MAX_DAILY_QUESTIONS) {
        return {
          status: 'error',
          message: 'Limite quotidienne atteinte. Vous avez utilisé vos 20 questions pour aujourd\'hui. Veuillez revenir demain.',
          limitReached: true,
          questionsUsed,
          questionsRemaining: 0,
          maxDailyQuestions: this.MAX_DAILY_QUESTIONS
        };
      }
      
      // Create session if it doesn't exist
      let session = await storage.getSession(email);
      if (!session) {
        session = await storage.createSession({ email });
      }
      
      // 1. Use Pinecone to find relevant content
      const relevantContent = await pineconeService.searchRelevantContent(query);
      
      // 2. Generate response using OpenAI and the relevant content
      const response = await openaiService.generateResponse(query, relevantContent);
      
      // 3. Save the exchange
      const exchange = await storage.saveExchange({
        email,
        question: query,
        response
      });
      
      // 4. Increment user's daily counter
      const updatedCounter = await storage.incrementDailyCounter(email, now);
      
      // 5. Return the answer and updated status
      return {
        status: 'success',
        id: exchange.id,
        question: query,
        response,
        timestamp: exchange.timestamp,
        questionsUsed: updatedCounter.count,
        questionsRemaining: this.MAX_DAILY_QUESTIONS - updatedCounter.count,
        limitReached: updatedCounter.count >= this.MAX_DAILY_QUESTIONS,
        maxDailyQuestions: this.MAX_DAILY_QUESTIONS
      };
    } catch (error) {
      console.error('Error processing LearnWorlds query:', error);
      return {
        status: 'error',
        message: 'Une erreur est survenue lors du traitement de votre question. Veuillez réessayer plus tard.'
      };
    }
  }
}

export const learnWorldsService = new LearnWorldsService();
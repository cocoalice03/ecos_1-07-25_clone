/**
 * Virtual Patient Service
 * 
 * AI-powered virtual patient for ECOS medical training scenarios
 * - Uses OpenAI for intelligent responses
 * - Integrates with conversation memory
 * - Role-aware interactions (infirmier vs docteur)
 * - Scenario-specific patient personas
 */

import OpenAI from "openai";
import { conversationMemoryService } from './conversation-memory.service.js';
import { unifiedDb } from './unified-database.service.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "",
});

export interface PatientResponse {
  response: string;
  addressing: string; // How to address the student
  medicalContext?: {
    symptomsRevealed: string[];
    questionsAnswered: string[];
    nextSteps: string[];
  };
}

export class VirtualPatientService {
  
  /**
   * Generate virtual patient response using AI
   */
  async generatePatientResponse(
    sessionId: string,
    studentEmail: string,
    query: string,
    scenarioId?: number
  ): Promise<PatientResponse> {
    try {
      // Initialize or get conversation memory
      const memory = await conversationMemoryService.initializeConversation(
        sessionId,
        studentEmail,
        scenarioId || 1
      );

      // Detect and update student role from query
      conversationMemoryService.updateStudentRole(sessionId, query);

      // Get scenario-specific patient prompt
      const patientPrompt = await this.getScenarioPatientPrompt(scenarioId);
      
      // Get conversation context
      const context = conversationMemoryService.getConversationContext(sessionId);
      
      // Get appropriate addressing
      const addressing = conversationMemoryService.getStudentAddressing(sessionId);

      // Build AI system prompt
      const systemPrompt = this.buildSystemPrompt(patientPrompt, context, addressing);

      // Generate AI response
      const aiResponse = await this.callOpenAI(systemPrompt, query, context.history);

      // Add messages to memory
      conversationMemoryService.addMessage(sessionId, query, 'student');
      conversationMemoryService.addMessage(sessionId, aiResponse, 'patient');

      // Extract medical context from response
      const medicalContext = this.extractMedicalContext(aiResponse);

      return {
        response: aiResponse,
        addressing: addressing || 'étudiant',
        medicalContext
      };

    } catch (error) {
      console.error('❌ Error generating patient response:', error);
      
      // Fallback response
      const addressing = conversationMemoryService.getStudentAddressing(sessionId);
      return {
        response: `Excusez-moi ${addressing || ''}, pourriez-vous répéter votre question ? Je n'ai pas bien compris.`,
        addressing: addressing || 'étudiant'
      };
    }
  }

  /**
   * Get scenario-specific patient prompt from database
   */
  private async getScenarioPatientPrompt(scenarioId?: number): Promise<string> {
    if (!scenarioId) {
      return this.getDefaultPatientPrompt();
    }

    try {
      const scenarios = await unifiedDb.getScenarios();
      const scenario = scenarios.find(s => s.id === scenarioId);
      
      if (scenario?.patient_prompt) {
        console.log(`✅ Using scenario-specific patient prompt for scenario ${scenarioId}`);
        return scenario.patient_prompt;
      }
      
      console.error(`❌ No patient prompt found for scenario ${scenarioId}. This should not happen in production.`);
      throw new Error(`Missing patient prompt for scenario ${scenarioId}. Please ensure scenario has proper patient_prompt in database.`);
      
    } catch (error) {
      console.error('❌ Error fetching scenario prompt:', error);
      // Only use default prompt as absolute fallback in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Using default prompt in development mode');
        return this.getDefaultPatientPrompt();
      }
      throw error;
    }
  }

  /**
   * Build comprehensive system prompt for AI
   */
  private buildSystemPrompt(
    patientPrompt: string,
    context: { history: string; role: string; medicalContext: string },
    addressing: string
  ): string {
    const roleInstruction = this.getRoleInstruction(addressing);
    
    return `Tu es un patient virtuel dans un exercice de formation médicale ECOS (Examen Clinique Objectif Structuré).

PERSONNALITÉ ET CONTEXTE DU PATIENT (À RESPECTER ABSOLUMENT):
${patientPrompt}

INSTRUCTIONS COMPORTEMENTALES CRITIQUES:
- Parle uniquement en français
- RESPECTE STRICTEMENT le contexte et les symptômes décrits dans ton prompt de patient
- NE JAMAIS inventer ou mentionner des symptômes qui ne sont PAS dans ton contexte
- NE JAMAIS nier des symptômes qui SONT explicitement mentionnés dans ton contexte
- Si ton prompt mentionne des symptômes spécifiques, tu DOIS les avoir
- ${roleInstruction}
- Réponds de manière réaliste et cohérente avec EXACTEMENT tes symptômes décrits
- Sois coopératif mais réaliste (certaines informations peuvent nécessiter des questions spécifiques)
- Exprime tes émotions et préoccupations comme un vrai patient
- Référence les informations déjà échangées dans la conversation

CONTEXTE MÉDICAL ACTUEL:
${context.medicalContext}

HISTORIQUE DE LA CONVERSATION:
${context.history}

RÈGLES D'OR:
1. RESTE FIDÈLE à ton prompt de patient - ne jamais en dévier
2. Si ton contexte mentionne des symptômes, tu les as RÉELLEMENT
3. Ne mentionne JAMAIS de symptômes non inclus dans ton contexte
4. Utilise l'historique pour maintenir la continuité de la conversation

IMPORTANT: Si l'étudiant a déjà posé une question similaire, fais référence à ta réponse précédente. Respecte ton contexte médical à 100%.`;
  }

  /**
   * Get role-specific instruction
   */
  private getRoleInstruction(addressing: string): string {
    switch (addressing) {
      case 'infirmier':
        return 'Adresse-toi à l\'infirmier(ère) de manière appropriée. Tu peux demander "Que faites-vous comme soins infirmier?" ou dire "Merci infirmier" quand c\'est approprié.';
      case 'docteur':
        return 'Adresse-toi au docteur de manière formelle. Tu peux dire "Docteur, qu\'est-ce que j\'ai?" ou "Merci docteur" quand c\'est approprié.';
      default:
        return 'Adresse-toi à l\'étudiant de manière polie. Attends qu\'il/elle se présente pour savoir comment l\'appeler.';
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    systemPrompt: string,
    query: string,
    conversationHistory: string
  ): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      max_tokens: 300,
      temperature: 0.8, // Slightly creative for natural patient responses
    });

    return response.choices[0]?.message?.content || "Je ne me sens pas bien...";
  }

  /**
   * Extract medical context from AI response
   * NOTE: Symptômes gérés par le LLM + RAG, pas de hardcode
   */
  private extractMedicalContext(response: string): PatientResponse['medicalContext'] {
    // Extraction simplifiée - le LLM gère les symptômes selon ses connaissances
    // Pas de liste hardcodée de symptômes
    
    return {
      symptomsRevealed: [], // LLM + RAG gèrent les symptômes dynamiquement
      questionsAnswered: [], // Pourrait être amélioré avec NLP
      nextSteps: [] // Pourrait suggérer les prochaines étapes diagnostiques
    };
  }

  /**
   * Default patient prompt - SHOULD NOT BE USED
   * Force utilisation des prompts configurés en base de données
   */
  private getDefaultPatientPrompt(): string {
    throw new Error('❌ Aucun prompt patient configuré pour ce scénario. Tous les scénarios doivent avoir un patient_prompt défini en base de données. Pas de prompt générique hardcodé.');
  }

  /**
   * Get conversation memory for a session
   */
  getConversationMemory(sessionId: string): any {
    return conversationMemoryService.getConversationMemory(sessionId);
  }

  /**
   * Get memory statistics for monitoring
   */
  getServiceStats(): {
    memoryStats: any;
    totalSessions: number;
  } {
    return {
      memoryStats: conversationMemoryService.getMemoryStats(),
      totalSessions: conversationMemoryService.getMemoryStats().activeSessions
    };
  }

  /**
   * Clear specific session data
   */
  clearPatientSession(sessionId: string): boolean {
    return conversationMemoryService.clearSession(sessionId);
  }

  /**
   * Validate patient simulator input
   */
  validateInput(input: {
    sessionId?: string;
    email?: string;
    query?: string;
    scenarioId?: number;
  }): { valid: boolean; error?: string } {
    if (!input.sessionId) {
      return { valid: false, error: 'Session ID is required' };
    }

    if (!input.email) {
      return { valid: false, error: 'Student email is required' };
    }

    if (!input.query || input.query.trim().length === 0) {
      return { valid: false, error: 'Query cannot be empty' };
    }

    if (input.query.length > 500) {
      return { valid: false, error: 'Query is too long (max 500 characters)' };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const virtualPatientService = new VirtualPatientService();
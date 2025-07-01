
import { pineconeService } from './pinecone.service';
import { db } from '../db';
import { ecosSessions, ecosScenarios, ecosMessages, ecosEvaluations, ecosReports, trainingSessions, trainingSessionStudents, trainingSessionScenarios } from '@shared/schema';
import { eq, and, desc, lte, gte } from 'drizzle-orm';
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "",
});

export class EcosService {
  async simulatePatient(sessionId: number, studentQuery: string): Promise<string> {
    try {
      // Get session and scenario info
      const sessionResult = await db
        .select({
          patientPrompt: ecosScenarios.patientPrompt,
          title: ecosScenarios.title,
          pineconeIndex: ecosScenarios.pineconeIndex,
        })
        .from(ecosSessions)
        .innerJoin(ecosScenarios, eq(ecosSessions.scenarioId, ecosScenarios.id))
        .where(eq(ecosSessions.id, sessionId))
        .limit(1);

      if (!sessionResult.length) {
        throw new Error('Session not found');
      }

      const { patientPrompt, title, pineconeIndex } = sessionResult[0];

      // Get conversation history
      const history = await this.getSessionHistory(sessionId);

      // Build conversation context
      const messages = [
        {
          role: "system" as const,
          content: `CONTEXTE DU SCÉNARIO: ${title}
Description: ${sessionResult[0].description || 'Pas de description disponible'}

RÔLE ET INSTRUCTIONS SPÉCIFIQUES (À RESPECTER ABSOLUMENT):
${patientPrompt}

INSTRUCTIONS COMPORTEMENTALES OBLIGATOIRES:
- Tu incarnes CE patient précis dans ce scénario médical spécifique
- Reste STRICTEMENT cohérent avec la pathologie décrite: ${sessionResult[0].description}
- Ne jamais inventer d'autres symptômes ou pathologies 
- Réponds uniquement en lien avec le cas médical présenté
- Si l'étudiant pose des questions non liées au cas, rappelle-lui poliment le motif de consultation
- Utilise un langage de patient (pas de termes médicaux techniques)
- Sois réaliste dans tes émotions et préoccupations de patient/parent

RAPPEL CRITIQUE: Ce scénario concerne spécifiquement "${sessionResult[0].description}". Tu ne dois JAMAIS mentionner d'autres symptômes ou pathologies.`
        },
        ...history.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content
        })),
        {
          role: "user" as const,
          content: studentQuery
        }
      ];

      // Get relevant context from the scenario's specific index if available
      let contextDocs = '';
      if (pineconeIndex) {
        try {
          const relevantDocs = await pineconeService.queryVectors(studentQuery, pineconeIndex);
          contextDocs = relevantDocs.map(doc => doc.text).join('\n\n');
        } catch (error) {
          console.log(`Warning: Could not retrieve context from index ${pineconeIndex}:`, error);
        }
      }

      // Generate patient response using direct OpenAI call
      let finalMessages = messages;
      if (contextDocs) {
        // Add context to system message if available
        finalMessages[0].content += `\n\nContexte médical disponible:\n${contextDocs}`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const patientResponse = response.choices[0].message.content || 
        "Je ne peux pas répondre à cette question maintenant.";

      // Save the interaction
      await this.saveInteraction(sessionId, studentQuery, patientResponse);

      return patientResponse;
    } catch (error) {
      console.error('Error in patient simulation:', error);
      throw new Error('Failed to simulate patient response');
    }
  }

  async getSessionHistory(sessionId: number): Promise<Array<{role: string; content: string}>> {
    const messages = await db
      .select({
        role: ecosMessages.role,
        content: ecosMessages.content,
      })
      .from(ecosMessages)
      .where(eq(ecosMessages.sessionId, sessionId))
      .orderBy(ecosMessages.timestamp);

    return messages;
  }

  async saveInteraction(sessionId: number, studentQuery: string, patientResponse: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Save student message
      await tx.insert(ecosMessages).values({
        sessionId,
        role: 'user',
        content: studentQuery,
      });

      // Save patient response
      await tx.insert(ecosMessages).values({
        sessionId,
        role: 'assistant',
        content: patientResponse,
      });
    });
  }

  async startSession(scenarioId: number, studentEmail: string): Promise<number> {
    // Trouver la session de formation active correspondante
    const trainingSessionQuery = await db
      .select({
        trainingSessionId: trainingSessions.id
      })
      .from(trainingSessionStudents)
      .innerJoin(trainingSessions, eq(trainingSessionStudents.trainingSessionId, trainingSessions.id))
      .innerJoin(trainingSessionScenarios, eq(trainingSessions.id, trainingSessionScenarios.trainingSessionId))
      .where(
        and(
          eq(trainingSessionStudents.studentEmail, studentEmail),
          eq(trainingSessionScenarios.scenarioId, scenarioId),
          lte(trainingSessions.startDate, new Date()),
          gte(trainingSessions.endDate, new Date())
        )
      )
      .limit(1);

    const trainingSessionId = trainingSessionQuery.length > 0 ? trainingSessionQuery[0].trainingSessionId : null;

    const result = await db.insert(ecosSessions).values({
      scenarioId,
      studentEmail,
      status: 'in_progress',
      trainingSessionId, // Lier à la session de formation
    }).returning({ id: ecosSessions.id });

    return result[0].id;
  }

  async endSession(sessionId: number): Promise<void> {
    await db.update(ecosSessions)
      .set({ 
        status: 'completed',
        endTime: new Date()
      })
      .where(eq(ecosSessions.id, sessionId));

    // Only trigger evaluation if there are meaningful exchanges
    try {
      const history = await this.getSessionHistory(sessionId);
      const studentMessages = history.filter(msg => msg.role === 'user');
      
      if (history.length >= 2 && studentMessages.length > 0) {
        const { evaluationService } = await import('./evaluation.service');
        await evaluationService.evaluateSession(sessionId);
        console.log(`✅ Evaluation completed for session ${sessionId}`);
      } else {
        console.log(`⚠️ Session ${sessionId} ended without meaningful exchanges - no evaluation generated`);
      }
    } catch (error) {
      console.error(`❌ Failed to evaluate session ${sessionId}:`, error);
      // Don't throw error to avoid breaking session termination
    }
  }

  async getSession(sessionId: number) {
    const result = await db
      .select({
        id: ecosSessions.id,
        status: ecosSessions.status,
        startTime: ecosSessions.startTime,
        endTime: ecosSessions.endTime,
        studentEmail: ecosSessions.studentEmail,
        scenario: {
          id: ecosScenarios.id,
          title: ecosScenarios.title,
          description: ecosScenarios.description,
        }
      })
      .from(ecosSessions)
      .innerJoin(ecosScenarios, eq(ecosSessions.scenarioId, ecosScenarios.id))
      .where(eq(ecosSessions.id, sessionId))
      .limit(1);

    return result[0] || null;
  }

  async getStudentSessions(studentEmail: string) {
    return await db
      .select({
        id: ecosSessions.id,
        status: ecosSessions.status,
        startTime: ecosSessions.startTime,
        endTime: ecosSessions.endTime,
        scenarioTitle: ecosScenarios.title,
        scenarioId: ecosScenarios.id,
      })
      .from(ecosSessions)
      .innerJoin(ecosScenarios, eq(ecosSessions.scenarioId, ecosScenarios.id))
      .where(eq(ecosSessions.studentEmail, studentEmail))
      .orderBy(desc(ecosSessions.startTime));
  }
}

export const ecosService = new EcosService();

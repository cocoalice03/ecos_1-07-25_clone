import { evaluationService } from './evaluation.service';
import { pineconeService } from './pinecone.service';
import { firestore as db } from '../firebase';
import { EcosSession, EcosScenario, EcosMessage, TrainingSession, TrainingSessionStudent, TrainingSessionScenario } from '../types';
import { firestore } from 'firebase-admin';
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "",
});

// Helper to convert Firestore doc to a typed object
function docToType<T>(doc: firestore.DocumentSnapshot): T {
    return { id: doc.id, ...doc.data() } as T;
}

export class EcosService {
  async simulatePatient(sessionId: string, studentQuery: string): Promise<string> {
    try {
      // Get session and scenario info
      const sessionDoc = await db.collection('ecos_sessions').doc(sessionId).get();
      if (!sessionDoc.exists) {
        throw new Error('Session not found');
      }
      const session = docToType<EcosSession>(sessionDoc);

      const scenarioDoc = await db.collection('ecos_scenarios').doc(session.scenarioId).get();
      if (!scenarioDoc.exists) {
        throw new Error('Scenario not found');
      }
      const scenario = docToType<EcosScenario>(scenarioDoc);

      const { patientPrompt, title, pineconeIndex, description } = scenario;

      // Get conversation history
      const history = await this.getSessionHistory(sessionId);

      // Build conversation context
      const messages = [
        {
          role: "system" as const,
          content: `CONTEXTE DU SCÉNARIO: ${title}
Description: ${description || 'Pas de description disponible'}

RÔLE ET INSTRUCTIONS SPÉCIFIQUES (À RESPECTER ABSOLUMENT):
${patientPrompt}

INSTRUCTIONS COMPORTEMENTALES OBLIGATOIRES:
- Tu incarnes CE patient précis dans ce scénario médical spécifique
- Reste STRICTEMENT cohérent avec la pathologie décrite: ${description}
- Ne jamais inventer d'autres symptômes ou pathologies 
- Réponds uniquement en lien avec le cas médical présenté
- Si l'étudiant pose des questions non liées au cas, rappelle-lui poliment le motif de consultation
- Utilise un langage de patient (pas de termes médicaux techniques)
- Sois réaliste dans tes émotions et préoccupations de patient/parent

RAPPEL CRITIQUE: Ce scénario concerne spécifiquement "${description}". Tu ne dois JAMAIS mentionner d'autres symptômes ou pathologies.`
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
          contextDocs = relevantDocs.map(doc => doc.content).join('\n\n');
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

  async getSessionHistory(sessionId: string): Promise<EcosMessage[]> {
    const messagesRef = db.collection('ecos_messages');
    const query = messagesRef.where('sessionId', '==', sessionId).orderBy('timestamp');
    const snapshot = await query.get();
    return snapshot.docs.map(doc => docToType<EcosMessage>(doc));
  }

  async saveInteraction(sessionId: string, studentQuery: string, patientResponse: string): Promise<void> {
    const batch = db.batch();
    const messagesRef = db.collection('ecos_messages');

    const studentMessageRef = messagesRef.doc();
    batch.set(studentMessageRef, {
      sessionId,
      role: 'user',
      content: studentQuery,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    const patientMessageRef = messagesRef.doc();
    batch.set(patientMessageRef, {
      sessionId,
      role: 'assistant',
      content: patientResponse,
      timestamp: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
  }

  async startSession(scenarioId: string, studentEmail: string): Promise<string> {
    // Find the active training session
    const now = firestore.Timestamp.now();
    const trainingSessionsRef = db.collection('training_sessions');
    const trainingSessionQuery = trainingSessionsRef
        .where('startDate', '<=', now)
        .where('endDate', '>=', now);
    const trainingSessionSnapshot = await trainingSessionQuery.get();

    let trainingSessionId: string | undefined;
    for (const doc of trainingSessionSnapshot.docs) {
        const trainingSession = docToType<TrainingSession>(doc);
        const studentQuery = db.collection('training_session_students')
            .where('trainingSessionId', '==', trainingSession.id)
            .where('studentEmail', '==', studentEmail);
        const scenarioQuery = db.collection('training_session_scenarios')
            .where('trainingSessionId', '==', trainingSession.id)
            .where('scenarioId', '==', scenarioId);
        
        const [studentSnapshot, scenarioSnapshot] = await Promise.all([studentQuery.get(), scenarioQuery.get()]);

        if (!studentSnapshot.empty && !scenarioSnapshot.empty) {
            trainingSessionId = trainingSession.id;
            break;
        }
    }

    const newSessionRef = await db.collection('ecos_sessions').add({
      scenarioId,
      studentEmail,
      status: 'in_progress',
      trainingSessionId,
      startTime: firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Session created with ID:', newSessionRef.id);
    return newSessionRef.id;
  }

  async endSession(sessionId: string): Promise<void> {
    await db.collection('ecos_sessions').doc(sessionId).update({ 
        status: 'completed',
        endTime: firestore.FieldValue.serverTimestamp()
    });

    // Only trigger evaluation if there are meaningful exchanges
    try {
      const history = await this.getSessionHistory(sessionId);
      const studentMessages = history.filter(msg => msg.role === 'user');
      
      if (history.length >= 2 && studentMessages.length > 0) {
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

  async getSession(sessionId: string): Promise<(EcosSession & { scenario: EcosScenario }) | null> {
    const sessionDoc = await db.collection('ecos_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
        return null;
    }
    const session = docToType<EcosSession>(sessionDoc);

    const scenarioDoc = await db.collection('ecos_scenarios').doc(session.scenarioId).get();
    if (!scenarioDoc.exists) {
        throw new Error('Scenario not found for session');
    }
    const scenario = docToType<EcosScenario>(scenarioDoc);

    return { ...session, scenario };
  }

  async getStudentSessions(studentEmail: string): Promise<(EcosSession & { scenarioTitle: string })[]> {
    const sessionsRef = db.collection('ecos_sessions');
    const query = sessionsRef.where('studentEmail', '==', studentEmail).orderBy('startTime', 'desc');
    const snapshot = await query.get();

    const sessions = await Promise.all(snapshot.docs.map(async doc => {
        const session = docToType<EcosSession>(doc);
        const scenarioDoc = await db.collection('ecos_scenarios').doc(session.scenarioId).get();
        const scenarioTitle = scenarioDoc.exists ? docToType<EcosScenario>(scenarioDoc).title : 'Unknown Scenario';
        return { ...session, scenarioTitle };
    }));

    return sessions;
  }
}

export const ecosService = new EcosService();

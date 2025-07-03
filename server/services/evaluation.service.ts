import { openaiService } from './openai.service';
import { firestore as db } from '../firebase';
import { EcosSession, EcosScenario, EcosMessage, EcosEvaluation, EcosReport } from '../types';
import { firestore, initializeApp, credential } from 'firebase-admin';

export class EvaluationService {
  async evaluateSession(sessionId: string): Promise<any> {
    console.log(`🔄 Starting evaluation for session ${sessionId}`);

    try {
      // Get session data with messages and scenario
      const sessionData = await this.getSessionWithData(sessionId);

      if (!sessionData) {
        throw new Error('Session not found');
      }

      // Check if we have enough conversation to evaluate
      const conversationHistory = sessionData.messages || [];
      console.log(`📊 Conversation history for session ${sessionId}: ${conversationHistory.length} messages`);

      if (conversationHistory.length < 2) {
        console.log(`⚠️ Insufficient conversation history for session ${sessionId} (${conversationHistory.length} messages)`);

        // Return a special report for empty sessions instead of throwing an error
        const emptySessionReport = {
          sessionId,
          isInsufficientContent: true,
          message: "Évaluation non disponible car la session était vide",
          details: "Aucune interaction entre l'étudiant et le patient n'a été enregistrée pour cette session.",
          scores: {},
          globalScore: 0,
          feedback: "Cette session ne contient aucun échange. Une évaluation nécessite au moins une question de l'étudiant et une réponse du patient.",
          timestamp: new Date().toISOString()
        };

        // Save this empty report to the database
        await this.saveEvaluationReport(sessionId, emptySessionReport);

        return {
          success: true,
          report: emptySessionReport
        };
      }

      // Check if there are actual student questions (user messages)
      const studentMessages = conversationHistory.filter((msg: EcosMessage) => msg.role === 'user');
      if (studentMessages.length === 0) {
        console.log(`⚠️ No student questions found for session ${sessionId}`);
        throw new Error('Aucune question d\'étudiant trouvée dans cette session. Une évaluation nécessite au moins une interaction.');
      }

      // Get session data
      const { evaluationCriteria, title } = sessionData.scenario;

      // Use default criteria if none defined
      const criteria = evaluationCriteria || {
        communication: { name: "Communication", maxScore: 4 },
        anamnese: { name: "Anamnèse", maxScore: 4 },
        examen: { name: "Examen clinique", maxScore: 4 },
        raisonnement: { name: "Raisonnement clinique", maxScore: 4 },
        prise_en_charge: { name: "Prise en charge", maxScore: 4 }
      };

      // Streamlined evaluation prompt for faster processing
      const evaluationPrompt = `Évalue cette consultation ECOS sur ${title}.

Conversation:
${this.formatHistoryForEvaluation(conversationHistory)}

Retourne UNIQUEMENT ce JSON (scores de 0 à 4):
{
  "scores": {
    "anamnese": 3,
    "diagnostic": 2,
    "communication": 4,
    "examen_clinique": 2,
    "prise_en_charge": 3
  },
  "comments": {
    "anamnese": "Commentaire bref",
    "diagnostic": "Commentaire bref", 
    "communication": "Commentaire bref",
    "examen_clinique": "Commentaire bref",
    "prise_en_charge": "Commentaire bref"
  },
  "strengths": ["Point fort 1", "Point fort 2"],
  "weaknesses": ["À améliorer 1", "À améliorer 2"],
  "recommendations": ["Conseil 1", "Conseil 2"]
}`;

      const response = await openaiService.createCompletion({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Tu es un évaluateur médical expert. Évalue de manière constructive et pédagogique."
          },
          {
            role: "user",
            content: evaluationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const evaluationResult = this.parseEvaluation(response.choices[0].message.content);

      // Save evaluation to database
      await this.saveEvaluation(sessionId, evaluationResult);

      // Generate and save report
      const report = await this.generateReport(sessionId, evaluationResult);

      return {
        success: true,
        evaluation: evaluationResult,
        report
      };
    } catch (error) {
      console.error(`❌ Error evaluating session ${sessionId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred during evaluation.'
      };
    }
  }

  async getSessionWithData(sessionId: string): Promise<{ session: EcosSession; scenario: EcosScenario; messages: EcosMessage[] } | null> {
    try {
      const sessionRef = db.collection('ecosSessions').doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        console.error(`No session found with id: ${sessionId}`);
        return null;
      }

      const session = { id: sessionDoc.id, ...sessionDoc.data() } as EcosSession;

      // Fetch the associated scenario
      const scenarioRef = db.collection('ecosScenarios').doc(session.scenarioId);
      const scenarioDoc = await scenarioRef.get();

      if (!scenarioDoc.exists) {
        console.error(`No scenario found with id: ${session.scenarioId}`);
        return null;
      }

      const scenario = { id: scenarioDoc.id, ...scenarioDoc.data() } as EcosScenario;

      // Fetch messages for the session
      const messages = await this.getCompleteSessionHistory(sessionId);

      return {
        session,
        scenario,
        messages,
      };
    } catch (error) {
      console.error('Error fetching session data:', error);
      return null;
    }
  }

  async getCompleteSessionHistory(sessionId: string): Promise<EcosMessage[]> {
    const messagesQuery = db.collection('ecosMessages').where('sessionId', '==', sessionId).orderBy('timestamp', 'asc');
    const messagesSnapshot = await messagesQuery.get();
    return messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EcosMessage));
  }

  formatHistoryForEvaluation(history: EcosMessage[]): string {
    return history.map((msg, index) => {
      const speaker = msg.role === 'user' ? 'ÉTUDIANT' : 'PATIENT';
      return `[${index + 1}] ${speaker}: ${msg.content}`;
    }).join('\n');
  }

  parseEvaluation(evaluationText: string): any {
    try {
      // Find the start and end of the JSON object
      const startIndex = evaluationText.indexOf('{');
      const endIndex = evaluationText.lastIndexOf('}') + 1;
      const jsonText = evaluationText.slice(startIndex, endIndex);

      const parsed = JSON.parse(jsonText);

      // Basic validation
      if (!parsed.scores || !parsed.comments) {
        throw new Error('Invalid evaluation format: missing scores or comments');
      }

      return parsed;
    } catch (error) {
      console.error('Error parsing evaluation JSON:', error);
      // Fallback parsing if simple JSON.parse fails
      return {
        scores: {
          anamnese: this.extractScore(evaluationText, 'anamnese'),
          diagnostic: this.extractScore(evaluationText, 'diagnostic'),
          communication: this.extractScore(evaluationText, 'communication'),
          examen_clinique: this.extractScore(evaluationText, 'examen_clinique'),
          prise_en_charge: this.extractScore(evaluationText, 'prise_en_charge'),
        },
        comments: {
          anamnese: this.extractComment(evaluationText, 'anamnese'),
          diagnostic: this.extractComment(evaluationText, 'diagnostic'),
          communication: this.extractComment(evaluationText, 'communication'),
          examen_clinique: this.extractComment(evaluationText, 'diagnostic'),
          prise_en_charge: this.extractComment(evaluationText, 'prise_en_charge'),
        },
        strengths: this.extractListItems(evaluationText, 'strengths'),
        weaknesses: this.extractListItems(evaluationText, 'weaknesses'),
        recommendations: this.extractListItems(evaluationText, 'recommendations'),
      };
    }
  }

  extractScore(text: string, criterion: string): number {
    const regex = new RegExp(`"${criterion}"\s*:\s*(\d)`);
    const match = text.match(regex);
    if (match && match[1]) {
      const score = parseInt(match[1], 10);
      return isNaN(score) ? 0 : score;
    }
    return 0;
  }

  extractComment(text: string, criterion: string): string {
    const regex = new RegExp(`"${criterion}"\s*:\s*"(.*?)"`);
    const match = text.match(regex);
    return match && match[1] ? match[1] : 'Commentaire non disponible';
  }

  extractListItems(text: string, sectionName: string): string[] {
    const regex = new RegExp(`"${sectionName}"\s*:\s*\[([\s\S]*?)\]`);
    const match = text.match(regex);
    if (!match) return ['Aucun élément identifié'];

    const items = match[1]
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[\d\-\*\s]+/, '').trim())
      .filter(line => line.length > 0);

    // Ensure we always return an array with at least one element
    return items.length > 0 ? items : ['Aucun élément identifié'];
  }

  private async saveEvaluation(sessionId: string, evaluation: any): Promise<void> {
    const scores = evaluation.scores || {};
    const batch = db.batch();

    // Save each criterion evaluation
    for (const [criterionId, score] of Object.entries(scores)) {
      if (typeof score === 'number') {
        const evaluationRef = db.collection('ecosEvaluations').doc();
        batch.set(evaluationRef, {
          sessionId,
          criterionId,
          score: score as number,
          feedback: evaluation.comments?.[criterionId] || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
    await batch.commit();
  }

  private async generateReport(sessionId: string, evaluation: any): Promise<any> {
    // Ensure all fields are properly formatted as arrays
    const strengths = Array.isArray(evaluation.strengths) 
      ? evaluation.strengths 
      : (evaluation.strengths ? [evaluation.strengths] : ['Points forts à identifier']);

    const weaknesses = Array.isArray(evaluation.weaknesses) 
      ? evaluation.weaknesses 
      : (evaluation.weaknesses ? [evaluation.weaknesses] : ['Points à améliorer à identifier']);

    const recommendations = Array.isArray(evaluation.recommendations) 
      ? evaluation.recommendations 
      : (evaluation.recommendations ? [evaluation.recommendations] : ['Recommandations à définir']);

    const report = {
      summary: this.generateSummary(evaluation),
      strengths,
      weaknesses,
      recommendations
    };

    // Save report to database
    const reportRef = db.collection('ecosReports').doc();
    await reportRef.set({
      ...report,
      sessionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return report;
  }

  private generateSummary(evaluation: any): string {
    const scores = evaluation.scores || {};
    const totalScore = Object.values(scores).reduce((sum: number, score: any) => sum + (typeof score === 'number' ? score : 0), 0);
    const maxScore = Object.keys(scores).length * 4;
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    let performance = 'satisfaisante';
    if (percentage >= 80) performance = 'excellente';
    else if (percentage >= 70) performance = 'bonne';
    else if (percentage >= 60) performance = 'satisfaisante';
    else performance = 'à améliorer';

    return `Performance globale ${performance} avec un score de ${totalScore}/${maxScore} (${percentage}%). L'étudiant démontre des compétences cliniques en développement avec des points forts identifiés et des axes d'amélioration ciblés.`;
  }

  async getSessionReport(sessionId: string): Promise<EcosReport | null> {
    const reportQuery = db.collection('ecosReports').where('sessionId', '==', sessionId).limit(1);
    const reportSnapshot = await reportQuery.get();

    if (reportSnapshot.empty) {
      return null;
    }

    const reportDoc = reportSnapshot.docs[0];
    return { id: reportDoc.id, ...reportDoc.data() } as EcosReport;
  }

  private async saveEvaluationReport(sessionId: string, report: any): Promise<void> {
    try {
      const reportRef = db.collection('ecosReports').doc();
      await reportRef.set({
        sessionId,
        summary: report.message, // Use the message for the summary for now
        strengths: [], // No strengths for empty reports
        weaknesses: [], // No weaknesses for empty reports
        recommendations: [], // No recommendations for empty reports
        isInsufficientContent: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Empty session report saved successfully for session ${sessionId}`);
    } catch (error) {
      console.error('Error saving empty session report:', error);
      throw new Error('Failed to save empty session report');
    }
  }
}

export const evaluationService = new EvaluationService();
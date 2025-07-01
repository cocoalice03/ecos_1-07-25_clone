import { openaiService } from './openai.service';
import { db } from '../db';
import { ecosSessions, ecosScenarios, ecosMessages, ecosEvaluations, ecosReports } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class EvaluationService {
  async evaluateSession(sessionId: number): Promise<any> {
    console.log(`🔄 Starting evaluation for session ${sessionId}`);

    try {
      // Get session data with messages and scenario
      const sessionData = await this.getSessionWithData(sessionId);

      if (!sessionData) {
        throw new Error('Session non trouvée');
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
      const studentMessages = conversationHistory.filter((msg: any) => msg.role === 'user');
      if (studentMessages.length === 0) {
        console.log(`⚠️ No student questions found for session ${sessionId}`);
        throw new Error('Aucune question d\'étudiant trouvée dans cette session. Une évaluation nécessite au moins une interaction.');
      }

      // Get session data
      const { evaluationCriteria, title, description } = sessionData.scenario;

      // Use default criteria if none defined
      const criteria = evaluationCriteria || {
        communication: { name: "Communication", maxScore: 4 },
        anamnese: { name: "Anamnèse", maxScore: 4 },
        examen: { name: "Examen clinique", maxScore: 4 },
        raisonnement: { name: "Raisonnement clinique", maxScore: 4 },
        prise_en_charge: { name: "Prise en charge", maxScore: 4 }
      };

      // History already retrieved above for validation

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

      const evaluationText = response.choices[0].message.content;
      const parsedEvaluation = this.parseEvaluation(evaluationText);

      // Save evaluation to database
      await this.saveEvaluation(sessionId, parsedEvaluation);

      // Generate and save report
      const report = await this.generateReport(sessionId, parsedEvaluation);

      return {
        evaluation: parsedEvaluation,
        report
      };
    } catch (error) {
      console.error('Error evaluating session:', error);
      throw new Error('Failed to evaluate session');
    }
  }

  private async getSessionWithData(sessionId: number): Promise<any> {
    try {
      // Get session data first
      const session = await db
        .select()
        .from(ecosSessions)
        .where(eq(ecosSessions.id, sessionId))
        .limit(1);

      if (!session[0]) {
        return null;
      }

      // Get scenario and messages in parallel for better performance
      const [scenario, messages] = await Promise.all([
        // Get scenario data using the session's scenarioId
        session[0].scenarioId ? 
          db
            .select()
            .from(ecosScenarios)
            .where(eq(ecosScenarios.id, session[0].scenarioId))
            .limit(1)
          : Promise.resolve([]),
        
        db
          .select({
            role: ecosMessages.role,
            content: ecosMessages.content,
            timestamp: ecosMessages.timestamp,
          })
          .from(ecosMessages)
          .where(eq(ecosMessages.sessionId, sessionId))
          .orderBy(ecosMessages.timestamp)
      ]);

      return {
        ...session[0],
        scenario: scenario[0] || null,
        messages: messages || []
      };
    } catch (error) {
      console.error('Error fetching session data:', error);
      return null;
    }
  }

  private async getCompleteSessionHistory(sessionId: number) {
    return await db
      .select({
        role: ecosMessages.role,
        content: ecosMessages.content,
        timestamp: ecosMessages.timestamp,
      })
      .from(ecosMessages)
      .where(eq(ecosMessages.sessionId, sessionId))
      .orderBy(ecosMessages.timestamp);
  }

  private formatHistoryForEvaluation(history: any[]): string {
    return history.map((msg: any, index: number) => {
      const speaker = msg.role === 'user' ? 'ÉTUDIANT' : 'PATIENT';
      return `[${index + 1}] ${speaker}: ${msg.content}`;
    }).join('\n\n');
  }

  private parseEvaluation(evaluationText: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = evaluationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Normalize scores if they're on a 0-20 scale instead of 0-4
        if (parsed.scores && typeof parsed.scores === 'object') {
          const normalizedScores: any = {};
          Object.entries(parsed.scores).forEach(([key, score]) => {
            let normalizedScore = typeof score === 'number' ? score : 2;
            
            // If score is greater than 4, assume it's on 0-20 scale and normalize
            if (normalizedScore > 4) {
              normalizedScore = Math.round((normalizedScore / 20) * 4);
            }
            
            // Ensure score is within 0-4 range, default to 2 if 0
            normalizedScore = Math.min(Math.max(normalizedScore, 0), 4);
            if (normalizedScore === 0 && typeof score === 'number' && score > 0) {
              normalizedScore = Math.max(1, Math.round(score * 4 / 20));
            }
            
            normalizedScores[key] = normalizedScore;
          });
          
          parsed.scores = normalizedScores;
        }
        
        return parsed;
      }
    } catch (error) {
      // If JSON parsing fails, extract information using regex
    }

    // Fallback: create structured evaluation from text
    const lines = evaluationText.split('\n');

    return {
      scores: {
        communication: this.extractScore(evaluationText, 'communication'),
        anamnese: this.extractScore(evaluationText, 'anamnèse'),
        examen: this.extractScore(evaluationText, 'examen'),
        raisonnement: this.extractScore(evaluationText, 'raisonnement'),
        prise_en_charge: this.extractScore(evaluationText, 'prise en charge')
      },
      comments: {
        communication: this.extractComment(evaluationText, 'communication'),
        anamnese: this.extractComment(evaluationText, 'anamnèse'),
        examen: this.extractComment(evaluationText, 'examen'),
        raisonnement: this.extractComment(evaluationText, 'raisonnement'),
        prise_en_charge: this.extractComment(evaluationText, 'prise en charge')
      },
      strengths: this.extractListItems(evaluationText, 'points forts|strengths'),
      weaknesses: this.extractListItems(evaluationText, 'points à améliorer|weaknesses|faiblesses'),
      recommendations: this.extractListItems(evaluationText, 'recommandations|recommendations')
    };
  }

  private extractScore(text: string, criterion: string): number {
    // Look for scores in format "criterion: X/4" or "criterion": X
    const regex1 = new RegExp(`${criterion}[\\s\\S]*?(\\d+)[\\s\\/]*4`, 'i');
    const regex2 = new RegExp(`"${criterion}"\\s*:\\s*(\\d+)`, 'i');
    const regex3 = new RegExp(`${criterion}[\\s\\S]*?(\\d+)`, 'i');
    
    let match = text.match(regex1) || text.match(regex2) || text.match(regex3);
    let score = match ? parseInt(match[1]) : 2;
    
    // If score is greater than 4, normalize it to 0-4 scale
    if (score > 4) {
      // Assume it's on a 0-20 scale and convert to 0-4
      score = Math.round((score / 20) * 4);
    }
    
    // Ensure score is within 0-4 range
    return Math.min(Math.max(score, 0), 4);
  }

  private extractComment(text: string, criterion: string): string {
    const regex = new RegExp(`${criterion}[\\s\\S]*?:\\s*([^\\n]*(?:\\n[^\\n]*){0,2})`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : 'Aucun commentaire spécifique';
  }

  private extractListItems(text: string, sectionName: string): string[] {
    const regex = new RegExp(`${sectionName}[\\s\\S]*?([\\d\\-\\*].*?(?=\\n\\n|\\n[A-Z]|$))`, 'i');
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

  private async saveEvaluation(sessionId: number, evaluation: any): Promise<void> {
    const scores = evaluation.scores || {};

    // Save each criterion evaluation
    for (const [criterionId, score] of Object.entries(scores)) {
      if (typeof score === 'number') {
        await db.insert(ecosEvaluations).values({
          sessionId,
          criterionId,
          score: score as number,
          feedback: evaluation.comments?.[criterionId] || '',
        });
      }
    }
  }

  private async generateReport(sessionId: number, evaluation: any): Promise<any> {
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
    await db.insert(ecosReports).values({
      sessionId,
      summary: report.summary,
      strengths: report.strengths,
      weaknesses: report.weaknesses,
      recommendations: report.recommendations,
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

  async getSessionReport(sessionId: number) {
    const report = await db
      .select()
      .from(ecosReports)
      .where(eq(ecosReports.sessionId, sessionId))
      .limit(1);

    return report[0] || null;
  }

    private async saveEvaluationReport(sessionId: number, report: any): Promise<void> {
        try {
            // Convert report object to JSON string
            const reportJSON = JSON.stringify(report);

            // Insert report into database
            await db.insert(ecosReports).values({
                sessionId,
                summary: report.message, // Use the message for the summary for now
                strengths: [], // No strengths for empty reports
                weaknesses: [], // No weaknesses for empty reports
                recommendations: [], // No recommendations for empty reports
            });

            console.log(`✅ Empty session report saved successfully for session ${sessionId}`);
        } catch (error) {
            console.error('Error saving empty session report:', error);
            throw new Error('Failed to save empty session report');
        }
    }
}

export const evaluationService = new EvaluationService();
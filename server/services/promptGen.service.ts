import { openaiService } from './openai.service';
import { pineconeService } from './pinecone.service';

export class PromptGenService {
  async generatePatientPrompt(teacherInput: string, contextDocs: string[] = []): Promise<string> {
    try {
      // Use existing Pinecone service to find relevant medical content
      let embeddedDocs = [];
      try {
        embeddedDocs = await pineconeService.searchRelevantContent(teacherInput);
      } catch (error) {
        console.log('Pinecone not available, using base prompt generation');
      }

      // Combine context documents
      const allContext = [...contextDocs, ...embeddedDocs].join('\n\n');

      const systemPrompt = `Tu es un expert en création de scénarios ECOS (Examen Clinique Objectif Structuré). 
Tu dois créer un prompt détaillé et réaliste pour simuler un patient virtuel.

Le prompt doit:
1. Définir clairement l'identité du patient (âge, sexe, profession, etc.)
2. Décrire les symptômes actuels et l'histoire de la maladie
3. Inclure les antécédents médicaux pertinents
4. Préciser l'état émotionnel et le comportement du patient
5. Définir ce que le patient sait et ne sait pas sur sa condition
6. Inclure des détails sur la personnalité du patient
7. Spécifier comment le patient doit réagir aux différents types de questions

Le prompt résultant sera utilisé pour faire jouer le rôle du patient à une IA lors d'un ECOS avec un étudiant en médecine.`;

      const userPrompt = `Crée un prompt détaillé pour un patient virtuel basé sur cette description du scénario clinique:

${teacherInput}

${allContext ? `Utilise également ces informations contextuelles pour enrichir le scénario:\n${allContext}` : ''}

Assure-toi que le prompt soit suffisamment détaillé pour permettre une interaction réaliste et pédagogique de 15-20 minutes.`;

      const response = await openaiService.generateResponse(
        `Génère un prompt détaillé pour un patient virtuel basé sur cette description de scénario ECOS:\n\n${teacherInput}\n\nDocuments de référence:\n${contextDocs.join('\n\n')}`,
        allContext
      );

      return response;
    } catch (error) {
      console.error('Error generating patient prompt:', error);
      throw new Error('Failed to generate patient prompt');
    }
  }

  async generateEvaluationCriteria(scenarioDescription: string): Promise<any> {
    try {
      const systemPrompt = `Tu es un expert en évaluation ECOS. Crée des critères d'évaluation structurés pour ce scénario clinique.

Les critères doivent inclure:
1. Communication (écoute, empathie, clarté)
2. Anamnèse (questions pertinentes, organisation)
3. Examen clinique (techniques, systématique)
4. Raisonnement clinique (diagnostic différentiel, hypothèses)
5. Prise en charge (plan thérapeutique, suivi)

Chaque critère doit avoir:
- Un nom clair
- Une description détaillée
- Une échelle de notation (0-4 points)
- Des indicateurs de performance pour chaque niveau

Retourne le résultat en format JSON structuré.`;

      const response = await openaiService.createCompletion({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Crée des critères d'évaluation pour ce scénario ECOS:\n\n${scenarioDescription}` }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const criteriaText = response.choices[0].message.content;

      // Try to parse as JSON, fallback to structured text if it fails
      try {
        return JSON.parse(criteriaText);
      } catch {
        // If JSON parsing fails, create a structured object
        return {
          criteria: [
            {
              name: "Communication",
              description: "Évaluation des compétences de communication",
              maxScore: 4,
              details: criteriaText
            }
          ]
        };
      }
    } catch (error) {
      console.error('Error generating evaluation criteria:', error);
      throw new Error('Failed to generate evaluation criteria');
    }
  }
}

export const promptGenService = new PromptGenService();
import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "",
});

export interface RAGContent {
  content: string;
  metadata?: {
    source?: string;
    [key: string]: any;
  };
}

export class OpenAIService {
  private systemPrompt = `You are an educational assistant for a LearnWorlds learning management system. Speak only in French.
Answer questions about the course content based on the context provided.
Be helpful, precise, and concise. If you don't know the answer based on the provided context, say so clearly. If you don't know the answer based on the provided context, say so clearly.
Do not make up information, NEVER. 

IMPORTANT: At the end of EVERY response, you MUST include this exact link in markdown format:
[Cours d'arthrologie du membre supérieur](https://academy.ceerrf.fr/course/arthrologie-du-membre-superieur)

This link must appear at the end of the answer when usefull specially for the first answer.`;

  /**
   * Generates a response for the given question based on relevant content
   */
  async generateResponse(
    question: string,
    relevantContent: RAGContent[] | string,
  ): Promise<string> {
    try {
      // Format the context for better prompt understanding
      let contextText = "";
      if (relevantContent && typeof relevantContent !== 'string' && relevantContent.length > 0) {
        contextText = relevantContent
          .map((item, index) => {
            const source = item.metadata?.source
              ? ` (Source: ${item.metadata.source})`
              : "";
            return `Context ${index + 1}${source}:\n${item.content}\n`;
          })
          .join("\n");
      } else if (typeof relevantContent === 'string') {
        contextText = relevantContent;
      }

      const userPrompt = `Question: ${question}\n\nRelevant Content:\n${contextText}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      });

      return (
        response.choices[0].message.content ||
        "Je n'ai pas pu générer une réponse. Veuillez réessayer."
      );
    } catch (error) {
      console.error("Error generating OpenAI response:", error);
      throw new Error(
        "Impossible de générer une réponse. Service indisponible.",
      );
    }
  }

  /**
   * Create a completion with custom system prompt (for ECOS evaluation)
   */
  async createCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature || 0.5,
        max_tokens: params.max_tokens || 1000,
      });

      return response;
    } catch (error) {
      console.error("Error creating OpenAI completion:", error);
      throw new Error("Impossible de générer une réponse. Service indisponible.");
    }
  }

  /**
   * Convert natural language question to SQL query
   */
  async convertToSQL(question: string, schema: string): Promise<string> {
    try {
      console.log("Conversion SQL - Question reçue:", question);
      console.log("Conversion SQL - Schéma fourni:", schema.substring(0, 200) + "...");

      const prompt = `Tu es un expert en bases de données PostgreSQL. Convertis cette question en langage naturel en requête SQL valide.

Base de données PostgreSQL avec le schéma suivant :
${schema}

Question en français : ${question}

Instructions importantes :
- Génère uniquement une requête SELECT (pas d'INSERT, UPDATE, DELETE)
- Utilise la syntaxe PostgreSQL
- Utilise UNIQUEMENT les tables et colonnes listées dans le schéma ci-dessus
- ATTENTION: Dans la table 'exchanges' la colonne utilisateur s'appelle 'utilisateur_email' (PAS 'email')
- ATTENTION: Dans la table 'daily_counters' la colonne utilisateur s'appelle 'utilisateur_email' (PAS 'email')
- Pour les questions sur les utilisateurs connectés/actifs, utilise la table 'exchanges' avec la colonne 'utilisateur_email'
- Pour les compteurs quotidiens, utilise la table 'daily_counters' avec la colonne 'utilisateur_email'
- Pour les dates, utilise DATE(timestamp) = CURRENT_DATE pour aujourd'hui
- Pour compter les utilisateurs uniques: COUNT(DISTINCT utilisateur_email)
- Inclus les alias de tables si nécessaire
- Réponds uniquement avec la requête SQL, sans explication ni markdown

Requête SQL :`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Tu es un expert en conversion de langage naturel vers SQL. Réponds uniquement avec la requête SQL demandée, sans formatage markdown."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.1,
      });

      let sqlQuery = response.choices[0].message.content?.trim() || "";
      console.log("Réponse OpenAI brute:", sqlQuery);

      // Clean up the response - remove markdown if present
      sqlQuery = sqlQuery.replace(/```sql\s*/gi, '').replace(/```\s*/gi, '');

      // Extract SQL from response if it's wrapped in explanations
      const sqlMatch = sqlQuery.match(/(SELECT[\s\S]*?)(?:\n\s*$|$)/i);
      if (sqlMatch) {
        sqlQuery = sqlMatch[1].trim();
        console.log("SQL extrait:", sqlQuery);
      }

      // Remove trailing semicolon if present
      sqlQuery = sqlQuery.replace(/;\s*$/, '');

      // Basic validation
      if (!sqlQuery.toLowerCase().includes("select")) {
        console.log("Échec validation - pas de SELECT trouvé dans:", sqlQuery);
        throw new Error("Aucune requête SELECT valide trouvée dans la réponse");
      }

      // Additional validation - check if it starts with SELECT
      if (!sqlQuery.toLowerCase().trim().startsWith("select")) {
        console.log("Échec validation - ne commence pas par SELECT:", sqlQuery);
        throw new Error("La requête doit commencer par SELECT");
      }

      console.log("SQL final validé:", sqlQuery);
      return sqlQuery;
    } catch (error) {
      console.error("Error converting to SQL:", error);
      if (error instanceof Error) {
        throw new Error(`Impossible de convertir la question en requête SQL: ${error.message}`);
      }
      throw new Error("Impossible de convertir la question en requête SQL");
    }
  }
}

export const openaiService = new OpenAIService();
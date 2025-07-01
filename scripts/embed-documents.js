import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'learnworlds-courses';
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE || 'default';
const DOCUMENTS_DIR = './documents';
const CHUNK_SIZE = 1000; // Taille approximative de chaque morceau de texte
const CHUNK_OVERLAP = 200; // Chevauchement entre les morceaux

// Initialisation des clients
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pinecone.index(PINECONE_INDEX_NAME);

/**
 * Charge et traite tous les documents du répertoire spécifié
 */
async function processDocuments() {
  try {
    console.log(`Démarrage du traitement des documents dans ${DOCUMENTS_DIR}...`);
    
    // Créer le répertoire des documents s'il n'existe pas
    try {
      await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
    } catch (err) {
      // Ignorer l'erreur si le répertoire existe déjà
    }
    
    // Lister tous les fichiers dans le répertoire
    const files = await fs.readdir(DOCUMENTS_DIR);
    
    if (files.length === 0) {
      console.log('Aucun document trouvé. Veuillez ajouter des fichiers texte dans le répertoire documents/');
      return;
    }
    
    console.log(`${files.length} documents trouvés. Début du traitement...`);
    
    let totalChunks = 0;
    let processedFiles = 0;
    
    // Traiter chaque fichier
    for (const file of files) {
      const filePath = path.join(DOCUMENTS_DIR, file);
      const stats = await fs.stat(filePath);
      
      // Ne traiter que les fichiers (pas les dossiers) et uniquement les fichiers texte
      if (stats.isFile() && (file.endsWith('.txt') || file.endsWith('.md'))) {
        console.log(`Traitement de ${file}...`);
        
        // Lire le contenu du fichier
        const content = await fs.readFile(filePath, 'utf8');
        
        // Diviser le contenu en morceaux (chunks)
        const chunks = splitIntoChunks(content, CHUNK_SIZE, CHUNK_OVERLAP);
        console.log(`${chunks.length} morceaux créés pour ${file}`);
        
        // Créer les embeddings et enregistrer dans Pinecone
        await processChunks(chunks, file);
        
        totalChunks += chunks.length;
        processedFiles++;
      }
    }
    
    console.log(`\nTraitement terminé!`);
    console.log(`${processedFiles} fichiers traités`);
    console.log(`${totalChunks} morceaux intégrés dans Pinecone`);
    
  } catch (error) {
    console.error('Erreur lors du traitement des documents:', error);
  }
}

/**
 * Divise un texte en morceaux de taille approximative
 */
function splitIntoChunks(text, chunkSize, overlap) {
  // Nettoyer le texte
  text = text.replace(/\s+/g, ' ').trim();
  
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);
    
    // Essayer de terminer le morceau à la fin d'une phrase si possible
    if (endIndex < text.length) {
      // Chercher le dernier point ou point d'interrogation dans la plage
      const lastPeriod = Math.max(
        text.lastIndexOf('. ', endIndex),
        text.lastIndexOf('? ', endIndex),
        text.lastIndexOf('! ', endIndex)
      );
      
      if (lastPeriod > startIndex && lastPeriod > startIndex + chunkSize * 0.5) {
        endIndex = lastPeriod + 1;
      }
    }
    
    chunks.push(text.substring(startIndex, endIndex).trim());
    
    // Avancer l'index de départ pour le prochain morceau
    startIndex = endIndex - overlap;
    
    // Éviter les morceaux trop petits à la fin
    if (text.length - startIndex < chunkSize * 0.5) {
      break;
    }
  }
  
  // S'assurer que la fin du texte est incluse
  if (startIndex < text.length) {
    chunks.push(text.substring(startIndex).trim());
  }
  
  return chunks;
}

/**
 * Traite les morceaux de texte, crée des embeddings et les stocke dans Pinecone
 */
async function processChunks(chunks, source) {
  let processed = 0;
  const batchSize = 10; // Nombre de morceaux à traiter en parallèle
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await getEmbeddings(batch);
    
    // Préparer les documents pour Pinecone
    const vectors = batch.map((text, index) => ({
      id: `${source.replace(/\.[^/.]+$/, '')}_${i + index}`,
      values: embeddings[index],
      metadata: {
        text: text,
        source: source,
        chunk_id: i + index
      }
    }));
    
    // Upsert des vecteurs dans Pinecone
    await index.upsert(vectors);
    
    processed += batch.length;
    console.log(`${processed}/${chunks.length} morceaux traités`);
  }
}

/**
 * Obtient les embeddings pour une liste de textes
 */
async function getEmbeddings(texts) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
      encoding_format: "float",
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Erreur lors de la génération des embeddings:', error);
    throw error;
  }
}

// Exécuter le script
processDocuments()
  .then(() => {
    console.log('Indexation terminée avec succès !');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erreur lors de l\'indexation:', error);
    process.exit(1);
  });
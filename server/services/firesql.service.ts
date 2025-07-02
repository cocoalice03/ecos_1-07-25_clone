import { firestore } from '../firebase';
import { FireSQL } from 'firesql';
import { DocumentData } from 'firebase-admin/firestore';

// Convertir l'instance firestore en any pour FireSQL
const fireSQL = new FireSQL(firestore as any);

export class FireSQLService {
    /**
     * Exécute une requête SQL sur Firestore
     * @template T Le type des documents retournés
     * @param sql La requête SQL à exécuter
     * @returns Promise<T[]> Une promesse qui résout avec un tableau de documents du type spécifié
     */
    async query<T extends DocumentData>(sql: string): Promise<T[]> {
        try {
            return await fireSQL.query<T>(sql);
        } catch (error) {
            console.error('Erreur de requête FireSQL :', error);
            throw new Error('Échec de l'exécution de SQL sur Firestore : ' + 
                (error instanceof Error ? error.message : String(error)));
        }
    }
}

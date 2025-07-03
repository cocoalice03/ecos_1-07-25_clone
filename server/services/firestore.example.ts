// Exemple Firestore supprimé - utilisez PostgreSQL
export class FirestoreExampleService {
    async addUser(userData: any) {
        throw new Error('Firestore supprimé - migrez vers PostgreSQL');
    }

    async getUserByEmail(email: string) {
        throw new Error('Firestore supprimé - migrez vers PostgreSQL');
    }

    async getAllEcosScenarios() {
        throw new Error('Firestore supprimé - migrez vers PostgreSQL');
    }
}
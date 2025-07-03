// FireSQL service supprimé - utilisez PostgreSQL avec des requêtes SQL natives
export class FireSQLService {
    async query<T>(sql: string): Promise<T[]> {
        throw new Error('FireSQL supprimé - migrez vers PostgreSQL');
    }
}
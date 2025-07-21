import { db } from '../db';
import { sql } from 'drizzle-orm';

export class DatabaseInitService {
  
  async testConnection(): Promise<boolean> {
    try {
      // Simple test query
      const result = await db.execute(sql`SELECT 1 as test`);
      console.log('✅ Database connection test successful');
      return true;
    } catch (error) {
      console.log('❌ Database connection test failed:', error);
      return false;
    }
  }

  async createTablesIfNotExists(): Promise<void> {
    console.log('🔧 Tables would be created by Drizzle migrations in production');
    return;
  }
}

export const databaseInitService = new DatabaseInitService();
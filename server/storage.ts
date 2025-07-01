import {
  users,
  exchanges,
  dailyCounters,
  type User,
  type UpsertUser,
  type Exchange,
  type InsertExchange,
  type DailyCounter,
  type InsertCounter,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";

// Storage interface with all required methods
export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Chat exchanges
  getExchangesByEmail(email: string, limit?: number): Promise<Exchange[]>;
  saveExchange(exchange: InsertExchange): Promise<Exchange>;

  // Daily counters
  getDailyCounter(email: string, date: Date): Promise<DailyCounter | undefined>;
  createDailyCounter(counter: InsertCounter): Promise<DailyCounter>;
  incrementDailyCounter(email: string, date: Date): Promise<DailyCounter>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Chat exchanges
  async getExchangesByEmail(email: string, limit: number = 50): Promise<Exchange[]> {
    return await db
      .select()
      .from(exchanges)
      .where(eq(exchanges.email, email))
      .orderBy(desc(exchanges.timestamp))
      .limit(limit);
  }

  async saveExchange(exchange: InsertExchange): Promise<Exchange> {
    const [newExchange] = await db
      .insert(exchanges)
      .values(exchange)
      .returning();
    return newExchange;
  }

  // Daily counters
  async getDailyCounter(email: string, date: Date): Promise<DailyCounter | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [counter] = await db
      .select()
      .from(dailyCounters)
      .where(
        and(
          eq(dailyCounters.email, email),
          and(
            sql`${dailyCounters.date} >= ${startOfDay}`,
            sql`${dailyCounters.date} <= ${endOfDay}`
          )
        )
      );
    return counter;
  }

  async createDailyCounter(counter: InsertCounter): Promise<DailyCounter> {
    const [newCounter] = await db
      .insert(dailyCounters)
      .values(counter)
      .returning();
    return newCounter;
  }

  async incrementDailyCounter(email: string, date: Date): Promise<DailyCounter> {
    const existing = await this.getDailyCounter(email, date);
    
    if (existing) {
      const [updated] = await db
        .update(dailyCounters)
        .set({ count: existing.count + 1 })
        .where(
          and(
            eq(dailyCounters.email, email),
            eq(dailyCounters.date, existing.date)
          )
        )
        .returning();
      return updated;
    } else {
      return await this.createDailyCounter({
        email,
        date,
        count: 1,
      });
    }
  }
}

export const storage = new DatabaseStorage();
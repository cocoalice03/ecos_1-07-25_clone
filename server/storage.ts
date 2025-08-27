import { db } from "./db.js";
// Firebase removed - using native Date types
import { User, UpsertUser, Exchange, InsertExchange, DailyCounter, InsertCounter } from "./types.js";

// Firebase removed - helper function no longer needed

// Storage interface with all required methods
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getExchangesByEmail(email: string, limit?: number): Promise<Exchange[]>;
  saveExchange(exchange: InsertExchange): Promise<Exchange>;
  getDailyCounter(email: string, date: Date): Promise<DailyCounter | undefined>;
  createDailyCounter(counter: InsertCounter): Promise<DailyCounter>;
  incrementDailyCounter(email: string, date: Date): Promise<DailyCounter>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const userRef = db.collection('users').doc(id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return undefined;
    }
    return docToType<User>(userDoc);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const usersRef = db.collection('users');
    const query = usersRef.where('email', '==', userData.email);
    const snapshot = await query.get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      await doc.ref.update({
        ...userData,
        updatedAt: firestore.Timestamp.now(),
      });
      const updatedDoc = await doc.ref.get();
      return docToType<User>(updatedDoc);
    } else {
      const newUserRef = await usersRef.add({
          ...userData,
          createdAt: firestore.Timestamp.now(),
          updatedAt: firestore.Timestamp.now(),
      });
      const newUserDoc = await newUserRef.get();
      return docToType<User>(newUserDoc);
    }
  }

  async getExchangesByEmail(email: string, limit: number = 50): Promise<Exchange[]> {
    const exchangesRef = db.collection('exchanges');
    const query = exchangesRef
      .where('email', '==', email)
      .orderBy('timestamp', 'desc')
      .limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => docToType<Exchange>(doc));
  }

  async saveExchange(exchange: InsertExchange): Promise<Exchange> {
    const newExchangeRef = await db.collection('exchanges').add(exchange);
    const newExchangeDoc = await newExchangeRef.get();
    return docToType<Exchange>(newExchangeDoc);
  }

  async getDailyCounter(email: string, date: Date): Promise<DailyCounter | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const countersRef = db.collection('daily_counters');
    const query = countersRef
      .where('email', '==', email)
      .where('date', '==', firestore.Timestamp.fromDate(startOfDay));
    const snapshot = await query.get();

    if (snapshot.empty) {
      return undefined;
    }
    return docToType<DailyCounter>(snapshot.docs[0]);
  }

  async createDailyCounter(counter: InsertCounter): Promise<DailyCounter> {
    const newCounterRef = await db.collection('daily_counters').add(counter);
    const newCounterDoc = await newCounterRef.get();
    return docToType<DailyCounter>(newCounterDoc);
  }

  async incrementDailyCounter(email: string, date: Date): Promise<DailyCounter> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const counterDate = firestore.Timestamp.fromDate(startOfDay);

    const countersRef = db.collection('daily_counters');
    const query = countersRef.where('email', '==', email).where('date', '==', counterDate);

    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(query);
      if (snapshot.empty) {
        const newCounterData: InsertCounter = { email, date: counterDate, count: 1 };
        const newCounterRef = countersRef.doc();
        transaction.set(newCounterRef, newCounterData);
        return { ...newCounterData, id: newCounterRef.id };
      } else {
        const doc = snapshot.docs[0];
        const newCount = (doc.data().count || 0) + 1;
        transaction.update(doc.ref, { count: newCount });
        return { ...docToType<DailyCounter>(doc), count: newCount };
      }
    });
  }
}

export const storage = new DatabaseStorage();
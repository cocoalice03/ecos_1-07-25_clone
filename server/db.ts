import { firestore } from './firebase';

/**
 * This file now exports the Firestore database instance.
 * The original content related to Drizzle/PostgreSQL/SQLite has been removed
 * as part of the migration to Firebase.
 *
 * The Firestore instance is exported as 'db' to minimize initial changes
 * in other files that were importing the database connection.
 */
export { firestore as db };
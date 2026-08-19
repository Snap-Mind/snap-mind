import path from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createInMemoryDb } from '../client.js';
import * as schema from '../schema.js';

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '..', 'migrations');

export function makeTestDb() {
  const sqlite = createInMemoryDb();
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { sqlite, db };
}

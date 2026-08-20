import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createInMemoryDb } from '../client.js';
import * as schema from '../schema.js';

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '..', 'migrations');

export function makeTestDb(): {
  sqlite: BetterSqlite3.Database;
  db: BetterSQLite3Database<typeof schema>;
} {
  const sqlite = createInMemoryDb();
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { sqlite, db };
}

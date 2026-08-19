import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type BetterSqlite3 from 'better-sqlite3';
import * as schema from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveMigrationsFolder(isPackaged: boolean, resourcesPath: string): string {
  return isPackaged
    ? path.join(resourcesPath, 'db-migrations')
    : path.join(__dirname, 'migrations');
}

export function runMigrations(sqlite: BetterSqlite3.Database, migrationsFolder: string): void {
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
}

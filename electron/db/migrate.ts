import path from 'node:path';
import process from 'node:process';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type BetterSqlite3 from 'better-sqlite3';
import * as schema from './schema.js';

export function resolveMigrationsFolder(isPackaged: boolean, resourcesPath: string): string {
  return isPackaged
    ? path.join(resourcesPath, 'db-migrations')
    : path.join(process.cwd(), 'electron', 'db', 'migrations');
}

export function runMigrations(sqlite: BetterSqlite3.Database, migrationsFolder: string): void {
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
}

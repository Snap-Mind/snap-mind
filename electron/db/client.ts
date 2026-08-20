import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';

export function openDatabase(dbPath: string): BetterSqlite3.Database {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  return sqlite;
}

export function createInMemoryDb(): BetterSqlite3.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

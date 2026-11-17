import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveMigrationsFolder } from '../migrate.js';

describe('resolveMigrationsFolder', () => {
  it('reads db-migrations from the packaged resources directory', () => {
    expect(resolveMigrationsFolder(true, '/Resources')).toBe(
      path.join('/Resources', 'db-migrations')
    );
  });

  it('reads migrations from src/main when unpackaged', () => {
    expect(resolveMigrationsFolder(false, '/Resources')).toBe(
      path.join(process.cwd(), 'src/main/db/migrations')
    );
  });
});

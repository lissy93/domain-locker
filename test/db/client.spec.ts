import { describe, expect, it } from 'vitest';
import { sqliteOpenAdvice } from '../../src/server/db/client';

const errorWith = (message: string, code?: string) =>
  Object.assign(new Error(message), code ? { code } : {});

/**
 * Both failures read alike in a log, but the fixes have nothing in common, so
 * the wrong hint sends people to check permissions over a stale binary
 */
describe('sqliteOpenAdvice', () => {
  it('points at the path when the file cannot be written', () => {
    expect(sqliteOpenAdvice(errorWith('permission denied', 'EACCES'))).toContain(
      'DL_SQLITE_PATH',
    );
  });

  it('points at the path when SQLite itself refuses to open it', () => {
    expect(sqliteOpenAdvice(errorWith('unable to open', 'SQLITE_CANTOPEN'))).toContain(
      'DL_SQLITE_PATH',
    );
  });

  it('points at a rebuild when the native binary was built for another Node', () => {
    const advice = sqliteOpenAdvice(
      errorWith('was compiled against a different Node.js version'),
    );
    expect(advice).toContain('npm rebuild better-sqlite3');
    expect(advice).not.toContain('DL_SQLITE_PATH');
  });

  it('points at a rebuild when the binary fails to register', () => {
    expect(sqliteOpenAdvice(errorWith('Module did not self-register'))).toContain(
      'npm rebuild better-sqlite3',
    );
  });
});

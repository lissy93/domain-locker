import { readFileSync } from 'node:fs';

/** Load test/.env.test if present, without pulling in a dotenv dependency */
try {
  for (const line of readFileSync('test/.env.test', 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) process.env[match[1]] ??= match[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  // No local overrides, fall back to defaults
}

process.env['NODE_ENV'] ??= 'test';
process.env['DL_ENV_TYPE'] ??= 'selfHosted';

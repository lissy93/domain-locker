import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

/** Node-environment suite for server, schema and data-layer contract tests */
export default defineConfig({
  resolve: {
    alias: { '~': path.resolve(__dirname, '../src') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});

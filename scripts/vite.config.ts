import { defineConfig } from 'vite';
import * as path from 'node:path';

/** Minimal config for the maintenance scripts, without the Angular build */
export default defineConfig({
  resolve: { alias: { '~': path.resolve(__dirname, '../src') } },
});

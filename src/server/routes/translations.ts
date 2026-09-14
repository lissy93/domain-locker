import { defineEventHandler, getQuery } from 'h3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Logger from '../utils/logger';

const log = new Logger('translations');

/**
 * Used for SSR to load translatable text content to be rendered on the server
 * Will use English (en) by default unless the `lang` query parm is specified
 */
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const requestedLang = query['lang'] || 'en';

  // Sanitize, so param only accepts valid lang codes, to prevent a path traversal attack
  const lang = /^[a-zA-Z0-9.-]+$/.test(requestedLang as string) ? requestedLang : 'en';

  // Paths can vary depending on environment
  const productionPath = join(process.cwd(), `dist/analog/public/i18n/${lang}.json`);
  const devPath = join(process.cwd(), `src/assets/i18n/${lang}.json`);
  const filePath = existsSync(productionPath) ? productionPath : devPath;

  try {
    const translations = JSON.parse(readFileSync(filePath, 'utf8'));
    return { translations };
  } catch (error) {
    log.error(`Failed to load translation file for "${lang}": ${error}`);
    return { error: `Translation file not found for language: ${lang}` };
  }
});

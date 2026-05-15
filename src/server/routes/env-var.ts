import { defineEventHandler, getQuery } from 'h3';

/**
 * GET /api/env-var
 *   => returns all environment variables that begin with "DL_" or "SUPABASE_"
 * GET /api/env-var?key=DL_PG_HOST
 *   => returns a single environment variable
 */
export default defineEventHandler((event) => {
  const environmentVariables = process.env || import.meta.env || {};
  const envType = environmentVariables['DL_ENV_TYPE'] || 'selfHosted';
  if (envType !== 'selfHosted') {
    return {
      error: true,
      message: 'This endpoint is only available for selfHosted environment.',
    };
  }

  // Check if user requested a specific key
  const { key } = getQuery(event) as { key?: string };

  if (!key) {
    // No key param => return all env vars beginning with DL_ or SUPABASE_
    const envVars: Record<string, string> = {};
    for (const [envKey, envValue] of Object.entries(environmentVariables)) {
      if (
        (envKey.startsWith('DL_') || envKey.startsWith('SUPABASE_')) &&
        !envKey.includes('_POSTGRES')
      ) {
        envVars[envKey] = envValue || '';
      }
    }
    return {
      error: false,
      env: envVars,
    };
  } else {
    // Single key fetch
    const value = environmentVariables[key] || '';
    return {
      error: false,
      key,
      value,
    };
  }
});

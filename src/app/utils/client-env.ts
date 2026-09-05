declare const __DL_CLIENT_ENV__: Record<string, string> | undefined;

/**
 * Client-safe environment baked in at build time. Only the variables allowlisted
 * in src/server/utils/client-env.ts reach the browser, so secrets such as
 * DL_PG_PASSWORD can never be inlined into a bundle.
 */
export const BUILD_ENV: Record<string, string> =
  typeof __DL_CLIENT_ENV__ === 'undefined' ? {} : __DL_CLIENT_ENV__;

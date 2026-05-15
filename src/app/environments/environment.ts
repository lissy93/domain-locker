/**
 * Environment values are handled by the environment.service.ts
 * By default, it uses the environmental variables (e.g. from the .env file)
 * If the environment variable is not set, it falls back to the values in this file
 * The difference between the two is that these values are dynamic and can be changed at runtime,
 * where as the values in the .env file are static and are set at build time.
 *
 *
 * This file will be replaced by the environment.[environment].ts file during the build process
 * See the environment.service.ts or docs for all available variable keys.
 * See the end of this file, on how to add additional environments.
 *
 * IMPORTANT:
 * - Do not add sensitive information here, as it can be accessed by the client
 * - Do not commit new environment files to source control if they contain secrets
 * - Don't use this file directly, instead use the environment.service.ts
 *   to retrieve the values, because it provides type checking and error handling
 */

export const environment = {
  // production: true,
  // Examples:
  // BASE_URL: 'http://localhost:5173',
  // SUPABASE_URL: '',        // Supabase URL
  // SUPABASE_ANON_KEY: '',   // Supabase public key
  // ENV_TYPE: '',            // EnvironmentType (dev, managed, selfHosted, demo)
  // SUPABASE_PROJECT: '',    // Supabase project ID
  // DEBUG: '',               // Enable debug mode, to show debug messages
  // GLITCHTIP_DSN: '',       // GlitchTip DSN, for error tracking
  // PLAUSIBLE_URL: '',       // URL to Plausible instance, for hit counting
  // PLAUSIBLE_SITE: '',      // Plausible site ID /  URL, for hit counting
};

/**
 Adding additional environments:

 **Step 1: Create a new environment file**
  src/environments/
  ├── environment.ts
  ├── environment.[environment-name].ts

**Step 2: Update the Angular configuration in angular.json**
  "configurations": {
    "[environment-name]": {
      "fileReplacements": [
        {
          "replace": "src/environments/environment.ts",
          "with": "src/environments/environment.[environment-name].ts"
        }
      ]
    }
  }

**Step 3: Build the application with the new environment**
    ng build --configuration=[environment-name]

 */

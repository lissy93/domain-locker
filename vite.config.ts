/// <reference types="vitest" />
import analog, { PrerenderContentFile } from '@analogjs/platform';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import packageJson from './package.json';
import * as path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { pickClientEnv } from './src/server/utils/client-env';

/**
 * Analog's dev server only forwards `/api` requests to Nitro, so `/v1` calls
 * would fall through to the app and render its 404 page. Re-prefixing them
 * gets them forwarded, and Nitro strips the prefix again, leaving it with the
 * same URL it serves directly in production.
 */
function serveApiInDev(): PluginOption {
  return {
    name: 'domain-locker-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/v1/')) req.url = `/api${req.url}`;
        next();
      });
    },
  };
}

const themeTargets = [
  {
    src: 'node_modules/primeng/resources/themes/lara-dark-purple/theme.css',
    rename: 'purple-dark.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/lara-light-purple/theme.css',
    rename: 'purple-light.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/vela-orange/theme.css',
    rename: 'orange-dark.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/saga-orange/theme.css',
    rename: 'orange-light.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/md-dark-indigo/theme.css',
    rename: 'indigo-dark.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/md-light-indigo/theme.css',
    rename: 'indigo-light.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/bootstrap4-dark-blue/theme.css',
    rename: 'blue-dark.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/bootstrap4-light-blue/theme.css',
    rename: 'blue-light.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/lara-dark-teal/theme.css',
    rename: 'teal-dark.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/lara-light-teal/theme.css',
    rename: 'teal-light.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/arya-green/theme.css',
    rename: 'green-dark.css',
  },
  {
    src: 'node_modules/primeng/resources/themes/saga-green/theme.css',
    rename: 'green-light.css',
  },
];

/**
 * Each theme.css references ./fonts, so the sibling directory has to ship too.
 * Themes share font files, and copying one twice makes the copy plugin fail,
 * so each filename is taken from a single theme.
 */
const themeFontTargets = Object.values(
  Object.fromEntries(
    themeTargets
      .map((target) => target.src.replace('theme.css', 'fonts'))
      .filter((dir) => existsSync(dir))
      .flatMap((dir) =>
        readdirSync(dir).map((file) => [file, path.posix.join(dir, file)] as const),
      ),
  ),
).map((src) => ({ src, dest: 'themes/fonts' }));

export default defineConfig( ({ command, mode }) => {

  // So as to not touch DN or start scheduler while Nitro is building
  if (command === 'build') process.env['DL_BUILDING'] = 'true';

  const env = loadEnv(mode, process.cwd(), '')
  const buildPreset = env['BUILD_PRESET'] || env['NITRO_PRESET'] || 'node_server';
  const targetEnv = env['DL_ENV_TYPE'] || 'unspecified/self-hosted';
  const nitroPreset =  buildPreset || 'node_server';

  // Print info message
  const emoji: any = {'vercel': '🔼', 'netlify': '🪁', 'deno': '🦕', 'bun': '🐰'};
  console.log(`${emoji[buildPreset] || '🚀'} Building for ${buildPreset} as ${mode} mode for ${targetEnv} environment`);

  return {
    base: '/',
    publicDir: 'src/assets',
    optimizeDeps: {
      include: ['@angular/common'],
    },
    ssr: {
      noExternal: [
        '@spartan-ng/**',
        '@angular/cdk/**',
        '@ng-icons/**',
      ]
    },
    build: {
      target: ['es2020'],
      sourcemap: mode === 'development' ? 'inline' : false,
      outDir: 'dist',
      assetsDir: 'assets',
      minify: 'terser',
    },
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      serveApiInDev(),
      analog({
        prerender: {
          routes: [ // Unauthenticated SSG routes
            '/',
            '/login',
            '/about',
            '/about/*',
            {
              contentDir: 'src/content/docs/developing',
              transform: (file: PrerenderContentFile) => {
                const slug = file.attributes['slug'] || file.name;
                return `/about/developing/${slug}`;
              },
            },
            {
              contentDir: 'src/content/docs/legal',
              transform: (file: PrerenderContentFile) => {
                const slug = file.attributes['slug'] || file.name;
                return `/about/legal/${slug}`;
              },
            },
          ],
          sitemap: {
            host: 'https://domain-locker.com',
          },

        },
        nitro: {
          preset: nitroPreset,
          sourceMap: false,
        },
        content: {
          highlighter: 'prism',
          prismOptions: {
            additionalLangs: ['diff', 'yaml'],
          },
        },
      }),
      viteStaticCopy({
        targets: [
          ...themeTargets.map((target) => ({
            src: target.src,
            dest: 'themes',
            rename: target.rename,
          })),
          ...themeFontTargets,
        ],
      }),
    ],

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      // Node-environment server and schema suites live in test/ (npm run test:server)
      include: ['src/**/*.spec.ts'],
    },
    envPrefix: ['VITE_'],
    define: {
      'import.meta.vitest': mode !== 'production',
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __APP_NAME__: JSON.stringify(env['APP_NAME'] || 'Domain Locker'),
      __DL_CLIENT_ENV__: JSON.stringify(pickClientEnv(env)),
    },
    server: {
      fs: {
        allow: ['..'],
      },
    },
  };
});

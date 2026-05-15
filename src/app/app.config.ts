import {
  ApplicationConfig,
  importProvidersFrom,
  APP_INITIALIZER,
  PLATFORM_ID,
  APP_ID,
} from '@angular/core';
// Importing providers
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideFileRouter } from '@analogjs/router';
import { withShikiHighlighter } from '@analogjs/content/shiki-highlighter';
import { provideContent, withMarkdownRenderer } from '@analogjs/content';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService, MessageService } from 'primeng/api';
// Importing router providers
import {
  withEnabledBlockingInitialNavigation,
  withInMemoryScrolling,
} from '@angular/router';
// Importing translation providers
import {
  MissingTranslationHandler,
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import {
  ServerSafeTranslateLoader,
  languageInitializerFactory,
  CustomMissingTranslationHandler,
} from '~/app/utils/translation-loader.factory';

import { AuthInterceptor } from '~/app/utils/auth.interceptor';
import { EnvLoaderService } from './utils/env.loader';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_ID, useValue: 'domain-locker' },

    // Transfer relevant env vars on self-hosted version
    {
      provide: APP_INITIALIZER,
      useFactory: (envLoader: EnvLoaderService) => () => envLoader.loadEnv(),
      deps: [EnvLoaderService],
      multi: true,
    },
    // Core Providers
    provideHttpClient(withFetch()),
    provideClientHydration(),
    provideContent(withMarkdownRenderer(), withShikiHighlighter()),
    provideAnimations(),
    provideFileRouter(
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      withEnabledBlockingInitialNavigation(),
    ),
    // HTTP Interceptors
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },

    // PrimeNG Services
    ConfirmationService,
    MessageService,

    // Translation Module, and language initialization
    {
      provide: APP_INITIALIZER,
      useFactory: languageInitializerFactory,
      deps: [TranslateService, PLATFORM_ID],
      multi: true,
    },
    importProvidersFrom(
      TranslateModule.forRoot({
        useDefaultLang: true,
        loader: {
          provide: TranslateLoader,
          useClass: ServerSafeTranslateLoader,
        },
        missingTranslationHandler: {
          provide: MissingTranslationHandler,
          useClass: CustomMissingTranslationHandler,
        },
      }),
    ),
  ],
};

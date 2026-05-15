import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { from, Observable, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { EnvService } from '~/app/services/environment.service';
import { SupabaseService } from '~/app/services/supabase.service';

/**
 * AuthInterceptor is an HTTP interceptor that adds authentication headers
 * This will intercept all outgoing HTTP requests, made using Angular's HttpClient.
 * If the request is going to /api/ or Supabase functions, we authenticate them,
 * attaching the user's session bearer token as JWT
 * Otherwise, we just pass through the request without modification
 */

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private envService = inject(EnvService);
  private supabaseService = inject(SupabaseService);

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const environment = this.envService.getEnvironmentType();
    const isSupabaseEnabled = this.supabaseService.isSupabaseEnabled();

    // Bypass auth for OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return next.handle(request);
    }

    // Apply auth only in 'managed' environment
    if (environment === 'managed' && request.url.startsWith('/api/')) {
      return from(this.supabaseService.getSessionData()).pipe(
        switchMap((sessionData: { session?: { access_token?: string } }) => {
          const token = sessionData?.session?.access_token;

          if (token) {
            const authRequest = request.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`,
              },
            });
            return next.handle(authRequest);
          }
          return next.handle(request);
        }),
      );
    }

    // For requests to Supabase functions, we need to get the session token and attach to request
    if (request.url.includes('.supabase.co/functions/')) {
      if (!isSupabaseEnabled) {
        // User shouldn't be calling Supabase, if Supabase is not enabled!
        return throwError(
          () => new Error('Supabase is not enabled in this environment.'),
        );
      }

      return from(this.supabaseService.getSessionToken()).pipe(
        switchMap((token) => {
          if (!token) {
            const err = new Error('No Supabase session token available');
            return throwError(() => err);
          }
          // clone and set the header
          const authed = request.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
          });
          return next.handle(authed);
        }),
        catchError((error) => {
          return throwError(() => error);
        }),
      );
    }

    // All other requests (other endpoints, other environments)
    // just get passed through and invoked as normal
    return next.handle(request);
  }
}

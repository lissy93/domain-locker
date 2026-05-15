import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { map, takeUntil, catchError } from 'rxjs/operators';
import DatabaseService from './database.service';
import { Registrar } from '~/app/../types/common';
import { ErrorHandlerService } from './error-handler.service';

export interface RegistrarWithCount {
  registrar: Registrar;
  domainCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class RegistrarAutocompleteService implements OnDestroy {
  private databaseService = inject(DatabaseService);
  private errorHandler = inject(ErrorHandlerService);

  private registrarsWithCounts$ = new BehaviorSubject<RegistrarWithCount[]>([]);
  private isLoading$ = new BehaviorSubject<boolean>(false);
  private hasError$ = new BehaviorSubject<boolean>(false);
  private sortedTopRegistrars: string[] = [];
  private destroy$ = new Subject<void>();
  private hasLoaded = false;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.registrarsWithCounts$.complete();
    this.isLoading$.complete();
    this.hasError$.complete();
  }

  /**
   * Loads registrars and their domain counts, merges them, and caches the sorted list
   */
  loadRegistrars(): void {
    if (this.hasLoaded && !this.hasError$.value) {
      return; // Already loaded successfully
    }

    this.isLoading$.next(true);
    this.hasError$.next(false);

    combineLatest([
      this.databaseService.instance.registrarQueries.getRegistrars(),
      this.databaseService.instance.registrarQueries.getDomainCountsByRegistrar(),
    ])
      .pipe(
        map(([registrars, counts]) => {
          return registrars.map((registrar) => ({
            registrar,
            domainCount: counts[registrar.name] || 0,
          }));
        }),
        takeUntil(this.destroy$),
        catchError((error) => {
          this.errorHandler.handleError({
            error,
            message: 'Failed to load registrars for autocomplete',
            location: 'RegistrarAutocompleteService.loadRegistrars',
            showToast: false,
          });
          this.hasError$.next(true);
          this.isLoading$.next(false);
          throw error;
        }),
      )
      .subscribe({
        next: (registrarsWithCounts) => {
          this.registrarsWithCounts$.next(registrarsWithCounts);

          // Pre-compute and cache the sorted top 25 registrars
          this.sortedTopRegistrars = [...registrarsWithCounts]
            .sort((a, b) => b.domainCount - a.domainCount)
            .slice(0, 25)
            .map((r) => r.registrar.name)
            .filter((name) => name != null); // Null safety

          this.isLoading$.next(false);
          this.hasLoaded = true;
        },
        error: () => {
          // Error already handled in catchError
        },
      });
  }

  /**
   * Filters registrars based on search query
   * Returns top 25 most-used registrars when query is empty
   */
  filterRegistrars(query: string): string[] {
    const trimmedQuery = query?.toLowerCase().trim();

    if (!trimmedQuery) {
      // Return pre-computed top registrars (no sorting needed!)
      return this.sortedTopRegistrars;
    }

    // Filter by name with null safety
    return this.registrarsWithCounts$.value
      .filter((r) => r.registrar.name?.toLowerCase().includes(trimmedQuery))
      .map((r) => r.registrar.name)
      .filter((name) => name != null); // Additional null safety
  }

  /**
   * Observable streams for component subscriptions
   */
  getIsLoading$(): Observable<boolean> {
    return this.isLoading$.asObservable();
  }

  getHasError$(): Observable<boolean> {
    return this.hasError$.asObservable();
  }

  getRegistrarsWithCounts$(): Observable<RegistrarWithCount[]> {
    return this.registrarsWithCounts$.asObservable();
  }

  /**
   * Current state getters for synchronous access
   */
  get isLoading(): boolean {
    return this.isLoading$.value;
  }

  get hasError(): boolean {
    return this.hasError$.value;
  }

  get hasData(): boolean {
    return this.registrarsWithCounts$.value.length > 0;
  }
}

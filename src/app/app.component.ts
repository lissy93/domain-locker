// Angular
import {
  Component,
  OnInit,
  PLATFORM_ID,
  OnDestroy,
  ChangeDetectorRef,
  ErrorHandler,
  inject,
} from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';

// Dependencies
import { MessageService, ConfirmationService } from 'primeng/api';
import { filter, Subscription } from 'rxjs';

// PrimeNG module importing required components
import { PrimeNgModule } from '~/app/prime-ng.module';

// Furniture Components
import { NavbarComponent } from '~/app/components/navbar/navbar.component';
import { FooterComponent } from '~/app/components/footer/footer.component';
import { LoadingComponent } from '~/app/components/misc/loading.component';
import { BreadcrumbsComponent } from '~/app/components/misc/breadcrumbs.component';

// Services
import { ThemeService } from '~/app/services/theme.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { SupabaseService } from '~/app/services/supabase.service';
import { HitCountingService } from '~/app/services/hit-counting.service';
import {
  ErrorHandlerService,
  GlobalErrorHandler,
} from '~/app/services/error-handler.service';
import { AccessibilityService } from '~/app/services/accessibility-options.service';
import { EnvService } from '~/app/services/environment.service';
import { FeatureService } from '~/app/services/features.service';
import { MetaTagsService } from '~/app/services/meta-tags.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    PrimeNgModule,
    CommonModule,
    NavbarComponent,
    FooterComponent,
    LoadingComponent,
    BreadcrumbsComponent,
  ],
  providers: [
    MessageService,
    ErrorHandlerService,
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
  template: `
    <!-- Navbar -->
    <app-navbar />
    <div class="main-container">
      <!-- Main content container -->
      <div class="content-container" [ngClass]="{ full: isFullWidth }">
        <!-- Create router outlet -->
        @if (pagePath) {
          <app-breadcrumbs [pagePath]="pagePath" />
        }
        <!-- Router outlet for main content -->
        @if (!loading || publicPath) {
          <router-outlet />
        }
        <!-- Global components -->
        <p-scrollTop />
        <p-toast />
        <p-confirmDialog />
      </div>
      <!-- Footer -->
      <app-footer [big]="isBigFooter" />
      <!-- While initializing, show loading spinner (not on public pages) -->
      @if (showInitLoader) {
        <app-loading [isAbsolute]="true" />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
    `,
  ],
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private supabaseService = inject(SupabaseService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private globalMessageService = inject(GlobalMessageService);
  private errorHandler = inject(ErrorHandlerService);
  _themeService = inject(ThemeService);
  hitCountingService = inject(HitCountingService);
  private accessibilityService = inject(AccessibilityService);
  private environmentService = inject(EnvService);
  private featureService = inject(FeatureService);
  private metaTagsService = inject(MetaTagsService);
  private platformId = inject<object>(PLATFORM_ID);

  private subscription: Subscription | undefined;
  private publicRoutes = new Set([
    '/home',
    '/about',
    '/login',
    '/advanced',
    '/preview',
    '/advanced/status',
    '/advanced/debug-info',
    '/advanced/admin-links',
  ]);
  private fullWidthRoutes: string[] = ['/settings', '/stats'];

  public loading = true;
  public pagePath = '';
  public isFullWidth = false;
  public isBigFooter = false;

  ngOnInit() {
    // Setup error handling, and pretty console
    this.errorHandler.printInitialDetails();
    this.errorHandler.initializeGlitchTip();
    this.errorHandler.initializeWindowCatching();

    // Set meta tags on route change
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((event) => {
        const navEndEvent = event as NavigationEnd;
        // Set meta tags for the current route
        this.metaTagsService.setRouteMeta(navEndEvent.urlAfterRedirects);
        // Track page view for analytics
        this.hitCountingService.trackPageView(navEndEvent.urlAfterRedirects);
      });

    // Check auth state
    if (isPlatformBrowser(this.platformId)) {
      // Listen for route changes (on browser only)
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
          const currentRoute = event.urlAfterRedirects || event.url;
          this.pagePath = currentRoute;

          // Configuration for docs pages (at /about)
          if (currentRoute.startsWith('/about')) {
            this.checkIfDocsDisabled(currentRoute);
            this.isBigFooter = true;
          } else {
            this.isBigFooter = false;
          }

          // Some pages should be full wider (like /settings or /stats), we add a class if they are active
          this.isFullWidth = this.fullWidthRoutes.some((route) =>
            currentRoute.includes(route),
          );

          // Public route: no auth, set meta tags, and show the outlet
          if (this.isPublicRoute(currentRoute, false)) {
            this.loading = false;
            this.metaTagsService.allowRobots(true);
            return; // No auth needed for public routes
          }

          // Private route (auth required and bot no index)
          this.metaTagsService.allowRobots(false);

          // Auth needed for current route, check if user authenticated
          this.checkAuthentication()
            .then((isAuthenticated) => {
              if (!isAuthenticated) {
                this.redirectToLogin();
                return;
              }
            })
            .catch(async (error) => {
              this.errorHandler.handleError({
                error,
                message: 'Unable to validate auth state',
                showToast: true,
                location: 'app.component',
              });
            })
            .finally(() => {
              this.loading = false;
              this.cdr.detectChanges();
            });
        }
      });
    }
    // Initialize the global message service for showing toasts
    this.subscription = this.globalMessageService.getMessage().subscribe((message) => {
      if (message) {
        this.messageService.add(message);
      } else {
        this.messageService.clear();
      }
    });

    // Apply accessibility classes based on user preference
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.accessibilityService.applyAccessibilityClasses(), 0);
    }
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  get publicPath(): boolean {
    return this.isPublicRoute(this.pagePath, true);
  }

  // Init loader is only for awaiting user data, so hide it on public pages (home, about, etc)
  get showInitLoader(): boolean {
    return this.loading && !this.isPublicRoute(this.pagePath || this.router.url, true);
  }

  private isPublicRoute(route: string, allowHome = false): boolean {
    if (!route) return true;
    if (route === '/' && allowHome) return true;
    if (this.publicRoutes.has(route)) return true;
    if (route.startsWith('/about')) return true;
    if (route.startsWith('/preview')) return true;
    if (route.startsWith('/login')) return true;
    return false;
  }

  /* Check if user is authenticated, and take appropriate action */
  private async checkAuthentication(): Promise<boolean> {
    // No need to continue if visiting homepage or public route
    if (this.isPublicRoute(this.pagePath, true)) {
      return Promise.resolve(true);
    }

    // Cancel if Supabase auth isn't enabled or setup
    if (!this.environmentService.isSupabaseEnabled()) {
      return Promise.resolve(true);
    }

    try {
      // Check if authenticated
      const isAuthenticated = await this.supabaseService.isAuthenticated();
      if (!isAuthenticated) {
        // Not authenticated, redirect to login
        return Promise.resolve(false);
      }

      // Authenticated, now check if MFA is required
      const hasMFA = await this.supabaseService.isMFAEnabled();
      if (hasMFA) {
        const { currentLevel } =
          await this.supabaseService.getAuthenticatorAssuranceLevel();
        if (currentLevel !== 'aal2') {
          await this.router.navigate(['/login'], {
            queryParams: { requireMFA: 'true' },
          });
        }
      }
      return Promise.resolve(true);
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Unable to verify auth status, please log in again',
        showToast: true,
        location: 'app.component',
      });
      throw error;
    }
  }

  private redirectToLogin() {
    this.router.navigate(['/login']).then(() => {
      this.loading = false;
    });
  }

  /* Check if documentation enabled before navigating to any /about page */
  private async checkIfDocsDisabled(docsPath?: string): Promise<void> {
    if (!(await this.featureService.isFeatureEnabledPromise('enableDocs'))) {
      // Docs disabled, show warning and navigate back to home
      this.globalMessageService.showWarn(
        'Docs Disabled',
        'Documentation has not been enabled on this instance, you can view up-to-date content at domain-locker.com',
      );
      this.router.navigate(['/']);

      // Give user option to view on domain-locker.com
      if (docsPath) {
        this.confirmationService.confirm({
          header: 'Documentation not Enabled',
          message: 'Would you want to view this page on the Domain Locker website?',
          icon: 'pi pi-book',
          acceptIcon: 'pi pi-reply mr-2',
          rejectIcon: 'pi pi-arrow-left mr-2',
          acceptButtonStyleClass: 'p-button-sm p-button-primary p-button-text',
          rejectButtonStyleClass:
            'p-button-sm p-button-secondary p-button-text p-button-text',
          closeOnEscape: true,
          accept: () => {
            window.open(`https://domain-locker.com/${docsPath}`, '_blank');
          },
        });
      }
    }
  }
}

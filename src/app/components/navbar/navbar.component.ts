import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ViewChild,
  AfterViewInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { SupabaseService } from '~/app/services/supabase.service';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { RadioButtonModule } from 'primeng/radiobutton';
import { OverlayModule } from 'primeng/overlay';
import { Subscription } from 'rxjs';
import {
  authenticatedNavLinks,
  unauthenticatedNavLinks,
  settingsLinks,
} from '~/app/constants/navigation-links';
import { UiSettingsComponent } from '~/app/components/settings/ui-options/ui-options.component';
import { NotificationsListComponent } from '~/app/components/notifications-list/notifications-list.component';
import { OverlayPanel } from 'primeng/overlaypanel';
import DatabaseService from '~/app/services/database.service';
import { BillingService, UserType } from '~/app/services/billing.service';
import { EnvironmentType, EnvService } from '~/app/services/environment.service';
import { LogoComponent } from '~/app/components/home-things/logo/logo.component';
import { FeatureService } from '~/app/services/features.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PrimeNgModule,
    FormsModule,
    SelectButtonModule,
    RadioButtonModule,
    OverlayModule,
    UiSettingsComponent,
    NotificationsListComponent,
    LogoComponent,
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, AfterViewInit {
  supabaseService = inject(SupabaseService);
  private databaseService = inject(DatabaseService);
  private billingService = inject(BillingService);
  private environmentService = inject(EnvService);
  private cdr = inject(ChangeDetectorRef);
  private featureService = inject(FeatureService);
  private platformId = inject<object>(PLATFORM_ID);

  @ViewChild('notificationsOverlay') notificationsOverlay!: OverlayPanel;
  notificationsVisible = false;
  items: MenuItem[] = [];
  itemsWithSettings: MenuItem[] = [];
  sidebarVisible = false;
  settingsVisible = false;
  isAuthenticated = false;
  unreadNotificationsCount = 0;
  userPlan: EnvironmentType | UserType | null = null;
  userPlanName = '';
  planColor = 'primary';

  settingsEnabled$ = this.featureService.isFeatureEnabled('accountSettings');
  enableSignUp = false;
  private subscriptions: Subscription = new Subscription();

  public isSupabaseEnabled = this.databaseService.serviceType === 'supabase';

  ngOnInit() {
    // Set contents of menubar items
    this.initializeMenuItems();

    // Check auth status, listen for changes and fetch user plan
    this.setAuthState();

    // Get user plan (for navbar badge, later)
    this.billingService.fetchUserPlan();

    // If enableSignup is enabled, then show the Signup button (if not logged in)
    this.featureService.isFeatureEnabled('enableSignUp').subscribe((enabled) => {
      this.enableSignUp = enabled;
      if (this.isAuthenticated) {
        this.enableSignUp = false;
      }
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit() {
    this.loadUnreadNotificationCount();
    this.loadUserPlanEnvironment();
  }

  // Get the user's billing plan or the environment type
  loadUserPlanEnvironment() {
    const environmentType = this.environmentService.getEnvironmentType();
    const updatePlan = (plan: EnvironmentType | UserType | null) => {
      this.userPlan = plan;
      this.userPlanName = this.userPlan || 'free';
      if (this.userPlan === 'sponsor') {
        this.userPlanName = 'supporter';
      }
      this.planColor = this.getColorForPlan(plan);
      this.cdr.detectChanges();
    };

    if (environmentType === 'managed') {
      this.billingService.getUserPlan().subscribe(updatePlan);
    } else {
      updatePlan(environmentType);
    }
  }

  // Pick a color for the env/user plan badge
  getColorForPlan(plan: EnvironmentType | UserType | null): string {
    switch (plan) {
      case 'free':
        return 'cyan';
      case 'hobby':
        return 'yellow';
      case 'pro':
        return 'orange';
      case 'sponsor':
        return 'pink';
      case 'enterprise':
        return 'blue';
      case 'tester':
        return 'red';
      case 'super':
        return 'indigo';
      case 'selfHosted':
        return 'teal';
      case 'demo':
        return 'yellow';
      case 'dev':
        return 'purple';
      default:
        return 'primary';
    }
  }

  // Fetch number of unread notifications for the notification badge
  loadUnreadNotificationCount() {
    if (!isPlatformBrowser(this.platformId) || !this.isAuthenticated) return;

    this.databaseService.instance?.notificationQueries
      ?.getUnreadNotificationCount()
      ?.subscribe((count: number) => (this.unreadNotificationsCount = count));
  }

  async setAuthState() {
    if (!this.environmentService.isSupabaseEnabled()) {
      this.isAuthenticated = true;
      return;
    }
    this.isAuthenticated = await this.supabaseService.isAuthenticated();
    this.subscriptions.add(
      this.supabaseService.authState$.subscribe((isAuthenticated) => {
        this.initializeMenuItems();
        this.isAuthenticated = isAuthenticated;
      }),
    );
  }

  // Set the navbar links, depending if user is logged in or not
  async initializeMenuItems() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (
      this.isAuthenticated ||
      this.environmentService.getEnvironmentType() === 'selfHosted'
    ) {
      // User is logged in, show authenticated nav links
      this.items = authenticatedNavLinks as MenuItem[];
      this.itemsWithSettings = [
        ...(authenticatedNavLinks as MenuItem[]),
        {
          label: 'Settings',
          routerLink: '/settings',
          icon: 'pi pi-cog',
          items: settingsLinks as MenuItem[],
        },
      ];
    } else {
      // User is not logged in, show docs links
      this.items = unauthenticatedNavLinks;
      this.itemsWithSettings = unauthenticatedNavLinks;
      if (!(await this.featureService.isFeatureEnabledPromise('enableDocs'))) {
        // Docs is disabled, don't show docs links
        this.items = [];
        this.itemsWithSettings = [];
      }
    }
  }

  // Open/close the sidebar (used on smaller screen)
  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
  }

  // Close sidebar (when user clicks something)
  closeSidebar() {
    this.sidebarVisible = false;
    this.cdr.detectChanges();
  }

  // Open or close the notifications overlay
  toggleNotifications(event: Event) {
    this.notificationsVisible = true;
    this.notificationsOverlay.toggle(event);
    this.unreadNotificationsCount = 0;
  }

  // Open or close the settings overlay
  toggleSettings(event: Event) {
    this.settingsVisible = !this.settingsVisible;
    event.preventDefault();
  }

  // Sign out the user and redirect. Goodbye!
  async signOut() {
    await this.supabaseService.signOut();
    window.location.href = '/login';
  }
}

import {
  Component,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
  inject,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { settingsLinks } from '~/app/constants/navigation-links';
import { AuthService } from '~/app/services/auth.service';
import { ProfilePictureComponent } from '~/app/components/misc/profile-picture.component';
import { FeatureService } from '../services/features.service';
import { FeatureNotEnabledComponent } from '~/app/components/misc/feature-not-enabled.component';

@Component({
  standalone: true,
  selector: 'app-settings-layout-page',
  imports: [
    CommonModule,
    RouterOutlet,
    PrimeNgModule,
    ProfilePictureComponent,
    FeatureNotEnabledComponent,
  ],
  templateUrl: './settings/index.page.html',
})
export default class SettingsIndexPage implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  private featureService = inject(FeatureService);
  private authService = inject(AuthService);
  private platformId = inject<object>(PLATFORM_ID);

  items$ = this.featureService.visibleLinks(settingsLinks);
  hideSideBar = false;
  @ViewChild('sidebarNav', { static: false }) sidebarNav!: ElementRef;
  hideTextLabels = false;

  settingsEnabled$ = this.featureService.isFeatureEnabled('accountSettings');

  isActive(link: string): boolean {
    return this.router.url === link;
  }

  async logout() {
    await this.authService.signOut();
    window.location.href = '/login';
  }

  toggleSideBar() {
    this.hideSideBar = !this.hideSideBar;
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkWindowSize();
      window.addEventListener('resize', this.checkWindowSize.bind(this));
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.checkWindowSize.bind(this));
    }
  }

  checkWindowSize() {
    if (window && window.innerWidth < 768) {
      this.hideSideBar = true;
    } else {
      this.hideSideBar = false;
    }
  }
}

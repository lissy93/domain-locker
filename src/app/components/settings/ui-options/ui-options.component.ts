import {
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { ThemeService, Theme, FontOption, Scale } from '~/app/services/theme.service';
import { AuthService } from '~/app/services/auth.service';
import { TranslationService } from '~/app/services/translation.service';
import { Subscription } from 'rxjs';
import {
  AccessibilityService,
  defaultAccessibilityOptions,
  accessibilityOptionsInfo,
  AccessibilityOptions,
} from '~/app/services/accessibility-options.service';

@Component({
  standalone: true,
  selector: 'app-ui-settings',
  imports: [PrimeNgModule],
  templateUrl: './ui-options.component.html',
  styleUrls: ['./ui-options.component.scss'],
})
export class UiSettingsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private languageService = inject(TranslationService);
  private accessibilityService = inject(AccessibilityService);
  private cdr = inject(ChangeDetectorRef);

  @Input() isAuthenticated?: boolean = false; // Is user logged in
  @Input() standAlone?: boolean = false; // Is running in dialog or settings page

  // Subscriptions channel for change detection
  private subscriptions: Subscription = new Subscription();

  // Selected light/dark mode, and options
  isDarkTheme = false;
  darkModeOptions = [
    { label: 'Light', value: false, icon: 'pi pi-sun' },
    { label: 'Dark', value: true, icon: 'pi pi-moon' },
  ];

  // Selected scale, and scale options
  scale: Scale = 'medium';
  scaleOptions = [
    { label: 'Small', value: 'small', icon: 'pi pi-minus-circle' },
    { label: 'Medium', value: 'medium', icon: 'pi pi-circle-off' },
    { label: 'Large', value: 'large', icon: 'pi pi-plus-circle' },
  ];

  // Whether content fills the full screen width, and width options
  isWideMode = false;
  wideModeOptions = [
    { label: 'Normal width', value: false, icon: 'pi pi-align-center' },
    { label: 'Wide mode', value: true, icon: 'pi pi-arrows-h' },
  ];

  // Selected theme, and theme options
  selectedTheme: Theme;
  themes: Theme[];

  // Selected font, and font options
  selectedFont: FontOption | null = null;
  fonts: FontOption[] = [];

  // Selected language, and language options
  selectedLanguage = 'en';
  languages: { code: string; name: string; flag: string }[] = [];

  // Set accessibility preferences, and all accessibility options
  accessibility = defaultAccessibilityOptions;
  public accessibilityFields = accessibilityOptionsInfo;

  constructor() {
    this.themes = this.themeService.getThemes();
    this.selectedTheme = this.themes[0];

    this.fonts = this.themeService.getFonts();
    this.subscriptions.add(
      this.themeService.selectedFont$.subscribe((font) => {
        this.selectedFont = font;
      }),
    );
  }

  ngOnInit(): void {
    // Languages
    this.languages = this.languageService.availableLanguages;
    this.selectedLanguage = this.languageService.translateService.currentLang;

    // Dark/light mode
    this.subscriptions.add(
      this.themeService.isDarkTheme$.subscribe((isDark) => {
        this.isDarkTheme = isDark;
        this.cdr.detectChanges();
      }),
    );

    // Theme
    this.subscriptions.add(
      this.themeService.selectedTheme$.subscribe((theme) => {
        this.selectedTheme = theme;
        this.cdr.detectChanges();
      }),
    );

    // Scale
    this.subscriptions.add(
      this.themeService.scale$.subscribe((scale) => {
        this.scale = scale;
      }),
    );

    // Wide mode
    this.subscriptions.add(
      this.themeService.isWideMode$.subscribe((isWide) => {
        this.isWideMode = isWide;
      }),
    );

    // Accessibility
    this.accessibility = { ...this.accessibilityService.getAccessibilityOptions() };
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Update language
  onLanguageChange(langCode: string) {
    this.languageService.switchLanguage(langCode);
  }

  // Update dark/light mode
  onDarkModeChange() {
    this.themeService.toggleDarkMode();
  }

  // Update theme
  onThemeChange(theme: Theme) {
    this.themeService.setTheme(theme);
  }

  // Update font
  onFontChange(font: FontOption) {
    this.themeService.setFont(font);
  }

  // Update scale
  onScaleChange() {
    this.themeService.setScale(this.scale);
    this.accessibility.largeText = this.scale === 'large';
    this.accessibilityService.setAccessibilityOptions(this.accessibility);
    this.accessibilityService.applyAccessibilityClasses();
  }

  // Update wide mode
  onWideModeChange() {
    this.themeService.setWideMode(this.isWideMode);
  }

  // Update accessibility options
  public updateAccessibilityOptions(key: keyof AccessibilityOptions): void {
    this.accessibilityService.setAccessibilityOptions(this.accessibility);
    this.accessibilityService.applyAccessibilityClasses();

    if (key === 'largeText') {
      this.themeService.setScale(this.accessibility.largeText ? 'large' : 'medium');
    }
  }

  async signOut() {
    await this.authService.signOut();
    window.location.href = '/login';
  }
}

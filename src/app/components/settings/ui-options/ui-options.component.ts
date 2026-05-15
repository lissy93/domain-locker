import { ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { ThemeService, Theme, FontOption } from '~/app/services/theme.service';
import { SupabaseService } from '~/app/services/supabase.service';
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
export class UiSettingsComponent implements OnInit {
  supabaseService = inject(SupabaseService);
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
  scale: 'small' | 'medium' | 'large' = 'medium';
  scaleOptions = [
    { label: 'Small', value: 'small', icon: 'pi pi-minus-circle' },
    { label: 'Medium', value: 'medium', icon: 'pi pi-circle-off' },
    { label: 'Large', value: 'large', icon: 'pi pi-plus-circle' },
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

    // Accessibility
    this.accessibility = { ...this.accessibilityService.getAccessibilityOptions() };
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
    localStorage.setItem('scale', this.scale);
    this.syncLargeTextAndScale('scale');
    this.setScale();
  }

  setScale() {
    const scales = { small: '14px', medium: '16px', large: '18px' };
    document.documentElement.style.fontSize = scales[this.scale] || scales.medium;
  }

  // Update accessibility options
  public updateAccessibilityOptions(key: keyof AccessibilityOptions): void {
    this.accessibilityService.setAccessibilityOptions(this.accessibility);
    this.accessibilityService.applyAccessibilityClasses();

    if (key === 'largeText') {
      this.syncLargeTextAndScale('accessibility');
    }
  }

  public syncLargeTextAndScale(source: 'scale' | 'accessibility'): void {
    if (source === 'scale') {
      // If user changed scale => update largeText
      this.accessibility.largeText = this.scale === 'large';
    } else if (source === 'accessibility') {
      // If user toggled largeText => adjust scale
      this.scale = this.accessibility.largeText ? 'large' : 'medium';
    }
    this.setScale();
  }

  async signOut() {
    await this.supabaseService.signOut();
    window.location.href = '/login';
  }
}

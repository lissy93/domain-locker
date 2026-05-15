import {
  Injectable,
  inject,
  PLATFORM_ID,
  Renderer2,
  RendererFactory2,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export interface Theme {
  name: string;
  code: string;
  color: string;
  darkLink: string;
  lightLink: string;
}

export interface FontOption {
  name: string;
  bodyFont: string;
  headingFont: string;
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private renderer: Renderer2;

  // Define themes, and set default
  private themes: Theme[] = [
    {
      name: 'Lara Purple',
      code: 'lara-purple',
      color: '#8B5CF6',
      darkLink: '/themes/purple-dark.css',
      lightLink: '/themes/purple-light.css',
    },
    {
      name: 'Vela Orange',
      code: 'vela-orange',
      color: '#FF9800',
      darkLink: '/themes/orange-dark.css',
      lightLink: '/themes/orange-light.css',
    },
    {
      name: 'Material Indigo',
      code: 'md-indigo',
      color: '#3F51B5',
      darkLink: '/themes/indigo-dark.css',
      lightLink: '/themes/indigo-light.css',
    },
    {
      name: 'Bootstrap Blue',
      code: 'bootstrap-blue',
      color: '#007BFF',
      darkLink: '/themes/blue-dark.css',
      lightLink: '/themes/blue-light.css',
    },
    {
      name: 'Lara Teal',
      code: 'lara-teal',
      color: '#14B8A6',
      darkLink: '/themes/teal-dark.css',
      lightLink: '/themes/teal-light.css',
    },
    {
      name: 'Arya Green',
      code: 'arya-green',
      color: '#4CAF50',
      darkLink: '/themes/green-dark.css',
      lightLink: '/themes/green-light.css',
    },
  ];
  private defaultTheme = this.themes[0];

  // Themes
  private selectedThemeSubject = new BehaviorSubject<Theme>(this.themes[0]);
  selectedTheme$ = this.selectedThemeSubject.asObservable();

  // Dark / light mode
  private isDarkThemeSubject = new BehaviorSubject<boolean>(false);
  isDarkTheme$ = this.isDarkThemeSubject.asObservable();

  // Fonts
  private selectedFontSubject = new BehaviorSubject<FontOption | null>(null);
  selectedFont$ = this.selectedFontSubject.asObservable();

  // All available fonts
  private fonts: FontOption[] = [
    {
      name: 'Default',
      bodyFont: 'Inter, Avenir, Helvetica, Arial, sans-serif',
      headingFont: 'Inter, Avenir, Helvetica, Arial, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
    },
    {
      name: 'Poppins',
      bodyFont: 'Poppins, sans-serif',
      headingFont: 'Poppins, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap',
    },
    {
      name: 'Casual',
      bodyFont: 'Mali, cursive',
      headingFont: 'Cabin Sketch, cursive',
      url: 'https://fonts.googleapis.com/css2?family=Cabin+Sketch:wght@400;700&family=Mali:ital,wght@0,200..700;1,200..700&display=swap',
    },
    {
      name: 'Mono',
      bodyFont: 'Source Code Pro, monospace',
      headingFont: 'Source Code Pro, monospace',
      url: 'https://fonts.googleapis.com/css2?family=Source+Code+Pro:ital,wght@0,200..900;1,200..900&display=swap',
    },
    {
      name: 'Font Set 2',
      bodyFont: 'Raleway, sans-serif',
      headingFont: 'Chakra Petch, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,300..700;1,300..700&family=Raleway:ital,wght@0,100..900;1,100..900&display=swap',
    },
    {
      name: 'Serif',
      bodyFont: 'Sura, serif',
      headingFont: 'Elsie, serif',
      url: 'https://fonts.googleapis.com/css2?family=Elsie:wght@400;900&family=Sura:wght@400;700&display=swap',
    },
    {
      name: 'Dyslexic',
      bodyFont: 'OpenDyslexic, sans-serif',
      headingFont: 'OpenDyslexic, sans-serif',
      url: 'https://fonts.cdnfonts.com/css/opendyslexic',
    },
    {
      name: 'Roboto',
      bodyFont: 'Roboto, sans-serif',
      headingFont: 'Roboto Slab, serif',
      url: 'https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@100..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap',
    },
  ];

  constructor() {
    const rendererFactory = inject(RendererFactory2);

    this.renderer = rendererFactory.createRenderer(null, null);
    this.initializeTheme();
    this.initializeFont();
  }

  getThemes(): Theme[] {
    return this.themes;
  }

  public initializeFont() {
    if (isPlatformBrowser(this.platformId)) {
      const savedFontName = localStorage.getItem('selectedFont');
      const savedFont = this.fonts.find((font) => font.name === savedFontName);
      this.selectedFontSubject.next(savedFont || this.fonts[0]);
      if (savedFont) {
        this.applyFont(savedFont);
      }
    }
  }

  public initializeTheme() {
    if (isPlatformBrowser(this.platformId)) {
      // Get users saved preferences from local storage
      const savedTheme = localStorage.getItem('selectedTheme');
      const savedIsDark = localStorage.getItem('isDarkTheme');

      // Determine if should use dark mode (either user's preference, or system preference)
      const prefersDarkMode =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDarkMode = savedIsDark ? savedIsDark === 'true' : prefersDarkMode;

      // Determine current theme to apply (either user's saved theme, or fallback to default)
      const theme =
        this.themes.find((t) => t.code === savedTheme || '') || this.defaultTheme;

      // Set the theme and dark mode
      this.selectedThemeSubject.next(theme);
      this.isDarkThemeSubject.next(useDarkMode);

      // Apply to DOM
      this.applyTheme(theme, useDarkMode);
    }
  }

  setTheme(theme: Theme) {
    this.selectedThemeSubject.next(theme);
    this.applyTheme(theme, this.isDarkThemeSubject.value);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('selectedTheme', theme.code);
    }
  }

  toggleDarkMode() {
    const newIsDark = !this.isDarkThemeSubject.value;
    this.isDarkThemeSubject.next(newIsDark);
    this.applyTheme(this.selectedThemeSubject.value, newIsDark);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('isDarkTheme', newIsDark.toString());
    }
  }

  private applyTheme(theme: Theme, isDark: boolean) {
    if (isPlatformBrowser(this.platformId)) {
      const linkId = 'app-theme';
      const linkElement = this.document.getElementById(linkId) as HTMLLinkElement;
      const newThemeUrl = isDark ? theme.darkLink : theme.lightLink;

      if (linkElement) {
        this.renderer.setAttribute(linkElement, 'href', newThemeUrl);
      } else {
        const newLinkElement = this.renderer.createElement('link');
        this.renderer.setAttribute(newLinkElement, 'id', linkId);
        this.renderer.setAttribute(newLinkElement, 'rel', 'stylesheet');
        this.renderer.setAttribute(newLinkElement, 'type', 'text/css');
        this.renderer.setAttribute(newLinkElement, 'href', newThemeUrl);
        this.renderer.appendChild(this.document.head, newLinkElement);
      }

      // Set data attributes on the html element
      const htmlElement = this.document.documentElement;
      this.renderer.setAttribute(htmlElement, 'data-theme', theme.code);
      this.renderer.setAttribute(htmlElement, 'data-mode', isDark ? 'dark' : 'light');
    }
  }

  getFonts(): FontOption[] {
    return this.fonts;
  }

  setFont(font: FontOption): void {
    this.selectedFontSubject.next(font);
    localStorage.setItem('selectedFont', font.name);
    this.applyFont(font);
  }

  private applyFont(font: FontOption): void {
    // Load font dynamically
    if (font.url) {
      const fontLinkId = 'app-font';
      let fontLinkElement = this.document.getElementById(fontLinkId) as HTMLLinkElement;
      if (!fontLinkElement) {
        fontLinkElement = this.renderer.createElement('link');
        this.renderer.setAttribute(fontLinkElement, 'rel', 'stylesheet');
        this.renderer.setAttribute(fontLinkElement, 'id', fontLinkId);
        this.renderer.appendChild(this.document.head, fontLinkElement);
      }
      this.renderer.setAttribute(fontLinkElement, 'href', font.url);
    }

    // Apply fonts to body and headings
    this.document.documentElement.style.setProperty('--body-font', font.bodyFont);
    this.document.documentElement.style.setProperty('--heading-font', font.headingFont);
  }

  public getUserPreferences(): {
    theme: string;
    darkMode: boolean;
    font: string;
    scale: string;
  } {
    return {
      theme: this.selectedThemeSubject.value.name,
      darkMode: this.isDarkThemeSubject.value,
      font: this.selectedFontSubject.value?.name || 'Default',
      scale: localStorage.getItem('scale') || 'medium',
    };
  }
}

import {
  Component,
  Input,
  OnDestroy,
  AfterViewInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-loading',
  imports: [PrimeNgModule, TranslateModule],
  styles: `
    ::ng-deep .is-absolute {
      background: var(--surface-0);
      position: fixed;
      width: 100%;
      top: 0vh;
      z-index: 2;
    }
  `,
  template: `
    <div
      class="flex justify-center flex-col items-center h-full min-h-80 gap-4 mx-auto scale-1 md:mt-[-3rem] lg:mt-[-5rem] md:scale-125 xl:scale-150 animate-fade-in overflow-hidden {{
        isAbsolute ? 'is-absolute' : ''
      }}"
    >
      <!-- Title -->
      <p class="m-0 text-4xl font-extrabold text-default tracking-widest">
        {{ loadingTitle || text.initTitle }}
      </p>

      <!-- Animated bar loader -->
      <div class="w-28 flex gap-2">
        <div class="w-2 h-4 rounded-full bg-primary animate-fade-bounce"></div>
        <div
          class="w-2 h-4 rounded-full bg-primary animate-fade-bounce [animation-delay:-0.3s]"
        ></div>
        <div
          class="w-2 h-4 rounded-full bg-primary animate-fade-bounce [animation-delay:-0.5s]"
        ></div>
        <div
          class="w-2 h-4 rounded-full bg-primary animate-fade-bounce [animation-delay:-0.8s]"
        ></div>
      </div>

      <!-- Description -->
      @if (loadingDescription) {
        <p class="m-0 mt-4 text-lg text-surface-400 text-center">
          {{ loadingDescription }}
        </p>
      } @else {
        <p class="m-0 mt-4 text-lg text-surface-400 text-center">
          {{ text.defaultDesc }}
        </p>
      }
      <ng-template #defaultDesc>
        <p class="m-0 mt-4 text-lg text-surface-400 text-center">
          {{ text.defaultDesc }}
        </p>
      </ng-template>

      <!-- Error display (appears after a timeout) -->
      @if (showError) {
        <div class="text-center">
          <p class="m-0 text-xs text-surface-400">
            {{ text.errorShort }}
          </p>
          <p class="m-0 text-lg text-red-400">
            {{ text.errorLong }}
          </p>
        </div>
      }

      @if (showError) {
        <div class="flex gap-2 flex-wrap justify-center">
          <a routerLink="/">
            <p-button
              size="small"
              [label]="text.buttonHome"
              severity="primary"
              icon="pi pi-home"
            ></p-button>
          </a>
          <p-button
            size="small"
            [label]="text.buttonDebug"
            severity="info"
            icon="pi pi-info-circle"
            (click)="reloadPage()"
          ></p-button>
          <p-button
            size="small"
            [label]="text.buttonReload"
            severity="secondary"
            icon="pi pi-sync"
            (click)="reloadPage()"
          ></p-button>
        </div>
      }
    </div>
  `,
})
export class LoadingComponent implements AfterViewInit, OnDestroy {
  private platformId = inject<object>(PLATFORM_ID);
  private translate = inject(TranslateService);

  @Input() loadingTitle?: string;
  @Input() loadingDescription?: string;
  @Input() isAbsolute?: boolean = false;
  public showError = false;

  // Fallback strings
  public text = {
    // Title
    initTitle: 'Initializing',
    // Description fallback
    defaultDesc:
      "We're just getting everything ready for you.\nThis shouldn't take a moment...",
    // Error messages
    errorShort: "It shouldn't be taking this long...",
    errorLong: 'Something might have gone wrong',
    // Buttons
    buttonHome: 'Home',
    buttonDebug: 'Debug',
    buttonReload: 'Reload',
  };

  private errorTimeout: number | undefined;
  private langSub: Subscription | undefined; // unsub ref

  constructor() {
    // 1) Set initial text from fallback, or if translations are loaded
    this.updateTranslatedStrings();

    // 2) If translations or language changes, re-check
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.updateTranslatedStrings();
    });
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.errorTimeout = window.setTimeout(() => {
        this.showError = true;
      }, 8500);
    }
  }

  ngOnDestroy() {
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
    }
    if (this.langSub) {
      this.langSub.unsubscribe();
    }
  }

  /** Reload page if in browser */
  reloadPage() {
    if (isPlatformBrowser(this.platformId)) {
      window.location.reload();
    }
  }

  /**
   * Update each local string if a translation is found
   */
  private updateTranslatedStrings() {
    // If a translation is present, replace the fallback.
    // We only override if the translation is different from the key itself
    // or from an empty result.

    const tryTranslate = (key: string, fallback: string) => {
      return fallback;
      // TODO: Fix the following, so we can show fallback only when translations not yet loaded.
      const t = this.translate.instant(key);
      return t && t !== key ? t : fallback;
    };

    this.text.initTitle = tryTranslate(
      'GLOBAL.LOADING.INITIALIZING',
      this.text.initTitle,
    );
    this.text.defaultDesc = tryTranslate(
      'GLOBAL.LOADING.DEFAULT_DESCRIPTION',
      this.text.defaultDesc,
    );
    this.text.errorShort = tryTranslate(
      'GLOBAL.LOADING.ERROR_SHORT',
      this.text.errorShort,
    );
    this.text.errorLong = tryTranslate('GLOBAL.LOADING.ERROR_LONG', this.text.errorLong);
    this.text.buttonHome = tryTranslate(
      'GLOBAL.LOADING.BUTTON.HOME',
      this.text.buttonHome,
    );
    this.text.buttonDebug = tryTranslate(
      'GLOBAL.LOADING.BUTTON.DEBUG',
      this.text.buttonDebug,
    );
    this.text.buttonReload = tryTranslate(
      'GLOBAL.LOADING.BUTTON.RELOAD',
      this.text.buttonReload,
    );
  }
}

import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  selector: 'app-domain-favicon',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  template: `
    @if (!faviconLoaded) {
      <i
        class="pi"
        [ngClass]="{ 'pi-spin': isSpinning, 'pi-globe': true }"
        [style.font-size.px]="size"
      ></i>
    }
    @if (faviconLoaded !== false) {
      <img
        [ngSrc]="domainIcon || apiBaseUrl + sanitizedDomain"
        [width]="size"
        [height]="size"
        (load)="onFaviconLoad()"
        (error)="onFaviconError()"
        [alt]="sanitizedDomain + ' favicon'"
        [class]="styleClass + 'rounded-sm overflow-hidden block'"
      />
    }
  `,
  styles: [
    `
      :host {
        display: inline-block;
        width: var(--favicon-size, 24px);
        height: auto;
        max-height: var(--favicon-size, 24px);
        line-height: 0;
      }
      i,
      img {
        vertical-align: middle;
      }
    `,
  ],
})
export class DomainFaviconComponent implements OnInit, OnDestroy {
  private errorHandler = inject(ErrorHandlerService);

  @Input() domain!: string;
  @Input() size = 24;
  @Input() styleClass = '';
  @Input() domainIcon = '';
  apiBaseUrl = 'https://favicon.im/';
  // apiBaseUrl = 'https://favicon.twenty.com/';
  // apiBaseUrl = 'https://favicone.com/';
  // apiBaseUrl = 'https://icon.horse/icon/';
  // apiBaseUrl = 'http://strong-turquoise-minnow.faviconkit.com/';
  // apiBaseUrl = 'http://f1.allesedv.com/32/';
  // apiBaseUrl = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&size=32&url=http://';

  // https://icons.duckduckgo.com/ip4/gov.uk.ico

  private _sanitizedDomain = '';
  public get sanitizedDomain(): string {
    return this._sanitizedDomain;
  }
  public set sanitizedDomain(value: string) {
    this._sanitizedDomain = value;
  }
  faviconLoaded: boolean | undefined;
  isSpinning = true;
  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  ngOnInit() {
    this.sanitizedDomain = this.getSanitizedDomain(this.domain);
    this.startSpinningTimeout();
  }

  ngOnDestroy() {
    this.clearSpinningTimeout();
  }

  private startSpinningTimeout() {
    this.timeoutId = setTimeout(() => {
      this.isSpinning = false;
    }, 500);
  }

  private clearSpinningTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  onFaviconLoad() {
    this.clearSpinningTimeout();
    this.faviconLoaded = true;
  }

  onFaviconError() {
    this.clearSpinningTimeout();
    this.faviconLoaded = false;
    this.isSpinning = false;
  }

  private getSanitizedDomain(domain: string): string {
    try {
      let sanitizedDomain = (domain || '').replace(/^(https?:\/\/)?(www\.)?/, '');
      sanitizedDomain = sanitizedDomain.split('/')[0];
      return sanitizedDomain.toLowerCase();
    } catch (e) {
      this.errorHandler.handleError({
        message: 'Failed to sanitize domain',
        error: e,
        location: 'DomainFaviconComponent.getSanitizedDomain',
      });
      return domain;
    }
  }
}

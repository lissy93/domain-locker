import {
  Directive,
  ElementRef,
  EventEmitter,
  Output,
  PLATFORM_ID,
  inject,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appLazyLoad]',
  standalone: true,
})
export class LazyLoadDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);

  @Output() visible = new EventEmitter<void>();

  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.visible.emit();
            this.observer?.disconnect();
          }
        });
      },
      { threshold: 0.1 },
    );

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

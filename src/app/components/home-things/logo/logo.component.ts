import { AfterViewInit, Component, ElementRef, Input, inject } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-logo',
  imports: [],
  template: `
    <svg
      #logoSvg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      x="0px"
      y="0px"
      viewBox="0 0 959.7 998"
      [attr.width]="size"
      [attr.height]="size"
    >
      <g id="Main">
        <path
          class="big-d"
          d="M880.2,444.4c0-121.8-41.7-229.6-110.3-308.5C689.3,43.3,571.4-9.6,440.1,1.4L0,38.3l0,0l0,0v959.6l0,0
		c0,0,438.4-36.7,440.1-36.8C683.2,940.7,880.2,709.4,880.2,444.4L880.2,444.4z M522.3,403.2L311,420.9
		c-14.6,1.2-26.5-10.7-26.5-26.6s11.8-29.9,26.5-31.1l211.3-17.7c14.6-1.2,26.5,10.7,26.5,26.6S536.9,402,522.3,403.2L522.3,403.2z
		 M548.7,472.6c0,15.9-11.8,29.9-26.5,31.1L311,521.4c-14.6,1.2-26.5-10.7-26.5-26.6s11.8-29.9,26.5-31.1L522.3,446
		C536.9,444.7,548.7,456.7,548.7,472.6L548.7,472.6z M284.5,595.2c0-15.9,11.8-29.9,26.5-31.1l211.3-17.7
		c14.6-1.2,26.5,10.7,26.5,26.6s-11.8,29.9-26.5,31.1L311,621.8C296.4,623.1,284.5,611.1,284.5,595.2L284.5,595.2z"
        />
      </g>
      <g id="Shadow">
        <path
          class="d-shadow"
          d="M769.9,135.9c68.6,78.9,110.3,186.6,110.3,308.5c0,265-197,496.3-440.1,516.7C438.4,961.3,0,997.9,0,997.9l0,0
		c0,0,477.9,0.1,479.8,0.1c265,0,479.8-214.8,479.8-479.8C959.7,362.2,885.2,223.6,769.9,135.9z"
        />
        <path
          class="d-shadow stripe-1"
          d="M522.3,345.5L311,363.2c-14.6,1.2-26.5,15.1-26.5,31.1s11.8,27.9,26.5,26.6l211.3-17.7
		c14.6-1.2,26.5-15.1,26.5-31.1S536.9,344.3,522.3,345.5L522.3,345.5z"
        />
        <path
          class="d-shadow stripe-2"
          d="M548.7,573.1c0-15.9-11.8-27.9-26.5-26.6L311,564.1c-14.6,1.2-26.5,15.1-26.5,31.1s11.8,27.9,26.5,26.6
		l211.3-17.7C536.9,602.9,548.7,589,548.7,573.1z"
        />
        <path
          class="d-shadow stripe-3"
          d="M522.3,446L311,463.7c-14.6,1.2-26.5,15.1-26.5,31.1s11.8,27.9,26.5,26.6l211.3-17.7
		c14.6-1.2,26.5-15.1,26.5-31.1S536.9,444.7,522.3,446L522.3,446z"
        />
      </g>
    </svg>
  `,
  styles: [
    `
      .d-shadow {
        fill: var(--maskbg);
        opacity: 0.7;
      }
      .big-d {
        fill: var(--primary-color);
      }
    `,
  ],
})
export class LogoComponent implements AfterViewInit {
  private el = inject(ElementRef);

  @Input() size = '2rem';

  ngAfterViewInit(): void {
    // Wait a tick, then add the anim-active class to the <svg>
    setTimeout(() => {
      const svg: SVGElement | null = this.el.nativeElement.querySelector('svg');
      if (svg) {
        svg.classList.add('anim-active');
      }
    });
  }
}

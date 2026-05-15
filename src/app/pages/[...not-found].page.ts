import { RouteMeta } from '@analogjs/router';
import { injectResponse } from '@analogjs/router/tokens';
import { Component, PLATFORM_ID, inject, OnInit } from '@angular/core';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { isPlatformBrowser } from '@angular/common';

export const routeMeta: RouteMeta = {
  title: 'Page Not Found | Domain Locker',
  canActivate: [
    () => {
      const response = injectResponse();
      if (import.meta.env.SSR && response) {
        response.statusCode = 404;
      }
      return true;
    },
  ],
};

@Component({
  standalone: true,
  imports: [PrimeNgModule],
  selector: 'app-not-found-page',
  template: `
    <div class=" w-full h-full flex flex-col justify-center items-center">
      <h1 class="text-9xl font-extrabold text-default tracking-widest">404</h1>
      <div class="bg-primary px-2 text-sm rounded rotate-12 absolute">Page Not Found</div>
    </div>

    <div class="mx-auto mt-4 flex flex-col justify-center items-center text-center gap-4">
      <h3 class="text-2xl font-semibold text-default tracking-widest">
        The page you are looking for could not be found
      </h3>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 512"
        width="256"
        class="block w-28 mx-auto my-4"
      >
        <path
          class="fill-primary"
          opacity=".4"
          d="M167.1 64c0 3.1 1.7 6.2 5.2 7.5l28.8 10.7c2.2 .8 3.9 2.5 4.7 4.7l10.7 28.8c2.6 7 12.4 7 15 0l10.7-28.8c.8-2.2 2.5-3.9 4.7-4.7l28.8-10.7c7-2.6 7-12.4 0-15L246.9 45.8c-2.2-.8-3.9-2.5-4.7-4.7L231.5 12.3c-2.6-7-12.4-7-15 0L205.8 41.1c-.8 2.2-2.5 3.9-4.7 4.7L172.3 56.5c-3.5 1.3-5.2 4.4-5.2 7.5zM288 160c0 11.7 1.3 23.1 3.6 34.1C307.3 266.1 371.3 320 448 320c11 0 21.7-1.1 32-3.2C553 302 608 237.4 608 160C608 71.6 536.4 0 448 0S288 71.6 288 160zM352 42.7c0-5.9 4.8-10.7 10.7-10.7c3.4 0 6.5 1.6 8.5 4.3l40 53.3c3 4 7.8 6.4 12.8 6.4l48 0c5 0 9.8-2.4 12.8-6.4l40-53.3c2-2.7 5.2-4.3 8.5-4.3c5.9 0 10.7 4.8 10.7 10.7L544 160c0 53-43 96-96 96s-96-43-96-96l0-117.3z"
        />
        <path
          class="fill-primary"
          d="M352 42.7c0-5.9 4.8-10.7 10.7-10.7c3.4 0 6.5 1.6 8.5 4.3l40 53.3c3 4 7.8 6.4 12.8 6.4l48 0c5 0 9.8-2.4 12.8-6.4l40-53.3c2-2.7 5.2-4.3 8.5-4.3c5.9 0 10.7 4.8 10.7 10.7L544 160c0 53-43 96-96 96s-96-43-96-96l0-117.3zM416 176a16 16 0 1 0 0-32 16 16 0 1 0 0 32zm80-16a16 16 0 1 0 -32 0 16 16 0 1 0 32 0zM160 277.8c29.4-44.3 76.8-75.6 131.6-83.8C307.3 266.1 371.3 320 448 320c11 0 21.7-1.1 32-3.2l0 35.2 0 128c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-93.9L300 448l36 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-144 0c-53 0-96-43-96-96l0-223.5c0-16.1-12-29.8-28-31.8l-7.9-1c-17.5-2.2-30-18.2-27.8-35.7s18.2-30 35.7-27.8l7.9 1c48 6 84.1 46.8 84.1 95.3l0 85.3z"
        />
      </svg>

      <a routerLink="/"
        ><p-button severity="primary" label="Home" icon="pi pi-home" size="large"
      /></a>

      <p class="text-sm text-default tracking-widest max-w-96 mt-4 text-surface-400">
        Please ensure the URL is correct, and that you are authenticated. If the issue
        persists, please raise a ticket.
      </p>
    </div>
  `,
})
export default class NotFoundPage implements OnInit {
  private errorHandler = inject(ErrorHandlerService);
  platformId = inject<object>(PLATFORM_ID);

  ngOnInit() {
    const pathName =
      isPlatformBrowser(this.platformId) && window
        ? window.location.pathname
        : '[SSR Route]';

    this.errorHandler.handleError({
      message: `Page not found: ${pathName}`,
      location: 'NotFoundRoute',
    });
  }
}

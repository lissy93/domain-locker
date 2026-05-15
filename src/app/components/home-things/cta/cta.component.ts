import { Component, Input } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-cta',
  standalone: true,
  imports: [PrimeNgModule, RouterModule],
  template: `
    @if (!businessVersion) {
      <div class="p-card py-3 px-4 my-4">
        <h3 class="my-1 font-semmibold">Ready to get started?</h3>
        <p class="m-0 mt-2 text-xl italic opacity-60">
          If you own a domain name, you need Domain Locker!
        </p>
        <p class="mt-2 mb-0">
          Domain Locker is easy to use, and our free plan will get you up and running in
          no time.
          {{
            !hideGhLink
              ? 'Alternatively, check out our GitHub repo to run on your own infrastructure.'
              : ''
          }}
        </p>
        <div class="flex justify-center sm:justify-end w-full flex-wrap gap-3 my-3">
          <!-- View on GitHub GitHub -->
          @if (!hideGhLink) {
            <a
              href="https://github.com/lissy93/domain-locker"
              target="_blank"
              rel="noopener noreferrer"
            >
              <p-button
                label="View on GitHub"
                severity="secondary"
                icon="pi pi-github"
                class="min-w-48"
                styleClass="w-full"
              ></p-button>
            </a>
          }
          <!-- Get Started -->
          @if (isDemo) {
            <a href="https://domain-locker.com/login?newUser=true">
              <p-button
                label="Get Started"
                class="min-w-48"
                icon="pi pi-arrow-circle-right"
                styleClass="w-full"
              />
            </a>
          }
          <p-button
            routerLink="/login"
            [queryParams]="{ newUser: 'true' }"
            label="Get Started"
            class="min-w-48"
            icon="pi pi-arrow-circle-right"
            styleClass="w-full"
          />
        </div>
      </div>
    }

    @if (businessVersion) {
      <div
        class="p-card mt-4 w-full p-3 flex flex-col md:flex-row-reverse items-center md:items-start gap-4 justify-between mx-auto"
      >
        <div class="flex flex-col h-full justify-between flex-1">
          <div>
            <h2 class="m-0 mb-1 text-xl italic opacity-90 font-normal">
              Domain Locker is the all-in-one platform for total visibility of your domain
              name portfolio.
            </h2>
            <p class="mt-3 mb-0">
              Whether you have 1 or 1000 domains, Domain Locker can help you save time,
              money and hassle, by making domain monitoring easy and efficient. It's the
              essential tool to keep your domains in check and your business running
              smoothly.
            </p>
            <p class="my-3">
              No need to make any changes to your domains or DNS, and no technical
              knowledge is required. Our free plan will get started in just a few clicks,
              and scale up as your needs grow.
            </p>
          </div>
          <p-button
            class="flex justify-end"
            styleClass="min-w-[180px]"
            label="Get Started (free!)"
            icon="pi pi-arrow-circle-right"
            severity="primary"
            [routerLink]="['/login']"
            [queryParams]="{ newUser: true }"
          />
        </div>
        <div class="w-fit">
          <img
            src="https://storage.googleapis.com/as93-screenshots/domain-locker/home_viz.png"
            alt="Domain Locker Preview"
            width="320px"
            class="flex w-[22rem] h-auto rounded-sm shadow-md"
          />
        </div>
      </div>
    }
  `,
  styles: [],
})
export class CtaComponent {
  @Input() isDemo = false;
  @Input() hideGhLink = false;
  @Input() businessVersion = false;
}

import { Component, Input } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  standalone: true,
  selector: 'app-not-found',
  imports: [PrimeNgModule],
  template: `
    <div
      class="flex flex-col gap-4 items-center justify-center max-w-[30rem] mx-auto p-card p-4 mt-8"
    >
      <h1 class="text-3xl">
        <i class="pi pi-exclamation-triangle text-3xl"></i>
        {{ title }}
      </h1>
      <p class="m-0">
        @if (name) {
          <strong>{{ name }}</strong>
        }
        {{ message }}
      </p>
      @if (actionLink) {
        <a [href]="actionLink">
          <p-button [icon]="actionIcon" [label]="actionLabel" class="p-button-primary" />
        </a>
      }
      <ng-content></ng-content>
      <!-- Slot for additional content -->
      <p class="text-sm opacity-70 italic">
        Believe this is an error? {{ helpMessage }}
        @if (helpLink) {
          For additional help contact the administrator, or see the
          <a [href]="helpLink">{{ helpLinkText }}</a>
        }
      </p>
    </div>
  `,
})
export class NotFoundComponent {
  @Input() title = 'Not Found'; // Main title (e.g., Domain Not Found)
  @Input() name = 'Domain Name'; // Entity name (e.g., domain name or subdomain)
  @Input() message = "hasn't been added to your account yet"; // Additional context message
  @Input() actionLink?: string | false = '/domains/add'; // Action link (e.g., add URL)
  @Input() actionLabel = 'Add it now'; // Button label
  @Input() actionIcon = 'pi pi-plus'; // Button icon
  @Input() helpMessage =
    'Check the URL, ensure you are authenticated, and have access rights.'; // Help message
  @Input() helpLink?: string = 'about/support'; // Link to help documentation
  @Input() helpLinkText = 'Help Docs'; // Help link text
}

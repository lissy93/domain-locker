import { Component, Input, OnInit } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';

@Component({
  selector: 'app-demo-welcome',
  template: `
    @if (!isHidden) {
      <p-messages severity="info">
        <ng-template pTemplate>
          @if (isDemoInstance) {
            <div class="relative w-full">
              <h3 class="m-0">Demo Instance</h3>
              <p class="m-0 mt-2">
                Welcome to the Domain Locker live demo! Below you can see some example
                domains. In a real instance, you would add your domains (that you own).
              </p>
              <p class="m-0 mt-2">
                The data is real, and updated live. Try clicking a domain to analyse it,
                or browse through the auto-fetched assets, view stats, see the change
                history or checkout the website monitor.
              </p>
              <p class="m-0">
                Note that some features have been disabled on the demo instance, and much
                of the data is reset every night.
              </p>
              <p class="m-0 mt-2">
                When you're ready to get started, head back to
                <a href="https://domain-locker.com">domain-locker.com</a>, and sign up!
              </p>
              <button
                pButton
                (click)="hideDemoWelcome()"
                type="button"
                icon="pi pi-times"
                label="Dismiss"
                aria-label="Dismiss"
                size="small"
                class="p-button-info float-right md:mt-[-2rem]"
              ></button>
            </div>
          }
          @if (isDevInstance) {
            <div class="relative w-full">
              <h3 class="m-0">Dev Instance</h3>
              <p class="m-0 mt-2">
                Congratulations for getting Domain Locker up and running in dev mode! 🎉
              </p>
              <p class="m-0 mt-2">
                You are connected to our Supabase dev server.
                <b
                  >Note that any data stored here is periodically reset, so it is not
                  suitable for production use.</b
                >
              </p>
              <p class="mt-2">
                It's recommended to create your own user account here for testing- no
                email verification is needed 🙂
                <br />
                (If you're using the public
                <code>dev&#64;domain-locker.com</code> account, please avoid
                adding/editing/deleting data)
              </p>
              <p class="m-0 mt-2">
                If you need any help, check out our
                <a href="https://domain-locker.com/about/developing">Dev Docs</a> and
                <a href="https://github.com/lissy93/domain-locker">GitHub</a>.
                <br />
                Have fun 🩷🚀
              </p>
              <button
                pButton
                (click)="hideDemoWelcome()"
                type="button"
                icon="pi pi-times"
                label="Dismiss"
                aria-label="Dismiss"
                size="small"
                class="p-button-info float-right md:mt-[-2rem]"
              ></button>
            </div>
          }
        </ng-template>
      </p-messages>
    }
  `,
  standalone: true,
  imports: [PrimeNgModule],
})
export class DemoWelcomeComponent implements OnInit {
  isHidden = false;
  @Input() isDemoInstance = false;
  @Input() isDevInstance = false;

  ngOnInit(): void {
    if (this.isBrowser() && localStorage.getItem('hideDemoWelcome') === 'true') {
      this.isHidden = true;
      return;
    }
    if (!this.isDemoInstance && !this.isDevInstance) {
      this.isDemoInstance = true;
    }
  }

  hideDemoWelcome(): void {
    if (this.isBrowser()) {
      localStorage.setItem('hideDemoWelcome', 'true');
    }
    this.isHidden = true;
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }
}

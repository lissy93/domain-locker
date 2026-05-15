import { Component, OnInit, PLATFORM_ID, inject, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { SupabaseService } from '~/app/services/supabase.service';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HelpfulLinksComponent } from '~/app/components/misc/helpful-links.component';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

type QueryInfo = Record<
  string,
  {
    allow: boolean;
    info?: string;
    warn?: string;
    links?: {
      location: string;
      title: string;
      icon: string;
      body: string;
    }[];
  }
>;

@Component({
  standalone: true,
  selector: 'app-about-support-contact-page',
  imports: [PrimeNgModule, FormsModule, ReactiveFormsModule, HelpfulLinksComponent],
  templateUrl: './index.page.html',
})
export default class ContactPageComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private errorHandler = inject(ErrorHandlerService);
  private platformId = inject<object>(PLATFORM_ID);

  contactForm!: FormGroup;
  isAuthenticated = false;
  userType: string | null = null;
  showContactForm = false;
  queryInfo: QueryInfo = {
    Feedback: {
      allow: false,
      info: 'We welcome feedback from our users. Please share your thoughts!',
    },
    'Bug/Issue': {
      allow: true,
      info:
        'Please include diagnostic debug info in your bug report. ' +
        'Then describe the issue, expected results, actual results and steps to reproduce.',
      links: [
        {
          location: '/advanced/debug-info',
          title: 'Debug Info',
          icon: 'info-circle',
          body: 'Get diagnostic data',
        },
      ],
    },
    Security: {
      allow: true,
      info: 'If you have a security concern, please let us know immediately.',
    },
    'Custom Plan': {
      allow: true,
      info: 'Looking for a custom plan? Get in touch with us!',
    },
    'User Support': {
      allow: false,
      info: 'User support is available for Pro and above users.',
    },
    'Enterprise Support': {
      allow: false,
      warn: 'Enterprise support is available for enterprise users.',
    },
    Data: {
      allow: false,
      info: 'Have questions about your data? Let us know.',
      links: [
        {
          location: '/about/data',
          title: 'Privacy Policy',
          icon: 'info-circle',
          body: "Read what data is collected and how it's stored and used",
        },
        {
          location: '/settings/privacy',
          title: 'Privacy Options',
          icon: 'lock-open',
          body: 'Update preferences for 3rd party services',
        },
        {
          location: '/domains/export',
          title: 'Export Data',
          icon: 'download',
          body: 'Export your data in a machine-readable format',
        },
        {
          location: '/domains/add',
          title: 'Add Domain(s)',
          icon: 'upload',
          body: 'Add domains and associated assets to your account',
        },
        {
          location: '/settings/delete-account',
          title: 'Delete Account',
          icon: 'ban',
          body: 'Delete your account, and all associated data',
        },
        {
          location: '/settings/developer-options',
          title: 'Data Interoperability',
          icon: 'code',
          body: 'Access your data programmatically via our API',
        },
        // { location: '', title: '', icon: '', body: '' },
      ],
    },
    Help: {
      allow: false,
      info: 'Need help with something? Reach out to us.',
    },
  };

  queryTypes = Object.keys(this.queryInfo);

  private initScript?: HTMLScriptElement;
  private freshdeskScript?: HTMLScriptElement;

  async ngOnInit(): Promise<void> {
    // Init chat widget
    this.registerFreshChat();

    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      userType: [{ value: '', disabled: true }],
      queryType: ['', Validators.required],
      body: ['', [Validators.required, Validators.minLength(10)]],
    });

    // Get auth state
    this.isAuthenticated = await this.supabaseService.isAuthenticated();
    const user = await this.supabaseService.getCurrentUser();

    // Autofill user details
    if (user) {
      const name = user.user_metadata?.['name'] || '';
      const email = user.email || '';

      this.contactForm.patchValue({ name, email });

      // Determine user type
      this.userType = user.user_metadata?.['user_type'] || 'Free'; // Default to Free
      this.contactForm.get('userType')?.setValue(this.userType);

      // Update permissions based on user type
      this.updateQueryPermissions();

      // Init Fresh widget with user details
      if (isPlatformBrowser(this.platformId)) {
        (
          window as unknown as { FreshworksWidget: (...args: unknown[]) => void }
        ).FreshworksWidget('identify', 'ticketForm', { name, email });
      }
    }
  }

  ngOnDestroy(): void {
    this.deregisterFreshChat();
  }

  onQueryTypeChange(queryType: string): void {
    this.showContactForm = this.queryInfo[queryType]?.allow || false;
  }

  private updateQueryPermissions(): void {
    if (this.userType === 'Pro' || this.userType === 'Hobby') {
      this.queryInfo['Bug/Issue'].allow = true;
      this.queryInfo['User Support'].allow = true;
    }
    if (this.userType === 'Enterprise') {
      this.queryInfo['Enterprise Support'].allow = true;
    }
    if (this.isAuthenticated) {
      this.queryInfo['Feedback'].allow = true;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.contactForm.invalid) return;
    // const { name, email, queryType, body } = this.contactForm.getRawValue();
    try {
      // TODO: Submit { name, email, queryType, body }
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Failed to submit form',
        showToast: true,
        location: 'contact.page',
      });
    }
  }

  openFreshChat(): void {
    if (isPlatformBrowser(this.platformId)) {
      (
        window as unknown as { FreshworksWidget: (...args: unknown[]) => void }
      ).FreshworksWidget('open');
    }
  }

  registerFreshChat(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.initScript = document.createElement('script');
    this.initScript.innerHTML = `
      window.fwSettings = {
        'widget_id': 204000000781
      };
      !function(){
        if("function" != typeof window.FreshworksWidget){
          var n=function(){n.q.push(arguments)};n.q=[];window.FreshworksWidget=n
        }
      }();
    `;
    document.body.appendChild(this.initScript);

    this.freshdeskScript = document.createElement('script');
    this.freshdeskScript.type = 'text/javascript';
    this.freshdeskScript.src =
      'https://euc-widget.freshworks.com/widgets/204000000781.js';
    this.freshdeskScript.async = true;
    this.freshdeskScript.defer = true;
    document.body.appendChild(this.freshdeskScript);

    (
      window as unknown as { FreshworksWidget: (...args: unknown[]) => void }
    ).FreshworksWidget('hide');
  }

  deregisterFreshChat(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    (
      window as unknown as { FreshworksWidget: (...args: unknown[]) => void }
    ).FreshworksWidget('hide');
  }
}

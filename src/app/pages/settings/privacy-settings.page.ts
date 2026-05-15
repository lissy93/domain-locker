import { PrimeNgModule } from '~/app/prime-ng.module';

import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-settings-privacy-settings-page',
  imports: [PrimeNgModule, ReactiveFormsModule],
  templateUrl: './privacy-settings.page.html',
})
export default class PrivacyPageComponent {
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    hitCounting: [true],
    errorTracking: [false],
    performanceMonitoring: [false],
    cookies: [{ value: false, disabled: true }],
    localStorage: [{ value: true, disabled: true }],
  });

  clearLocalStorage() {
    localStorage.clear();
  }
}

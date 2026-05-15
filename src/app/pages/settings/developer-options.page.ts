import { PrimeNgModule } from '~/app/prime-ng.module';

import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-settings-developer-options-page',
  imports: [PrimeNgModule, ReactiveFormsModule],
  templateUrl: './developer-options.page.html',
  styles: [``],
})
export default class DeveloperOptionsPageComponent {
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    restApi: [false],
    graphQl: [false],
    rssFeed: [false],
    prometheus: [false],
  });
}

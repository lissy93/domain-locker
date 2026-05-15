import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '../../prime-ng.module';
import { DomainUtils } from '~/app/services/domain-utils.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FeatureService } from '~/app/services/features.service';
import { CtaComponent } from '~/app/components/home-things/cta/cta.component';
import { BusinessFeaturesComponent } from '~/app/components/about-things/business-features.component';
import { Router } from '@angular/router';
import { EnvService } from '~/app/services/environment.service';

@Component({
  standalone: true,
  selector: 'app-preview-page',
  imports: [CtaComponent, CommonModule, PrimeNgModule, BusinessFeaturesComponent],
  providers: [ConfirmationService, MessageService],
  templateUrl: 'index.page.html',
})
export default class DomainDetailsPage implements OnInit {
  domainUtils = inject(DomainUtils);
  private featureService = inject(FeatureService);
  private environmentService = inject(EnvService);
  private router = inject(Router);

  enablePreviewDomain$ = this.featureService.isFeatureEnabled('enablePreviewDomain');
  public environmentType: string | null = null;
  public domain = '';

  ngOnInit() {
    this.environmentType = this.environmentService.getEnvironmentType();
  }

  cleanDomain(domain: string): string {
    if (!domain) return '';
    return domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }

  showResults() {
    this.domain = this.cleanDomain(this.domain);
    if (this.domain) {
      this.router.navigate(['/preview', this.domain]);
    }
  }
}

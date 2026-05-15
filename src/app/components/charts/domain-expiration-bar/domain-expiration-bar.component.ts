import { Component, OnInit, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeterItem } from 'primeng/metergroup';
import { PrimeNgModule } from '../../../prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { DomainExpiration } from '~/app/../types/Database';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-domain-expiration-bar',
  standalone: true,
  imports: [CommonModule, PrimeNgModule, TranslateModule],
  templateUrl: './domain-expiration-bar.component.html',
  styles: [
    `
      ::ng-deep .p-metergroup p-metergrouplabel {
        display: none;
      }
      ::ng-deep .p-metergroup .p-metergroup-meters {
        border-radius: 3px;
        overflow: hidden;
      }
    `,
  ],
  animations: [
    trigger('slideInOut', [
      state(
        'in',
        style({
          height: '*',
          opacity: 1,
        }),
      ),
      state(
        'out',
        style({
          height: '0px',
          opacity: 0,
        }),
      ),
      transition('in => out', animate('300ms ease-in-out')),
      transition('out => in', animate('300ms ease-in-out')),
    ]),
  ],
})
export class DomainExpirationBarComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private translationService = inject(TranslateService);

  meterValues: MeterItem[] = [];
  counts = { imminently: 0, soon: 0, later: 0 };
  domainsPerCategory: Record<string, DomainExpiration[]> = {
    imminently: [],
    soon: [],
    later: [],
  };
  upcomingDomains: DomainExpiration[] = [];
  nextExpiringDomain?: DomainExpiration;
  loading = true;

  timelineEvents: { date: Date; icon: string; color: string; domain: string }[] = [];
  showTimeline = false;

  @Input() showFull = false;

  ngOnInit() {
    this.databaseService.instance.getDomainExpirations().subscribe((domains) => {
      this.calculateExpirations(domains);
      this.prepareTimelineEvents(domains);
      this.loading = false;
    });
  }

  private calculateExpirations(domains: DomainExpiration[]) {
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;

    domains.forEach((domain) => {
      if (!domain.expiration || domain.expiration.getTime() === 0) return;
      const timeUntilExpiration = domain.expiration.getTime() - now.getTime();
      if (timeUntilExpiration < thirtyDays) {
        this.counts.imminently++;
        this.domainsPerCategory['imminently'].push(domain);
      } else if (timeUntilExpiration < ninetyDays) {
        this.counts.soon++;
        this.domainsPerCategory['soon'].push(domain);
      } else {
        this.counts.later++;
        this.domainsPerCategory['later'].push(domain);
      }
    });

    const total = domains.filter((d) => d.expiration.getTime() !== 0).length;

    this.meterValues = [
      {
        label: `Imminently (${this.counts.imminently})`,
        value: (this.counts.imminently / total) * 100,
        color: 'var(--red-400)',
        icon: 'pi pi-exclamation-circle',
      },
      {
        label: `Soon (${this.counts.soon})`,
        value: (this.counts.soon / total) * 100,
        color: 'var(--orange-400)',
        icon: 'pi pi-exclamation-triangle',
      },
      {
        label: `Later (${this.counts.later})`,
        value: (this.counts.later / total) * 100,
        color: 'var(--green-400)',
        icon: 'pi pi-check',
      },
    ];

    this.upcomingDomains = this.domainsPerCategory['imminently'];
    this.nextExpiringDomain = domains.reduce<DomainExpiration | undefined>(
      (next, current) => {
        const now = new Date();
        if (current.expiration > now) {
          if (!next || current.expiration < next.expiration) {
            return current;
          }
        }
        return next;
      },
      undefined,
    );
  }

  getTooltipContent(category: string): string {
    const domains = this.domainsPerCategory[category] || [];
    if (!domains.length) {
      return this.translationService.instant('DOMAIN_STATS.EXPIRATION_BAR.NO_DOMAINS');
    }
    const displayDomains = domains.slice(0, 4);
    let content = displayDomains.map((d) => d.domain).join(', ');
    if (domains.length > 4) {
      content += ` and ${domains.length - 4} more`;
    }
    const daysStr =
      category === 'imminently'
        ? 'within 30 days'
        : category === 'soon'
          ? 'within 90 days'
          : 'more than 3 months from now';
    content += ` ${domains.length === 1 ? 'is' : 'are'} expiring ${daysStr}.`;
    return content;
  }

  formatExpirationMessage(domain: DomainExpiration): string {
    const days = Math.ceil(
      (domain.expiration.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );
    return `${domain.domain} in ${days} days (${domain.expiration.toLocaleDateString()})`;
  }

  getUpcomingDomainsMessage(): string {
    const domains = this.upcomingDomains.slice(0, 3).map((d) => d.domain);
    let message = domains.join(', ');
    if (this.upcomingDomains.length > 3) {
      message += ` and ${this.upcomingDomains.length - 3} more`;
    }
    message += ` ${this.upcomingDomains.length === 1 ? 'is' : 'are'} expiring within the next 30 days.`;
    return message;
  }

  private prepareTimelineEvents(domains: DomainExpiration[]) {
    this.timelineEvents = domains
      .sort((a, b) => a.expiration.getTime() - b.expiration.getTime())
      .slice(0, 10)
      .map((domain) => ({
        date: domain.expiration,
        icon: this.getExpirationIcon(domain),
        color: this.getExpirationColor(domain),
        domain: domain.domain,
      }));
  }

  private getExpirationIcon(domain: DomainExpiration): string {
    const daysUntilExpiration = Math.ceil(
      (domain.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilExpiration <= 30) return 'pi pi-exclamation-circle';
    if (daysUntilExpiration <= 90) return 'pi pi-exclamation-triangle';
    return 'pi pi-check';
  }

  private getExpirationColor(domain: DomainExpiration): string {
    const daysUntilExpiration = Math.ceil(
      (domain.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilExpiration <= 30) return '#FF4136';
    if (daysUntilExpiration <= 90) return '#FF851B';
    return '#2ECC40';
  }

  toggleTimeline() {
    this.showTimeline = !this.showTimeline;
  }
}

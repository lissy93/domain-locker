import { Component, OnInit, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { MessageService } from 'primeng/api';
import { TabViewModule } from 'primeng/tabview';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';

interface IpAddress {
  ip_address: string;
  domains: string[];
}

interface DomainWithIpAddresses {
  domain: string;
  ipAddresses: string[];
}

@Component({
  standalone: true,
  selector: 'app-assets-ips-page',
  imports: [PrimeNgModule, TabViewModule, TableModule],
  templateUrl: './index.page.html',
  styleUrls: ['./index.page.scss'],
})
export default class IpAddressesPageComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  ipv4Addresses: IpAddress[] = [];
  ipv6Addresses: IpAddress[] = [];
  ipv4Domains: DomainWithIpAddresses[] = [];
  ipv6Domains: DomainWithIpAddresses[] = [];
  loadingIpv4 = true;
  loadingIpv6 = true;

  ngOnInit() {
    this.loadIpAddresses();
  }

  loadIpAddresses() {
    this.loadingIpv4 = this.loadingIpv6 = true;

    this.databaseService.instance.ipQueries.getIpAddresses(false).subscribe({
      next: (addresses) => {
        this.ipv4Addresses = addresses;
        this.ipv4Domains = this.groupByDomain(addresses);
        this.loadingIpv4 = false;
      },
      error: () => this.handleError('IPv4'),
    });

    this.databaseService.instance.ipQueries.getIpAddresses(true).subscribe({
      next: (addresses) => {
        this.ipv6Addresses = addresses;
        this.ipv6Domains = this.groupByDomain(addresses);
        this.loadingIpv6 = false;
      },
      error: () => this.handleError('IPv6'),
    });
  }

  handleError(type: string) {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: `Failed to load ${type} addresses`,
    });
    this.loadingIpv4 = this.loadingIpv6 = false;
  }

  groupByDomain(ipAddresses: IpAddress[]): DomainWithIpAddresses[] {
    return ipAddresses.reduce((results: DomainWithIpAddresses[], ip) => {
      ip.domains.forEach((domain) => {
        const existingDomain = results.find((result) => result.domain === domain);
        if (existingDomain) {
          existingDomain.ipAddresses.push(ip.ip_address);
        } else {
          results.push({ domain, ipAddresses: [ip.ip_address] });
        }
      });
      return results;
    }, []);
  }

  navigateToDomain(domain: string) {
    this.router.navigate([`/domains/${domain}`]);
  }
}

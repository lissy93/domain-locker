import { Component, OnInit, inject } from '@angular/core';

import { RouterModule } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { Host } from '~/app/../types/common';
import DatabaseService from '~/app/services/database.service';
import { MessageService } from 'primeng/api';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { TableModule } from 'primeng/table';

@Component({
  standalone: true,
  selector: 'app-assets-hosts-page',
  imports: [RouterModule, PrimeNgModule, TableModule],
  template: `
    <h1 class="mt-2 mb-4">Hosts</h1>
    <p-table [value]="hosts" [loading]="loading" styleClass="p-datatable-striped">
      <ng-template pTemplate="header">
        <tr>
          <th>ISP</th>
          <th>IP Addresses</th>
          <th>Organization</th>
          <th>Country</th>
          <th>Domain Count</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-host>
        <tr>
          <td>
            <a [routerLink]="['/assets/hosts', host.isp]" class="text-primary">{{
              host.isp
            }}</a>
          </td>
          <td>{{ host.ip }}</td>
          <td>{{ host.org }}</td>
          <td>{{ host.country }}</td>
          <td>{{ host.domainCount }}</td>
        </tr>
      </ng-template>
    </p-table>
  `,
})
export default class HostsIndexPageComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private errorHandler = inject(ErrorHandlerService);

  hosts: (Host & { domainCount: number })[] = [];
  loading = true;

  ngOnInit() {
    this.loadHosts();
  }

  loadHosts() {
    this.loading = true;
    this.databaseService.instance.hostsQueries.getHostsWithDomainCounts().subscribe({
      next: (hostsWithCounts) => {
        // Group hosts by ISP
        const groupedHosts = hostsWithCounts.reduce(
          (acc, host) => {
            const ip = host.ip || '';
            if (!acc[host.isp]) {
              acc[host.isp] = {
                ...host,
                ips: [ip],
                domainCount: host.domain_count,
              };
            } else {
              acc[host.isp].ips.push(ip);
              acc[host.isp].domainCount += host.domain_count;
            }
            return acc;
          },
          {} as Record<string, Host & { ips: string[]; domainCount: number }>,
        );

        // Convert grouped hosts back to an array
        this.hosts = Object.values(groupedHosts)
          .map((host) => ({
            ...host,
            ip: host.ips.join(', '),
          }))
          .sort((a, b) => b.domainCount - a.domainCount);

        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          message: 'Failed to load hosts',
          error,
          showToast: true,
          location: 'HostsIndexPageComponent.loadHosts',
        });
        this.loading = false;
      },
    });
  }

  loadDomainCounts() {
    this.databaseService.instance.hostsQueries.getDomainCountsByHost().subscribe({
      next: (counts) => {
        this.hosts = this.hosts.map((host) => ({
          ...host,
          domainCount: counts[host.isp] || 0,
        }));
        this.loading = false;
      },
      error: (error) => {
        this.errorHandler.handleError({
          message: 'Failed to load domain counts',
          error,
          showToast: true,
          location: 'HostsIndexPageComponent.loadDomainCounts',
        });
        this.loading = false;
      },
    });
  }
}

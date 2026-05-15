import { Component, OnInit, inject } from '@angular/core';

import { PrimeNgModule } from '~/app/prime-ng.module';
import DatabaseService from '~/app/services/database.service';
import { Router } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  selector: 'app-tld-organization-chart',
  templateUrl: './domain-hierarchy.component.html',
  styleUrls: ['./domain-hierarchy.component.scss'],
  standalone: true,
  imports: [PrimeNgModule],
})
export class TldOrganizationChartComponent implements OnInit {
  private db = inject(DatabaseService);
  router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);

  chartData: TreeNode[] = [];
  groupByOptions = [
    { label: 'By Level', value: 'level' },
    { label: 'By Name', value: 'name' },
    { label: 'By TLD', value: 'tld' },
  ];
  groupBy = this.groupByOptions[0];

  ngOnInit() {
    this.prepareChartData();
  }

  private prepareChartData() {
    this.db.instance.listDomains().subscribe(
      (domains) => {
        const tldMap = new Map<string, TreeNode>();

        domains.forEach((domain) => {
          const tld = this.extractTld(domain.domain_name);
          const subdomains = domain.sub_domains || [];

          if (!tldMap.has(tld)) {
            tldMap.set(tld, {
              label: tld,
              type: 'tld',
              expanded: true,
              children: [],
            });
          }

          const domainNode: TreeNode = {
            label: domain.domain_name,
            type: 'domain',
            expanded: true,
            data: {
              tooltip: `Registrar: ${domain.registrar?.name || 'Unknown'}\nExpiry Date: ${domain.expiry_date || 'N/A'}`,
              routerLink: `/domains/${domain.domain_name}`,
            },
            children: subdomains.map((subdomain) => ({
              label: subdomain.name,
              type: 'subdomain',
              expanded: true,
            })),
          };

          tldMap.get(tld)!.children!.push(domainNode);
        });

        this.chartData = [
          { label: 'Domains', expanded: true, children: Array.from(tldMap.values()) },
        ];
        this.setNodeStyles();
      },
      (error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to fetch domains',
          location: 'TldOrganizationChartComponent.prepareChartData',
        });
      },
    );
  }

  private extractTld(domainName: string): string {
    return domainName.split('.').pop()?.toLowerCase() || '';
  }

  // Set styles based on selected grouping
  setNodeStyles() {
    const colorClasses = [
      'bg-blue',
      'bg-green',
      'bg-yellow',
      'bg-cyan',
      'bg-pink',
      'bg-indigo',
      'bg-teal',
      'bg-orange',
      'bg-purple',
      'bg-red',
    ];
    const colorShades = { tld: '-500', domain: '-400', subdomain: '-300' };
    let colorIndex = 0;

    // Map for caching colors by name for the "name" grouping
    const nameColorMap = new Map<string, string>();

    // Deep copy the existing chartData array so Angular detects a change
    const newChartData = JSON.parse(JSON.stringify(this.chartData));
    const groupBy = this.groupBy.value;

    // Set root node color
    if (groupBy === 'level') newChartData[0].styleClass = 'bg-blue-600';
    if (groupBy === 'tld') newChartData[0].styleClass = 'bg-surface-200';
    if (groupBy === 'name') newChartData[0].styleClass = 'bg-bluegray-600';

    newChartData[0].children.forEach((tldNode: TreeNode) => {
      if (groupBy === 'tld') {
        tldNode.styleClass =
          colorClasses[colorIndex % colorClasses.length] + colorShades.tld;
        colorIndex++;
      } else if (groupBy === 'name') {
        const tldName = tldNode.label || '';
        if (!nameColorMap.has(tldName)) {
          nameColorMap.set(tldName, colorClasses[colorIndex % colorClasses.length]);
          colorIndex++;
        }
        tldNode.styleClass = nameColorMap.get(tldName)! + colorShades.tld;
      } else if (groupBy === 'level') {
        tldNode.styleClass = 'bg-cyan-400';
      }

      tldNode.children?.forEach((domainNode: TreeNode) => {
        domainNode.styleClass = '';

        if (groupBy === 'tld') {
          domainNode.styleClass = tldNode.styleClass?.replace(
            colorShades.tld,
            colorShades.domain,
          );
        } else if (groupBy === 'name') {
          const domainNameBase = domainNode.label?.split('.')[0] || '';
          if (!nameColorMap.has(domainNameBase)) {
            nameColorMap.set(
              domainNameBase,
              colorClasses[colorIndex % colorClasses.length],
            );
            colorIndex++;
          }
          domainNode.styleClass = nameColorMap.get(domainNameBase)! + colorShades.domain;
        } else if (groupBy === 'level') {
          domainNode.styleClass = 'bg-purple-400';
        }

        domainNode.children?.forEach((subdomainNode: TreeNode) => {
          subdomainNode.styleClass = '';

          if (groupBy === 'tld') {
            subdomainNode.styleClass = domainNode.styleClass?.replace(
              colorShades.domain,
              colorShades.subdomain,
            );
          } else if (groupBy === 'name') {
            const subdomainBase = subdomainNode.label?.split('.')[0] || '';
            if (!nameColorMap.has(subdomainBase)) {
              nameColorMap.set(
                subdomainBase,
                colorClasses[colorIndex % colorClasses.length],
              );
              colorIndex++;
            }
            subdomainNode.styleClass =
              nameColorMap.get(subdomainBase)! + colorShades.subdomain;
          } else if (groupBy === 'level') {
            subdomainNode.styleClass = 'bg-pink-400';
          }
        });
      });
    });
    this.chartData = newChartData;
  }
}

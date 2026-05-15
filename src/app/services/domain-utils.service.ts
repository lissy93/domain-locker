// src/app/shared/domain.service.ts
import { DbDomain } from '~/app/../types/Database';
import { Injectable } from '@angular/core';
import { makeEppArrayFromLabels } from '~/app/constants/security-categories';

@Injectable({
  providedIn: 'root',
})
export class DomainUtils {
  extractTags(data: Record<string, unknown>): string[] {
    const domainTags = data['domain_tags'];
    if (Array.isArray(domainTags)) {
      // Handle the case for /domains page
      return domainTags
        .filter(
          (tagItem: { tags?: { name?: string } }) => tagItem.tags && tagItem.tags.name,
        )
        .map((tagItem: { tags: { name: string } }) => tagItem.tags.name);
    } else if (data['tags']) {
      // Handle the case for /assets/tags/[tag-name] page
      return [data['tags'] as string];
    }
    return [];
  }

  formatDomainData(data: Record<string, unknown>): DbDomain {
    const dnsRecords =
      (data['dns_records'] as
        | { record_type: string; record_value: string }[]
        | undefined) || [];
    const sslCertificates = data['ssl_certificates'] as unknown[] | undefined;
    const domainHosts = data['domain_hosts'] as { hosts: unknown }[] | undefined;
    const domainStatuses = data['domain_statuses'] as
      | { status_code: string }[]
      | undefined;
    return {
      ...data,
      tags: this.extractTags(data),
      ssl: sslCertificates && sslCertificates.length ? sslCertificates[0] : null,
      whois: data['whois_info'],
      registrar: data['registrars'],
      host: domainHosts && domainHosts.length > 0 ? domainHosts[0].hosts : null,
      dns: {
        mxRecords: dnsRecords
          .filter((record) => record.record_type === 'MX')
          .map((record) => record.record_value),
        txtRecords: dnsRecords
          .filter((record) => record.record_type === 'TXT')
          .map((record) => record.record_value),
        nameServers: dnsRecords
          .filter((record) => record.record_type === 'NS')
          .map((record) => record.record_value),
      },
      statuses: makeEppArrayFromLabels(
        domainStatuses?.map((status) => status.status_code) || [],
      ),
    } as unknown as DbDomain;
  }

  /* For a given expiry date, return the number of days remaining */
  getDaysRemaining(expiryDate: Date): number {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const timeDiff = expiry.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /* Truncate long to 64 characters */
  truncateNotes(notes: string): string {
    return notes && notes.length > 64 ? notes.substring(0, 64) + '...' : notes || '';
  }

  /* Split a domain into domain and tld */
  splitDomain(domain: string): { domain: string; tld: string } {
    if (!domain) {
      return { domain: '', tld: '' };
    }
    if (domain.indexOf('.') === -1) {
      return { domain, tld: '' };
    }
    const parts = domain.split('.');
    return {
      domain: parts[0],
      tld: parts.slice(1).join('.'),
    };
  }

  /* Returns text string for remaining time for a domain */
  getRemainingDaysText(expiryDate: Date): string {
    const daysRemaining = this.getDaysRemaining(expiryDate);
    if (daysRemaining < 1) {
      return 'Expired';
    }
    if (daysRemaining > 1080) {
      const months = Math.floor(daysRemaining / 30 / 12);
      return `${months} years`;
    }
    if (daysRemaining > 420) {
      const months = Math.floor(daysRemaining / 30);
      return `${months} months`;
    }
    return `${daysRemaining} days`;
  }

  /* Returns the severity level for the expiry date */
  getExpirySeverity(
    expiryDate: Date,
  ): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' {
    const daysRemaining = this.getDaysRemaining(expiryDate);
    if (daysRemaining > 90) {
      return 'success';
    } else if (daysRemaining > 30) {
      return 'warning';
    } else {
      return 'danger';
    }
  }
}

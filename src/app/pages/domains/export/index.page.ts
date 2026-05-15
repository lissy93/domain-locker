import { Component, inject } from '@angular/core';
import DatabaseService from '~/app/services/database.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import savePkg from 'file-saver';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-domains-export-page',
  templateUrl: './export.page.html',
  imports: [PrimeNgModule, ReactiveFormsModule],
})
export default class ExportPageComponent {
  private fb = inject(FormBuilder);
  private databaseService = inject(DatabaseService);
  private messageService = inject(GlobalMessageService);
  exportForm: FormGroup;
  loading = false;
  availableFields: { label: string; value: string }[] = [
    { label: 'Domain Statuses', value: 'domain_statuses' },
    { label: 'IP Addresses', value: 'ip_addresses' },
    { label: 'WHOIS Info', value: 'whois_info' },
    { label: 'Tags', value: 'domain_tags' },
    { label: 'Hosts', value: 'domain_hosts' },
    { label: 'SSL Certificates', value: 'ssl_certificates' },
    { label: 'Notifications', value: 'notifications' },
    { label: 'DNS Records', value: 'dns_records' },
    { label: 'Costings', value: 'domain_costings' },
  ];

  constructor() {
    this.exportForm = this.fb.group({
      domains: [''],
      format: ['csv'],
      fields: [[]],
    });
  }

  exportData() {
    this.loading = true;
    const { domains, fields, format } = this.exportForm.value;

    // Fetch data based on user selections
    this.databaseService.instance.fetchAllForExport(domains, fields).subscribe({
      next: (data) => {
        try {
          this.downloadFile(data, format);
          const count = data.length;
          const domainWord = count === 1 ? 'domain' : 'domains';
          this.messageService.showSuccess(
            'Export Successful',
            `Successfully exported ${count} ${domainWord} as ${format.toUpperCase()}`,
          );
        } catch {
          this.messageService.showError(
            'Export Failed',
            'Failed to generate export file. Please try again.',
          );
        } finally {
          this.loading = false;
        }
      },
      error: (error) => {
        const errorMsg = error?.message || 'Unknown error occurred';
        const detail = errorMsg.includes('authenticated')
          ? 'Please log in to export your domains.'
          : errorMsg.includes('network') || errorMsg.includes('fetch')
            ? 'Network error. Please check your connection and try again.'
            : 'Failed to export data. Please try again or contact support.';

        this.messageService.showError('Export Failed', detail);
        this.loading = false;
      },
    });
  }

  private downloadFile(data: Record<string, unknown>[], format: string) {
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format');
    }

    let blob: Blob;
    let content: string;

    try {
      if (format === 'csv') {
        content = this.convertToCSV(data);
        blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      } else if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        blob = new Blob([content], { type: 'application/json' });
      } else {
        content = this.convertToTXT(data);
        blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      }

      const timestamp = new Date().toISOString().split('T')[0];
      savePkg.saveAs(blob, `domains-${timestamp}.${format}`);
    } catch {
      throw new Error(`Failed to convert data to ${format.toUpperCase()} format`);
    }
  }

  private convertToCSV(data: Record<string, unknown>[]): string {
    if (!data.length) return 'No data to export';

    const headers = Object.keys(data[0]);
    const headerRow = headers.map((h) => this.escapeCSV(h)).join(',');

    const rows = data.map((row) =>
      headers.map((header) => this.escapeCSV(row[header])).join(','),
    );

    return `${headerRow}\n${rows.join('\n')}`;
  }

  private escapeCSV(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private convertToTXT(data: Record<string, unknown>[]): string {
    if (!data.length) return 'No domains to export';

    return data
      .map((domain, index) => {
        const lines = [
          `\n${'='.repeat(60)}`,
          `Domain ${index + 1}: ${domain['domain_name'] || 'Unknown'}`,
          '='.repeat(60),
        ];

        const formatDate = (dateStr: unknown): string => {
          if (!dateStr) return 'N/A';
          try {
            const date = new Date(dateStr as string | number | Date);
            return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
          } catch {
            return 'Invalid Date';
          }
        };

        const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
        const fields: [string, unknown][] = [
          ['Expiry Date', formatDate(domain['expiry_date'])],
          ['Registrar', domain['registrar_name'] || 'Unknown'],
          ['Registration Date', formatDate(domain['registration_date'])],
          ['IP Addresses', domain['ip_addresses'] || 'None'],
          ['SSL Certificates', domain['ssl_certificates'] || 'None'],
          ['DNS Records', domain['dns_records'] || 'None'],
          ['Tags', domain['tags'] || 'None'],
          ['WHOIS Name', domain['whois_name'] || 'N/A'],
          ['WHOIS Organization', domain['whois_organization'] || 'N/A'],
          ['WHOIS Country', domain['whois_country'] || 'N/A'],
          ['Hosts', domain['hosts'] || 'None'],
          [
            'Purchase Price',
            num(domain['purchase_price']) > 0 ? `$${domain['purchase_price']}` : 'N/A',
          ],
          [
            'Current Value',
            num(domain['current_value']) > 0 ? `$${domain['current_value']}` : 'N/A',
          ],
          [
            'Renewal Cost',
            num(domain['renewal_cost']) > 0 ? `$${domain['renewal_cost']}` : 'N/A',
          ],
          ['Auto Renew', domain['auto_renew'] || 'No'],
          ['Notes', domain['notes'] || 'None'],
        ];

        fields.forEach(([label, value]) => {
          if (value && value !== 'None' && value !== 'N/A' && value !== 'Invalid Date') {
            lines.push(`${label}: ${value}`);
          }
        });

        return lines.join('\n');
      })
      .join('\n\n');
  }
}

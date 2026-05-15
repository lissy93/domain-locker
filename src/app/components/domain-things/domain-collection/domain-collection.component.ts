import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  Output,
  ViewChild,
  inject,
} from '@angular/core';

import Fuse from 'fuse.js';
import { DomainCardComponent } from '~/app/components/domain-things/domain-card/domain-card.component';
import { DomainListComponent } from '~/app/components/domain-things/domain-list/domain-list.component';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DbDomain } from '~/app/../types/Database';
import {
  FieldVisibilityFilterComponent,
  type FieldOption,
} from '~/app/components/domain-things/domain-filters/domain-filters.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-domain-view',
  standalone: true,
  imports: [
    DomainCardComponent,
    DomainListComponent,
    PrimeNgModule,
    FieldVisibilityFilterComponent,
    TranslateModule,
  ],
  templateUrl: './domain-collection.component.html',
})
export class DomainCollectionComponent implements OnInit, OnChanges {
  private cdr = inject(ChangeDetectorRef);

  @Input() domains: DbDomain[] = [];
  @Input() showAddButton = true;
  @Input() showFooter = true;
  @Input() preFilteredText: string | undefined;
  @Input() loading = false;

  @Input() triggerReload: () => void = () => {
    /* no-op */
  };
  @Output() $triggerReload = new EventEmitter();

  @ViewChild(FieldVisibilityFilterComponent)
  filtersComp!: FieldVisibilityFilterComponent;

  filteredDomains: DbDomain[] = [];
  isGridLayout = true;
  visibleFields: FieldOption[] = [];
  searchTerm = '';
  sortOrder = 'date';
  private fuse!: Fuse<DbDomain>;

  allColumns = [
    {
      field: 'domain_name',
      header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.DOMAIN_NAME',
      width: 200,
    },
    {
      field: 'registrar',
      header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.REGISTRAR',
      width: 150,
    },
    {
      field: 'expiry_date',
      header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.EXPIRY_DATE',
      width: 120,
    },
    { field: 'tags', header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.TAGS', width: 150 },
    { field: 'notes', header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.NOTES', width: 200 },
    {
      field: 'statuses',
      header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.SECURITY_STATUSES',
      width: 150,
    },
    {
      field: 'ip_addresses',
      header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.IP_ADDRESSES',
      width: 150,
    },
    {
      field: 'renewal_cost',
      header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.RENEWAL_COST',
      width: 150,
    },
    { field: 'ssl', header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.SSL', width: 200 },
    { field: 'whois', header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.WHOIS', width: 200 },
    { field: 'host', header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.HOST_INFO', width: 200 },
    { field: 'dns', header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.DNS_RECORDS', width: 200 },
    {
      field: 'sub_domains',
      header: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.SUB_DOMAINS',
      width: 200,
    },
  ];

  visibleColumns: { field: string; header: string; width: number }[] = [];

  ngOnInit() {
    this.filteredDomains = this.domains;
    this.sortDomains();
    this.initializeFuse();
    this.updateVisibleColumns();
  }

  ngOnChanges(changes: SimpleChanges) {
    // When domains input changes, update filtered domains and re-initialize Fuse
    if (changes['domains'] && !changes['domains'].firstChange) {
      this.filteredDomains = this.domains;
      this.initializeFuse();
      this.sortDomains();
      this.cdr.markForCheck();
    }
  }

  onVisibilityChange(selectedFields: FieldOption[]) {
    this.visibleFields = selectedFields;
    this.updateVisibleColumns();
  }

  onSortChange(sortOption: FieldOption) {
    this.sortOrder = sortOption.value;
    this.sortDomains();
  }

  updateVisibleColumns() {
    const domainNameField = {
      value: 'domainName',
      label: 'DOMAINS.DOMAIN_COLLECTION.COLUMN.DOMAIN_NAME',
    };
    const fieldsToShow = this.visibleFields.some((f) => f.value === 'domainName')
      ? this.visibleFields
      : [domainNameField, ...this.visibleFields];

    this.visibleColumns = this.allColumns.filter((column) =>
      fieldsToShow.some((field) => this.mapFieldToColumn(field.value) === column.field),
    );

    this.visibleColumns.sort((a, b) =>
      a.field === 'domain_name' ? -1 : b.field === 'domain_name' ? 1 : 0,
    );
  }

  sortDomains() {
    switch (this.sortOrder) {
      case 'alphabetical':
        this.filteredDomains.sort((a, b) => a.domain_name.localeCompare(b.domain_name));
        break;
      case 'expiryDate':
        this.filteredDomains.sort((a, b) => {
          const aTime = a.expiry_date
            ? new Date(a.expiry_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          const bTime = b.expiry_date
            ? new Date(b.expiry_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });
        break;
      case 'date':
      default:
        this.filteredDomains = [...this.domains];
        break;
    }
  }

  mapFieldToColumn(fieldValue: string): string {
    const fieldToColumnMap: Record<string, string> = {
      domainName: 'domain_name',
      registrar: 'registrar',
      expiryDate: 'expiry_date',
      tags: 'tags',
      notes: 'notes',
      ipAddresses: 'ip_addresses',
      renewalCost: 'renewal_cost',
      sslCertificate: 'ssl',
      whoisRecord: 'whois',
      hostInfo: 'host',
      dnsRecords: 'dns',
      subDomains: 'sub_domains',
    };
    return fieldToColumnMap[fieldValue] || fieldValue;
  }

  onSearchChange(searchTerm: string) {
    this.searchTerm = searchTerm.toLowerCase();
    this.filterDomains();
  }

  onLayoutChange(isGrid: boolean) {
    this.isGridLayout = isGrid;
  }

  reloadDomains(event: string) {
    setTimeout(() => {
      this.$triggerReload.emit(event);
      this.cdr.detectChanges();
    }, 1000);
  }

  initializeFuse() {
    const options = {
      keys: ['domain_name', 'registrar.name', 'tags', 'notes', 'ip_addresses.ip_address'],
      threshold: 0.3,
    };
    this.fuse = new Fuse(this.domains, options);
  }

  filterDomains() {
    if (!this.searchTerm) {
      this.filteredDomains = this.domains;
      return;
    }
    const searchResults = this.fuse.search(this.searchTerm);
    this.filteredDomains = searchResults.map((result) => result.item);
    if (this.filteredDomains.length === 0) {
      this.filteredDomains = this.domains.filter((domain) =>
        this.domainMatchesSearch(domain, this.searchTerm.toLowerCase()),
      );
    }
  }

  domainMatchesSearch(domain: DbDomain, searchTerm: string): boolean {
    return (
      domain.domain_name.toLowerCase().includes(searchTerm) ||
      domain.registrar?.name.toLowerCase().includes(searchTerm) ||
      domain.tags?.some((tag) => tag.toLowerCase().includes(searchTerm)) ||
      domain.notes?.toLowerCase().includes(searchTerm) ||
      domain.ip_addresses?.some((ip) => ip.ip_address.includes(searchTerm)) ||
      false
    );
  }

  resetFilters() {
    this.searchTerm = '';
    this.filtersComp.initializeSelectedFields();
    this.filteredDomains = this.domains;
    this.sortOrder = 'date';
    this.sortDomains();
  }
}

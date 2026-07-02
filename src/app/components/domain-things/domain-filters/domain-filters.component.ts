import {
  Component,
  Output,
  EventEmitter,
  Input,
  OnInit,
  ChangeDetectorRef,
  inject,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { Router } from '@angular/router';
import QuickAddDomain from '~/app/pages/domains/add/quick-add/index.page';

export interface FieldOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-field-visibility-filter',
  standalone: true,
  imports: [FormsModule, PrimeNgModule, QuickAddDomain],
  templateUrl: 'domain-filters.component.html',
  styleUrls: ['domain-filters.component.scss'],
})
export class FieldVisibilityFilterComponent implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  @Input() fieldOptions: FieldOption[] = [
    { label: 'Domain Name', value: 'domainName' },
    { label: 'Registrar', value: 'registrar' },
    { label: 'Expiry Date', value: 'expiryDate' },
    { label: 'Tags', value: 'tags' },
    { label: 'Notes', value: 'notes' },
    { label: 'Security Status', value: 'statuses' },
    { label: 'IP Addresses', value: 'ipAddresses' },
    { label: 'SSL Certificate', value: 'sslCertificate' },
    { label: 'WHOIS Record', value: 'whoisRecord' },
    { label: 'Host Info', value: 'hostInfo' },
    { label: 'DNS Records', value: 'dnsRecords' },
    { label: 'Renewal Cost', value: 'renewalCost' },
    { label: 'Sub-Domains', value: 'subDomains' },
  ];
  @Input() sortOptions: FieldOption[] = [
    { label: 'Date Added', value: 'date' },
    { label: 'Alphabetical', value: 'alphabetical' },
    { label: 'Expiry Date', value: 'expiryDate' },
  ];

  @Input() defaultSelectedFields: string[] = ['domainName', 'registrar', 'expiryDate'];
  @Input() showAddButton = true;
  @Output() visibilityChange = new EventEmitter<FieldOption[]>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() layoutChange = new EventEmitter<boolean>();
  @Output() sortChange = new EventEmitter<FieldOption>();

  @Input() triggerReload: () => void = () => {
    /* no-op */
  };
  @Output() $triggerReload = new EventEmitter();

  selectedFields: FieldOption[] = [];
  selectedFieldsList: string[] = [];
  sortOrder: FieldOption = this.sortOptions[0];
  selectedLayout = true;
  quickAddDialogOpen = false;
  filtersOpen = false;

  layoutOptions = [
    { label: 'Grid', value: true, icon: 'pi pi-th-large' },
    { label: 'List', value: false, icon: 'pi pi-bars' },
  ];

  addButtonLinks = [
    {
      label: 'Add Domain',
      icon: 'pi pi-caret-right',
      routerLink: ['/domains/add'],
    },
    {
      label: 'Quick Add',
      icon: 'pi pi-caret-right',
      command: () => this.showQuickAddDialog(),
    },
    {
      label: 'Bulk Add',
      icon: 'pi pi-caret-right',
      routerLink: ['/domains/add/bulk-add'],
    },
    {
      label: 'Export Domains',
      icon: 'pi pi-caret-down',
      routerLink: ['/domains/export'],
    },
  ];

  ngOnInit() {
    this.initializeSelectedFields();
  }

  public initializeSelectedFields() {
    this.selectedFields = this.fieldOptions.filter((option) =>
      this.defaultSelectedFields.includes(option.value),
    );
    this.selectedFieldsList = this.selectedFields.map((field) => field.value);
    this.onSelectionChange();
  }

  onSelectionChange() {
    if (this.selectedFields.length === 0) {
      this.initializeSelectedFields();
    }
    this.selectedFields = this.fieldOptions.filter((option) =>
      this.selectedFieldsList.includes(option.value),
    );
    this.visibilityChange.emit(this.selectedFields);
  }

  onSortChange(event: { value: FieldOption }) {
    this.sortChange.emit(event.value);
  }

  onSearch(event: Event) {
    const searchTerm = (event.target as HTMLInputElement).value;
    this.searchChange.emit(searchTerm);
  }

  onLayoutChange(event: boolean) {
    this.layoutChange.emit(event === null ? true : event);
  }

  navigateToAddDomain() {
    this.router.navigate(['/domains/add']);
  }

  showQuickAddDialog() {
    this.quickAddDialogOpen = true;
  }

  afterDomainAdded(newDomain: string) {
    this.quickAddDialogOpen = false;
    this.cdr.detectChanges();
    this.$triggerReload.emit(newDomain);
  }
}

import {
  Component,
  Output,
  EventEmitter,
  Input,
  OnInit,
  ChangeDetectorRef,
  PLATFORM_ID,
  inject,
} from '@angular/core';

import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { Router } from '@angular/router';
import QuickAddDomain from '~/app/pages/domains/add/quick-add/index.page';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

export interface FieldOption {
  label: string;
  value: string;
}

interface ViewPrefs {
  layout: boolean;
  fields: string[];
  sort: string;
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
  private platformId = inject<object>(PLATFORM_ID);
  private errorHandler = inject(ErrorHandlerService);
  private readonly prefsKey = 'domainViewPrefs';

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
  @Input() initialSearch = '';
  @Output() visibilityChange = new EventEmitter<FieldOption[]>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() layoutChange = new EventEmitter<boolean>();
  @Output() sortChange = new EventEmitter<FieldOption>();

  @Input() triggerReload: () => void = () => {
    /* no-op */
  };
  @Output() $triggerReload = new EventEmitter();

  searchTerm = '';
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
    this.searchTerm = this.initialSearch;
    this.applyPrefs(this.loadPrefs());
  }

  /* Clears the search and restores the default layout, fields and sort */
  public resetView() {
    localStorage.removeItem(this.prefsKey);
    this.searchTerm = '';
    this.searchChange.emit('');
    this.applyPrefs({});
  }

  /* Whether the layout, fields or sort differ from the defaults */
  get isCustomView(): boolean {
    return (
      !this.selectedLayout ||
      this.sortOrder !== this.sortOptions[0] ||
      this.selectedFieldsList.join() !== this.defaultSelectedFields.join()
    );
  }

  /* Applies layout, fields and sort, using defaults for anything missing or unknown */
  private applyPrefs(prefs: Partial<ViewPrefs>) {
    this.selectedLayout = typeof prefs.layout === 'boolean' ? prefs.layout : true;
    this.sortOrder =
      this.sortOptions.find((option) => option.value === prefs.sort) ||
      this.sortOptions[0];
    this.setFields(Array.isArray(prefs.fields) ? prefs.fields : []);
    this.layoutChange.emit(this.selectedLayout);
    this.sortChange.emit(this.sortOrder);
  }

  /* Reads the user's saved layout, fields and sort, if any */
  private loadPrefs(): Partial<ViewPrefs> {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      return JSON.parse(localStorage.getItem(this.prefsKey) || '{}') ?? {};
    } catch (error) {
      this.errorHandler.handleError({
        error,
        message: 'Saved domain view options are invalid, using defaults',
        location: 'FieldVisibilityFilterComponent.loadPrefs',
      });
      return {};
    }
  }

  /* Saves the current layout, fields and sort for next time */
  private savePrefs() {
    const prefs: ViewPrefs = {
      layout: this.selectedLayout,
      fields: this.selectedFieldsList,
      sort: this.sortOrder.value,
    };
    localStorage.setItem(this.prefsKey, JSON.stringify(prefs));
  }

  /* Shows the given fields, or the defaults if none of them are known */
  private setFields(fields: string[]) {
    const known = this.fieldOptions.filter((option) => fields.includes(option.value));
    this.selectedFields = known.length
      ? known
      : this.fieldOptions.filter((option) =>
          this.defaultSelectedFields.includes(option.value),
        );
    this.selectedFieldsList = this.selectedFields.map((field) => field.value);
    this.visibilityChange.emit(this.selectedFields);
  }

  onSelectionChange() {
    this.setFields(this.selectedFieldsList);
    this.savePrefs();
  }

  onSortChange(event: { value: FieldOption }) {
    this.sortChange.emit(event.value);
    this.savePrefs();
  }

  onLayoutChange(event: boolean) {
    this.layoutChange.emit(event);
    this.savePrefs();
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

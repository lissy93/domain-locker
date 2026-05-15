import { Component, ElementRef, Input, OnInit, inject } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DbDomain } from '~/app/../types/Database';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DatePipe, CommonModule } from '@angular/common';
import { DomainUtils } from '~/app/services/domain-utils.service';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { type FieldOption } from '~/app/components/domain-things/domain-filters/domain-filters.component';
import DatabaseService from '~/app/services/database.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { CurrencyService } from '~/app/services/currency.service';

@Component({
  standalone: true,
  selector: 'app-domain-card',
  templateUrl: './domain-card.component.html',
  styleUrls: ['./domain-card.component.scss'],
  imports: [
    PrimeNgModule,
    DatePipe,
    CommonModule,
    DomainFaviconComponent,
    TranslateModule,
  ],
  providers: [ConfirmationService, MessageService],
  animations: [
    trigger('cardAnimation', [
      state(
        'visible',
        style({
          opacity: 1,
          transform: 'translateY(0)',
        }),
      ),
      state(
        'hidden',
        style({
          opacity: 0,
          transform: 'translateY(-100%)',
        }),
      ),
      transition('visible => hidden', animate('300ms ease-out')),
    ]),
  ],
})
export class DomainCardComponent implements OnInit {
  domainUtils = inject(DomainUtils);
  private router = inject(Router);
  private confirmationService = inject(ConfirmationService);
  private databaseService = inject(DatabaseService);
  private globalMessageService = inject(GlobalMessageService);
  private elRef = inject(ElementRef);
  private errorHandler = inject(ErrorHandlerService);
  private translate = inject(TranslateService);
  currencyService = inject(CurrencyService);

  @Input() domain!: DbDomain;
  @Input() visibleFields: FieldOption[] = [];
  contextMenuItems: MenuItem[] | undefined;
  cardVisible = true;

  isVisible(field: string): boolean {
    return this.visibleFields.some((option) => option.value === field);
  }

  ngOnInit() {
    this.contextMenuItems = [
      {
        label: this.translate.instant('DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.VIEW'),
        icon: 'pi pi-reply',
        command: () => this.viewDomain(),
      },
      {
        label: this.translate.instant('DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.EDIT'),
        icon: 'pi pi-pencil',
        command: () => this.editDomain(),
      },
      {
        label: this.translate.instant(
          'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.DELETE',
        ),
        icon: 'pi pi-trash',
        command: (event) => this.deleteDomain(event),
      },
      {
        label: this.translate.instant(
          'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.COPY_URL',
        ),
        icon: 'pi pi-copy',
        command: () => this.copyDomainUrl(),
      },
      {
        label: this.translate.instant(
          'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.VISIT_URL',
        ),
        icon: 'pi pi-external-link',
        command: () => this.visitDomainUrl(),
      },
    ];
  }

  viewDomain() {
    this.router.navigate(['/domains', this.domain.domain_name]);
  }

  editDomain() {
    this.router.navigate(['/domains', this.domain.domain_name, 'edit']);
  }

  deleteDomain(event: import('primeng/api').MenuItemCommandEvent) {
    this.confirmationService.confirm({
      target: event.originalEvent?.target as EventTarget,
      header: this.translate.instant(
        'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.DELETE_HEADER',
      ),
      message: this.translate.instant(
        'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.DELETE_MESSAGE',
      ),
      icon: 'pi pi-exclamation-triangle',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.databaseService.instance.deleteDomain(this.domain.id).subscribe({
          next: () => {
            this.globalMessageService.showMessage({
              severity: 'success',
              summary: this.translate.instant(
                'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.DELETE_SUCCESS_SUMMARY',
              ),
              detail: this.translate.instant(
                'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.DELETE_SUCCESS_DETAIL',
              ),
            });
            this.cardVisible = false;
          },
          error: (err) => {
            this.errorHandler.handleError({
              error: err,
              message:
                this.translate.instant(
                  'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.DELETE_ERROR_SUMMARY',
                ) || 'Failed to delete domain',
              location: 'DomainCardComponent.deleteDomain',
              showToast: true,
            });
          },
        });
      },
    });
  }

  copyDomainUrl() {
    const url = `https://${this.domain.domain_name}`;
    const clipboardCopyFailed = (e: Error | unknown) => {
      this.errorHandler.handleError({
        error: e,
        message: this.translate.instant(
          'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.COPY_ERROR',
        ),
        showToast: true,
      });
    };
    try {
      navigator.clipboard.writeText(url).then(
        () => {
          this.globalMessageService.showMessage({
            severity: 'success',
            summary: this.translate.instant(
              'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.COPY_SUCCESS_SUMMARY',
            ),
            detail: this.translate.instant(
              'DOMAINS.DOMAIN_COLLECTION.GRID.CONTEXT_MENU.COPY_SUCCESS_DETAIL',
            ),
          });
        },
        (err) => {
          clipboardCopyFailed(err);
        },
      );
    } catch (err) {
      clipboardCopyFailed(err);
    }
  }

  visitDomainUrl() {
    const url = `https://${this.domain.domain_name}`;
    window.open(url, '_blank');
  }

  private clickedOnLink(element: HTMLElement): boolean {
    let node: HTMLElement | null = element;
    while (node && node !== this.elRef.nativeElement) {
      if (node.tagName === 'A' || node.tagName === 'BUTTON') {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  onCardClick(event: MouseEvent) {
    if (!this.clickedOnLink(event.target as HTMLElement)) {
      this.viewDomain();
    }
  }

  onCardKeydown(event: Event) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.viewDomain();
  }
}

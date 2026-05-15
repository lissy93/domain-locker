import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DbDomain, Link } from '~/app/../types/Database';
import DatabaseService from '~/app/services/database.service';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { ErrorHandlerService } from '~/app/services/error-handler.service';
import { LinkDialogComponent } from '~/app/components/misc/edit-link.component';
import { ContextMenu } from 'primeng/contextmenu';
import { DialogService } from 'primeng/dynamicdialog';
import { SelectButtonChangeEvent } from 'primeng/selectbutton';
import { DomainLinkComponent } from './domain-link.component';

type DisplayBy = 'all-links' | 'by-domain';

export interface ModifiedLink extends Omit<Link, 'id'> {
  id?: string;
  link_ids?: string[];
  domains?: string[];
}

export interface LinkResponse {
  groupedByDomain?: Record<string, ModifiedLink[]>;
  linksWithDomains?: ModifiedLink[];
}

type CustomSections = Record<string, Record<string, Omit<Link, 'id'>[]>>;

@Component({
  standalone: true,
  selector: 'app-assets-links-page',
  imports: [CommonModule, RouterModule, PrimeNgModule, DomainLinkComponent],
  templateUrl: './index.page.html',
  providers: [DialogService],
  // styleUrl: './tags.scss'
})
export default class LinksIndexPageComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private messageService = inject(MessageService);
  private errorHandlerService = inject(ErrorHandlerService);
  private confirmationService = inject(ConfirmationService);
  private dialogService = inject(DialogService);

  links: LinkResponse | null = null;
  loading = true;
  showAutoLinks = false;
  fetchedExtraLinks = false;
  customSections: CustomSections = {};
  domains: DbDomain[] = [];

  displayBy: DisplayBy = 'all-links';
  displayByOptions: { label: string; value: DisplayBy }[] = [
    { label: 'All Links', value: 'all-links' },
    { label: 'By Domain', value: 'by-domain' },
  ];

  // For the right-click context menu
  @ViewChild('menu') menu: ContextMenu | undefined;
  selectedLink: ModifiedLink | null = null;
  public contextMenuItems: MenuItem[] = [];

  ngOnInit() {
    this.loadLinks();

    this.contextMenuItems = [
      { label: 'Open Link', icon: 'pi pi-external-link', command: () => this.openLink() },
      { label: 'Edit Link', icon: 'pi pi-pencil', command: () => this.showEditLink() },
      {
        label: 'Linked Domains',
        icon: 'pi pi-check-square',
        command: () => this.showEditLink(),
      },
      { label: 'Delete Link', icon: 'pi pi-trash', command: () => this.confirmDelete() },
      { label: 'Add New Link', icon: 'pi pi-plus', command: () => this.addNewLink() },
    ];
  }

  onDisplayByChange(changeTo: SelectButtonChangeEvent) {
    if (changeTo?.value === 'by-domain' && !this.fetchedExtraLinks) {
      this.loadDomainData();
    }
  }

  onShowAutoLinksChange(changedTo: boolean) {
    if (changedTo && !this.fetchedExtraLinks) {
      this.autoLinksFromDomainData(this.domains);
      this.fetchedExtraLinks = true;
    }
  }

  openLink() {
    if (this.selectedLink) {
      window.open(this.selectedLink.link_url, '_blank');
    }
  }

  showEditLink() {
    this.openLinkDialog(this.selectedLink);
  }

  addNewLink() {
    this.openLinkDialog(null);
  }

  objKeys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj);
  }

  deleteLink(): void {
    if (!this.selectedLink) return;
    const linkIds = this.selectedLink.id || this.selectedLink.link_ids;
    if (!linkIds) return;
    this.databaseService.instance.linkQueries.deleteLinks(linkIds).subscribe({
      next: () => {
        this.loadLinks(); // Refresh the list after deletion
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Link deleted successfully!',
        });
      },
      error: (error) => {
        this.errorHandlerService.handleError({
          error,
          message: 'Failed to delete the link.',
          showToast: true,
          location: 'LinksIndexPageComponent.deleteLink',
        });
      },
    });
  }

  loadLinks() {
    this.loading = true;
    this.databaseService.instance.linkQueries.getAllLinks().subscribe({
      next: (links) => {
        this.links = links;
      },
      error: (error) => {
        this.errorHandlerService.handleError({
          error,
          message: 'Failed to load links',
          showToast: true,
          location: 'Assets.Links.Index',
        });
        this.loading = false;
      },
    });
  }

  async loadDomainData() {
    this.loading = true;

    this.databaseService.instance.listDomains().subscribe({
      next: (domains) => {
        this.domains = domains;
        this.loading = false;
      },
      error: (error) => {
        this.errorHandlerService.handleError({
          error,
          message: 'Failed to load domain data.',
          showToast: true,
          location: 'LinksIndexPageComponent.loadDomainData',
        });
      },
    });
  }

  async autoLinksFromDomainData(domains: DbDomain[]) {
    if (!this.links) this.links = {};
    if (!this.links.groupedByDomain) this.links.groupedByDomain = {};
    const groupedByDomain = this.links.groupedByDomain;

    for (const eachDomain of domains) {
      if (!groupedByDomain[eachDomain.domain_name]) {
        groupedByDomain[eachDomain.domain_name] = [];
      }

      // Create object for domain, ready to add additional sections
      this.customSections[eachDomain.domain_name] = {};

      // Subdomains
      if (eachDomain.sub_domains && eachDomain.sub_domains.length) {
        this.customSections[eachDomain.domain_name]['subdomains'] =
          eachDomain.sub_domains.map((sd: { name: string }) => ({
            link_name: sd.name,
            link_url: `https://${sd.name}.${eachDomain.domain_name}`,
            link_description: `${sd.name}.${eachDomain.domain_name}`,
          })) || [];
      }

      // Providers
      const cleanName = (name: string) =>
        name.replace(/,|Inc|[^a-zA-Z0-9\s-]/g, '').trim();
      const providers: { type: string; name: string }[] = [];
      if (eachDomain.host?.isp)
        providers.push({ type: 'Host', name: eachDomain.host.isp });
      if (eachDomain.registrar?.name)
        providers.push({ type: 'Registrar', name: eachDomain.registrar.name });
      if (eachDomain.ssl?.issuer)
        providers.push({ type: 'SSL Issuer', name: eachDomain.ssl.issuer });

      const providerNames = providers.map((provider) => cleanName(provider.name));

      if (providerNames.length) {
        try {
          const providerLinks = await this.fetchProviders(providerNames);
          if (providerLinks.length) {
            this.customSections[eachDomain.domain_name]['providers'] = providerLinks
              .filter((provider: { link: string }) => provider.link)
              .map((provider: { name: string; link: string }) => ({
                link_name: provider.name,
                link_url: provider.link,
                link_description:
                  providers.find((p) => cleanName(p.name) === cleanName(provider.name))
                    ?.type || '',
              }));
          }
        } catch (error) {
          this.errorHandlerService.handleError({
            error,
            message: `Failed to fetch providers for ${eachDomain.domain_name}`,
            showToast: false,
            location: 'Links',
          });
        }
      }

      // Homepage
      this.customSections[eachDomain.domain_name]['homepage'] = [
        {
          link_name: 'Homepage',
          link_url: `https://${eachDomain.domain_name}`,
          link_description: eachDomain.domain_name,
        },
      ];

      // Public IPs
      if (eachDomain.ip_addresses && eachDomain.ip_addresses.length) {
        this.customSections[eachDomain.domain_name]['public_ips'] =
          eachDomain.ip_addresses.map(
            (ip: { is_ipv6: boolean; ip_address: string }, ipIndex: number) => ({
              link_name: `${ip.is_ipv6 ? 'IPv6' : 'IPv4'} Address ${ipIndex + 1}`,
              link_url: `https://${ip.ip_address}`,
              link_description: ip.ip_address,
            }),
          ) || [];
      }
    }
  }

  async fetchProviders(
    providerNames: string[],
  ): Promise<{ name: string; link: string }[]> {
    const response = await fetch(
      `https://find-company-domain.as93.workers.dev/?names=${providerNames.join(',')}`,
    );
    if (!response.ok) throw new Error('Failed to fetch provider links.');
    return await response.json();
  }

  onRightClick(event: MouseEvent, link: ModifiedLink) {
    this.selectedLink = link;
    if (this.menu) {
      this.menu.show(event);
    }
    event.preventDefault();
  }

  openLinkDialog(link: ModifiedLink | null = null): void {
    const ref = this.dialogService.open(LinkDialogComponent, {
      header: link ? 'Edit Link' : 'Add New Link',
      data: { link, isEdit: !!link },
      width: '50%',
      height: '36rem',
    });

    ref.onClose.subscribe((result: ModifiedLink | null) => {
      if (result) {
        if (link && link.id) {
          // Handle edit logic
          this.updateLink(link.id, result);
        } else {
          // Handle add logic
          this.addLink(result);
        }
      }
    });
  }

  confirmDelete(): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the link "${this.selectedLink?.link_name}"?`,
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.deleteLink();
      },
      reject: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Cancelled',
          detail: 'Deletion cancelled',
        });
      },
    });
  }

  private updateLink(linkId: string, linkData: ModifiedLink): void {
    this.databaseService.instance.linkQueries.updateLinkInDomains(linkData).subscribe({
      next: () => {
        this.loadLinks(); // Reload the links to reflect the updates
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Link updated successfully!',
        });
      },
      error: (error) => {
        this.errorHandlerService.handleError({
          error,
          message: 'Failed to update the link.',
          showToast: true,
          location: 'LinksIndexPageComponent.updateLink',
        });
      },
    });
  }

  private addLink(linkData: ModifiedLink): void {
    this.databaseService.instance.linkQueries.addLinkToDomains(linkData).subscribe({
      next: () => {
        this.loadLinks(); // Reload the links to reflect the addition
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Link added successfully!',
        });
      },
      error: (error) => {
        this.errorHandlerService.handleError({
          error,
          message: 'Failed to add the link.',
          showToast: true,
          location: 'LinksIndexPageComponent.addLink',
        });
      },
    });
  }
}

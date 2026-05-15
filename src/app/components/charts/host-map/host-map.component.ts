import {
  Component,
  OnInit,
  AfterViewInit,
  PLATFORM_ID,
  ViewEncapsulation,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import DatabaseService from '~/app/services/database.service';
import { Host } from '~/app/../types/Database';
import { ThemeService } from '~/app/services/theme.service';
import { Subscription } from 'rxjs';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { TranslateModule } from '@ngx-translate/core';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  selector: 'app-host-map',
  standalone: true,
  imports: [PrimeNgModule, TranslateModule],
  templateUrl: './host-map.component.html',
  styleUrl: './host-map.component.scss',
  encapsulation: ViewEncapsulation.None, // So I can load Leaflet styles
})
export class HostMapComponent implements OnInit, AfterViewInit {
  private databaseService = inject(DatabaseService);
  private platformId = inject<object>(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private errorHandler = inject(ErrorHandlerService);

  private map!: import('leaflet').Map;
  private hosts: (Host & { domainCount: number })[] = [];
  private L!: typeof import('leaflet');
  private isDarkTheme = false;
  private subscriptions: Subscription = new Subscription();

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadHosts();
    }
    this.subscriptions.add(
      this.themeService.isDarkTheme$.subscribe((isDark) => {
        this.isDarkTheme = isDark;
        this.cdr.detectChanges();
        this.setTheme();
      }),
    );
  }

  async ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.loadLeaflet();
      this.initMap();
      if (this.hosts.length > 0) {
        this.addMarkers();
      }
    }
  }

  private loadHosts() {
    this.databaseService.instance.hostsQueries.getHostsWithDomainCounts().subscribe(
      (hosts) => {
        this.hosts = hosts.map((host) => ({
          ...host,
          domainCount: host.domain_count,
        }));
        if (this.map) {
          this.addMarkers();
        }
      },
      (error) => {
        this.errorHandler.handleError({
          error,
          message: 'Failed to load hosts',
          location: 'HostMapComponent.loadHosts',
          showToast: true,
        });
      },
    );
  }

  private async loadLeaflet() {
    const L = await import('leaflet');
    this.L = L;
  }

  private setTheme() {
    if (!this.L) return;
    const darkThemeUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
    const lightThemeUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
    const layerToLoad = this.isDarkTheme ? darkThemeUrl : lightThemeUrl;
    const tileLayer = this.L.tileLayer(layerToLoad);
    tileLayer.addTo(this.map);
  }

  private initMap() {
    if (!this.L) return;
    this.map = this.L.map('map').setView([0, 0], 2);
    this.setTheme();
    setTimeout(() => {
      this.map.invalidateSize();
    }, 300);
  }

  private addMarkers() {
    if (!this.L || !this.map) return;
    this.hosts.forEach((host) => {
      if (host.lat && host.lon) {
        // Make marker
        const marker = this.L.marker([host.lat, host.lon], {
          icon: this.getCustomIcon(),
        });
        // Make marker popup
        marker.bindPopup(`
          <b>${host.isp}</b><br>
          ${host.org !== host.isp ? ' <i class="opacity-60">' + host.org + '</i><br>' : ''}
          Domains: ${host.domain_count} (<a href="/assets/hosts/${host.isp}">View</a>)<br>
          Location: ${host.city}, ${host.country}
        `);
        // Add marker to map
        marker.addTo(this.map);
      }
    });

    // Adjust the map bounds to fit all markers
    const markerBounds: [number, number][] = this.hosts.map((host) => [
      host.lat,
      host.lon,
    ]);
    if (markerBounds.length > 0) {
      const bounds = this.L.latLngBounds(markerBounds);
      this.map.fitBounds(bounds, { padding: [10, 10] });
    }
  }

  private getCustomIcon() {
    const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
      <path
        stroke="var(--surface-50, black)"
        stroke-width="10" 
        fill="var(--primary-color)"
        d="M0 192c0 87.4 117 243 168.3 307.2c6.1 7.7 14.9 11.5 23.7 11.5s17.6-3.8 23.7-11.5C267 435
        384 279.4 384 192C384 86 298 0 192 0S0 86 0 192zm272 0a80 80 0 1 1 -160 0 80 80 0 1 1 160 0z"
      />
      <path
        fill="var(--primary-900)"
        opacity=".9"
        d="M192 144a48 48 0 1 0 0 96 48 48 0 1 0 0-96z"
      />
    </svg>
    `;

    const customIcon = this.L.divIcon({
      html: svgIcon,
      className: 'custom-marker-icon',
      iconSize: [24, 30],
      iconAnchor: [15, 40],
      popupAnchor: [0, -30],
    });
    return customIcon;
  }
}

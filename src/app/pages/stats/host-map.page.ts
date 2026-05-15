import { Component } from '@angular/core';
import { HostMapComponent } from '~/app/components/charts/host-map/host-map.component';

@Component({
  standalone: true,
  selector: 'app-stats-host-map-page',
  template: '<h1>Host Map</h1><app-host-map />',
  imports: [HostMapComponent],
  styles: ['::ng-deep #map { height: 600px !important; z-index: 1; } '],
})
export default class HostMapPage {}

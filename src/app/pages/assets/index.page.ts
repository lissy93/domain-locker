import { Component } from '@angular/core';
import AssetListComponent from '~/app/components/misc/asset-list.component';

@Component({
  standalone: true,
  selector: 'app-assets-page',
  template: ` <app-asset-list></app-asset-list> `,
  imports: [AssetListComponent],
})
export default class AssetsIndexPageComponent {}

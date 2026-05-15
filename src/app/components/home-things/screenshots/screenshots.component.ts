import {
  Component,
  ChangeDetectorRef,
  ViewChild,
  OnInit,
  OnDestroy,
  Input,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { GalleriaModule, Galleria } from 'primeng/galleria';
import { ButtonModule } from 'primeng/button';

export interface Screenshot {
  screenshot: string; // The URL to the screenshot
  title: string; // Short title
  description: string; // Longer description
}

@Component({
  selector: 'app-screenshots',
  standalone: true,
  imports: [CommonModule, GalleriaModule, ButtonModule],
  templateUrl: './screenshots.component.html',
  styleUrls: ['./screenshots.component.scss'],
})
export class ScreenshotsComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private cd = inject(ChangeDetectorRef);

  /**
   * The array of screenshots to display.
   */
  @Input() screenshots: Screenshot[] = [];
  @Input() hideThumbnails = false;

  // Galleria references
  @ViewChild('galleria') galleria: Galleria | undefined;

  // State / config
  activeIndex = 1;
  showThumbnails = true;
  fullscreen = false;

  // used to store the event listener reference
  onFullScreenListener: (() => void) | null = null;

  // Some example responsive breakpoints if you wish:
  responsiveOptions = [
    {
      breakpoint: '1024px',
      numVisible: 5,
    },
    {
      breakpoint: '768px',
      numVisible: 3,
    },
    {
      breakpoint: '560px',
      numVisible: 1,
    },
  ];

  ngOnInit() {
    // Bind for listening to when the user toggles browser fullscreen
    this.bindDocumentListeners();
    this.showThumbnails = !this.hideThumbnails;
  }

  ngOnDestroy() {
    this.unbindDocumentListeners();
  }

  /**
   * Toggle thumbnail visibility
   */
  onThumbnailButtonClick() {
    this.showThumbnails = !this.showThumbnails;
  }

  /**
   * Fullscreen icon for toggling
   */
  fullScreenIcon() {
    return `pi ${this.fullscreen ? 'pi-window-minimize' : 'pi-window-maximize'}`;
  }

  /**
   * Dynamically set the Galleria container class
   */
  galleriaClass() {
    return `custom-galleria ${this.fullscreen ? 'fullscreen' : ''}`;
  }

  /**
   * Toggle in/out of fullscreen
   */
  toggleFullScreen() {
    if (this.fullscreen) {
      this.closePreviewFullScreen();
    } else {
      this.openPreviewFullScreen();
    }
    // Because entering/leaving fullscreen can happen asynchronously,
    // we detach/reattach to avoid "changed after checked" errors.
    this.cd.detach();
  }

  openPreviewFullScreen() {
    const elem = this.galleria?.element.nativeElement.querySelector('.p-galleria');
    if (!elem) {
      return;
    }

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem['mozRequestFullScreen']) {
      /* Firefox */
      elem['mozRequestFullScreen']();
    } else if (elem['webkitRequestFullscreen']) {
      /* Chrome, Safari & Opera */
      elem['webkitRequestFullscreen']();
    } else if (elem['msRequestFullscreen']) {
      /* IE/Edge */
      elem['msRequestFullscreen']();
    }
  }

  closePreviewFullScreen() {
    const doc = document as Document & {
      mozCancelFullScreen?: () => void;
      webkitExitFullscreen?: () => void;
      msExitFullscreen?: () => void;
    };
    if (doc.exitFullscreen) {
      doc.exitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }
  }

  onFullScreenChange() {
    // Flip the fullscreen flag
    this.fullscreen = !this.fullscreen;
    // Re-run change detection
    this.cd.detectChanges();
    this.cd.reattach();
  }

  bindDocumentListeners() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.onFullScreenListener = this.onFullScreenChange.bind(this);
    document.addEventListener('fullscreenchange', this.onFullScreenListener);
    document.addEventListener('mozfullscreenchange', this.onFullScreenListener);
    document.addEventListener('webkitfullscreenchange', this.onFullScreenListener);
    document.addEventListener('msfullscreenchange', this.onFullScreenListener);
  }

  unbindDocumentListeners() {
    if (!isPlatformBrowser(this.platformId) || !this.onFullScreenListener) {
      return;
    }
    document.removeEventListener('fullscreenchange', this.onFullScreenListener);
    document.removeEventListener('mozfullscreenchange', this.onFullScreenListener);
    document.removeEventListener('webkitfullscreenchange', this.onFullScreenListener);
    document.removeEventListener('msfullscreenchange', this.onFullScreenListener);
    this.onFullScreenListener = null;
  }
}

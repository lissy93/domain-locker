import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { ErrorHandlerService, ErrorLogEntry } from '~/app/services/error-handler.service';

interface BuildLogChoice {
  file: string;
  name: string;
  description: string;
}

@Component({
  standalone: true,
  selector: 'app-advanced-error-logs-page',
  imports: [CommonModule, PrimeNgModule],
  templateUrl: './error-logs.page.html',
  styles: [
    `
      :host ::ng-deep {
        .p-tabview-nav {
          gap: 0.5rem;
        }
      }
    `,
  ],
})
export default class ErrorLogs implements OnInit {
  private errorHandler = inject(ErrorHandlerService);

  public errorLog: ErrorLogEntry[] = [];

  public actionsList: BuildLogChoice[] = [];
  public currentAction: BuildLogChoice | null = null;
  public currentLogs = '';

  ngOnInit(): void {
    this.errorLog = this.errorHandler.getRecentErrorLog();
    this.actionsList = [
      {
        file: 'docker.yml',
        name: '🐳 Build & Push Docker Image',
        description:
          'Tests, compiles and publishes the cross-platform Docker image to registries.',
      },
      {
        file: 'tag.yml',
        name: '🏷️ Tag new versions',
        description:
          "Create and push a new Git tag when the app's semantic version is updated.",
      },
      {
        file: 'release.yml',
        name: '🥏 Create GitHub Release',
        description:
          'Builds the app and creates a new GitHub release with the compiled files.',
      },
      {
        file: 'mirror.yml',
        name: '🪞 Mirror to Codeberg',
        description:
          "Mirrors the repository and it's contents to Codeberg, to provide a backup and alternative access.",
      },
    ];
  }

  public fetchBuildLogs(action: BuildLogChoice): void {
    this.currentAction = action;
    this.currentLogs = 'Loading...';
    fetch(
      `https://ghlogs.as93.workers.dev/?owner=lissy93&repo=domain-locker&workflow=${action.file}`,
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch logs: ${res.statusText}`);
        }
        this.currentLogs = await res.text();
      })
      .catch((err) => {
        this.currentLogs = `Error fetching logs: ${err.message}`;
      });
  }
}

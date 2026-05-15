import { Component, OnInit, Input, inject } from '@angular/core';

import { SupabaseService } from '~/app/services/supabase.service';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

interface UserThingys {
  user_metadata?: { avatar_url?: string; name?: string };
  email?: string;
  id?: string;
  identities?: { provider?: string; identity_data?: { avatar_url?: string } }[];
}

@Component({
  selector: 'app-profile-picture',
  standalone: true,
  imports: [],
  template: `
    <div class="profile-picture" [style.width.px]="size" [style.height.px]="size">
      @if (!loading) {
        <img
          [src]="profileImageUrl"
          [alt]="'User profile picture'"
          [style.width.px]="size"
          [style.height.px]="size"
          class="rounded-full border"
        />
      } @else {
        <div
          class="loading-placeholder rounded-full border"
          [style.width.px]="size"
          [style.height.px]="size"
        ></div>
      }
    </div>
  `,
  styles: [
    `
      .profile-picture {
        display: inline-block;
        position: relative;
        img {
          object-fit: cover;
        }
        .loading-placeholder {
          background-color: var(--primary-color);
          animation: pulse 1.5s infinite;
        }
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
    `,
  ],
})
export class ProfilePictureComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private errorHandler = inject(ErrorHandlerService);

  @Input() size = 64; // Default size in pixels
  profileImageUrl = '';
  loading = true;

  async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async ngOnInit(): Promise<void> {
    try {
      const sessionData = await this.supabaseService.getSessionData();
      const user: UserThingys =
        (sessionData as { session?: { user?: UserThingys } })?.session?.user ||
        ({} as UserThingys);
      const { user_metadata, email, identities } = user;

      if (user_metadata?.avatar_url) {
        // Use the avatar URL if available
        this.profileImageUrl = user_metadata.avatar_url;
      } else if (identities?.some((identity) => identity.provider === 'github')) {
        // Check GitHub identity for avatar URL
        const githubIdentity = identities.find(
          (identity) => identity.provider === 'github',
        );
        const githubAvatarUrl = githubIdentity?.identity_data?.avatar_url;
        if (githubAvatarUrl) {
          this.profileImageUrl = githubAvatarUrl;
        } else {
          this.profileImageUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
            user_metadata?.name || 'GitHub User',
          )}&rotate=30&radius=5`;
        }
      } else if (user_metadata?.name) {
        // Use initials if the user has a name
        this.profileImageUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
          user_metadata.name,
        )}&rotate=30&radius=5`;
      } else if (email) {
        // Use identicon based on hashed email if no avatar or name
        const emailHash = await this.hashString(email);
        this.profileImageUrl = `https://api.dicebear.com/9.x/identicon/svg?seed=${emailHash}`;
      } else {
        // Fallback to glass icon with a unique identifier
        this.profileImageUrl = `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
          user?.id || 'unknown',
        )}&scale=60`;
      }
    } catch (error) {
      this.errorHandler.handleError({
        message: 'Failed to fetch profile image',
        error,
        location: 'ProfilePictureComponent.ngOnInit',
      });
    } finally {
      this.loading = false;
    }
  }
}

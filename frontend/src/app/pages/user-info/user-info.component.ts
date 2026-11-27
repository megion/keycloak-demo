import { Component, inject, signal } from '@angular/core';
import { UserInfoService, UserInfo } from './user-info.service';

/**
 * User information page shown after a successful login.
 * Data comes from GET /api/user-info (backend REST, Keycloak-protected).
 */
@Component({
  selector: 'app-user-info',
  templateUrl: './user-info.component.html',
})
export class UserInfoComponent {
  private readonly service = inject(UserInfoService);

  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly info = signal<UserInfo | null>(null);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  /** Fetches the profile of the logged-in user from the backend REST API. */
  async load(): Promise<void> {
    this.state.set('loading');
    try {
      const data = await this.service.getUserInfo();
      this.info.set(data);
      this.state.set('ready');
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error
          ? err.message
          : 'The backend REST API is not reachable (http://localhost:3000/api).',
      );
      this.state.set('error');
    }
  }

  initials(info: UserInfo): string {
    const name = info.fullName;
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  formatDate(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString() : '—';
  }

  formatAuthTime(epochSeconds: number | null): string {
    return epochSeconds ? new Date(epochSeconds * 1000).toLocaleString() : '—';
  }

  realmName(info: UserInfo): string {
    const match = info.accountUrl.match(/realms\/([^/]+)\/user/);
    return match ? match[1] : 'myapp';
  }
}

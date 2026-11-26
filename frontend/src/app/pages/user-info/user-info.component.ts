import { Component, inject, signal } from '@angular/core';
import { UserInfoService, UserInfo } from './user-info.service';

/**
 * User information page shown after a successful login.
 * Data comes from GET /api/user-info (backend REST, Keycloak-protected).
 */
@Component({
  selector: 'app-user-info',
  template: `
    @if (state() === 'loading') {
      <p class="user-info-loading">Loading your profile…</p>
    } @else if (state() === 'error') {
      <section class="user-info-error" role="alert">
        <h1>Could not load your user information</h1>
        <p>{{ errorMessage() }}</p>
        <button (click)="load()">Retry</button>
      </section>
    } @else if (info(); as info) {
      <section class="user-info-page">
        <div class="profile-card">
          <div class="avatar">{{ initials(info) }}</div>
          <div class="profile-fields">
            <h1>{{ info.fullName }}</h1>
            <dl>
              <dt>Username</dt>
              <dd>{{ info.username }}</dd>
              <dt>Email</dt>
              <dd>
                {{ info.email }}
                @if (info.emailVerified) { <span class="badge verified">verified</span> }
                @else { <span class="badge unverified">not verified</span> }
              </dd>
              <dt>Department</dt>
              <dd>{{ info.attributes['department']?.[0] ?? '—' }}</dd>
              <dt>Locale</dt>
              <dd>{{ info.locale ?? '—' }}</dd>
              <dt>Member since</dt>
              <dd>{{ formatDate(info.createdAt) }}</dd>
              <dt>Last login</dt>
              <dd>{{ formatDate(info.lastLogin) }}</dd>
              <dt>Session started</dt>
              <dd>{{ formatAuthTime(info.authTime) }}</dd>
            </dl>
          </div>
        </div>

        <div class="roles-card">
          <h2>Roles</h2>
          @for (role of info.roles; track role) {
            <span class="badge role">{{ role }}</span>
          }
          <h2>Groups</h2>
          @for (group of info.groups; track group.id) {
            <span class="badge group">{{ group.name }}</span>
          }
        </div>

        <div class="identity-card">
          <h2>Identity provider</h2>
          <p>Keycloak realm <code>{{ realmName(info) }}</code>, subject <code>{{ info.sub }}</code></p>
          <p>Token audience: <code>{{ info.audience.join(', ') }}</code></p>
        </div>
      </section>
    }
  `
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
        err instanceof Error ? err.message : 'The backend REST API is not reachable (http://localhost:3000/api).'
      );
      this.state.set('error');
    }
  }

  initials(info: UserInfo): string {
    const name = info.fullName;
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
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

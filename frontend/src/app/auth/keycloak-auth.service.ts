import { Injectable, computed, signal } from '@angular/core';
import Keycloak from 'keycloak-js';
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_REALM, KEYCLOAK_URL } from '../config';

/**
 * Keycloak authentication for the SPA (OAuth2 authorization code + PKCE,
 * public client). Tokens are kept by keycloak-js; refresh tokens are stored
 * in Keycloak's session via cookie-based SSO.
 */
@Injectable({ providedIn: 'root' })
export class KeycloakAuthService {
  private readonly keycloak = new Keycloak({
    url: KEYCLOAK_URL,
    realm: KEYCLOAK_REALM,
    clientId: KEYCLOAK_CLIENT_ID,
  });

  /** True when a valid session exists. */
  readonly authenticated = signal(false);
  /** Current access token (refreshed via keycloak.update on demand). */
  readonly accessToken = signal<string | null>(null);
  /** Decoded claims of the access token (JWT payload). */
  readonly claims = computed(() =>
    this.accessToken() ? this.decodeJwt(this.accessToken()!) : null,
  );

  /** Restores an existing Keycloak session before Angular evaluates the route guards. */
  async init(): Promise<boolean> {
    this.keycloak.onAuthLogout = () => {
      this.authenticated.set(false);
      this.accessToken.set(null);
    };
    this.keycloak.onAuthRefreshSuccess = () => {
      this.authenticated.set(true);
      this.accessToken.set(this.keycloak.token ?? null);
    };
    this.keycloak.onAuthRefreshError = () => {
      this.authenticated.set(false);
      this.accessToken.set(null);
    };
    const authenticated = await this.keycloak.init({
      onLoad: 'check-sso',
      redirectUri: `${window.location.origin}/`,
      checkLoginIframe: false,
    });
    this.authenticated.set(authenticated);
    this.accessToken.set(this.keycloak.token ?? null);
    return authenticated;
  }

  /** Redirects the browser to the Keycloak login form. */
  login(): void {
    this.keycloak.login();
  }

  /** Ends the Keycloak session and returns to the login page. */
  logout(): void {
    this.keycloak.logout();
  }

  /**
   * Ensures a fresh access token (refreshes when near expiry) and returns it.
   * Throws when no session exists.
   */
  async ensureValidToken(): Promise<string> {
    if (!this.keycloak.authenticated) {
      throw new Error('No Keycloak session');
    }
    const refreshed = await this.keycloak.updateToken(30);
    if (refreshed) {
      console.log('Token is updated success');
    } else {
      console.log('The token is still valid; no renewal was required.');
    }
    this.authenticated.set(this.keycloak.authenticated);
    const token = this.keycloak.token;
    if (!token) {
      throw new Error('No access token');
    }
    this.accessToken.set(token);
    return token;
  }

  /** Decodes the payload of a compact JWT (base64url). */
  private decodeJwt(token: string): Record<string, unknown> {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  }
}

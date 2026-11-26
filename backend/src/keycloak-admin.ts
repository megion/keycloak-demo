import { config } from './config';
import { notFound, upstreamError } from './errors';

/**
 * Minimal representations of the Keycloak Admin REST API resources
 * (https://www.keycloak.org/docs/latest/server_admin/).
 */
export interface KeycloakUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  enabled?: boolean;
  createdTimestamp?: number;
  lastLogin?: number;
  attributes?: Record<string, string[]>;
  realmRoles?: string[];
  clientRoles?: Record<string, string[]>;
}

export interface KeycloakGroup {
  id: string;
  name: string;
  path: string;
  realmRoles?: string[];
  attributes?: Record<string, string[]>;
}

export interface UserInfo {
  sub: string;
  username: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  emailVerified: boolean;
  roles: string[];
  groups: Array<{ id: string; name: string }>;
  attributes: Record<string, string[]>;
  createdAt: string | null;
  lastLogin: string | null;
  authTime: number | null;
  locale: string | null;
  audience: string[];
  keycloakUrl: string;
  accountUrl: string;
}

/** Cache of the backend service-account token (client_credentials grant). */
let serviceAccountToken: { value: string; expiresAt: number } | null = null;

/** Fetches (and caches) the backend's own service-account access token. */
export async function getServiceAccountToken(): Promise<string> {
  if (serviceAccountToken && Date.now() < serviceAccountToken.expiresAt - 10_000) {
    return serviceAccountToken.value;
  }
  // Keycloak 26 no longer serves the /realms/{realm}/token shorthand, so the
  // full openid-connect token endpoint is used.
  const response = await fetch(`${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.backendClientId,
      client_secret: config.backendClientSecret
    })
  });
  if (!response.ok) {
    throw upstreamError(`Keycloak rejected the service-account token request: HTTP ${response.status}`);
  }
  const json = await response.json();
  serviceAccountToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return serviceAccountToken.value;
}

/** GET /admin/realms/{realm}/users/{id} – the full profile of a user. */
export async function fetchUserProfile(userId: string): Promise<KeycloakUser> {
  const token = await getServiceAccountToken();
  const response = await fetch(`${config.keycloakUrl}/admin/realms/${config.realm}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 404) {
    throw notFound(`User "${userId}" not found in realm "${config.realm}"`);
  }
  if (!response.ok) {
    throw upstreamError(`Keycloak Admin API responded with HTTP ${response.status}`);
  }
  return response.json();
}

/** GET /admin/realms/{realm}/groups – all groups of the realm. */
export async function listGroups(): Promise<KeycloakGroup[]> {
  const token = await getServiceAccountToken();
  const response = await fetch(`${config.keycloakUrl}/admin/realms/${config.realm}/groups`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw upstreamError(`Keycloak Admin API responded with HTTP ${response.status}`);
  }
  return response.json();
}

/** Converts epoch milliseconds into an ISO timestamp, null when absent. */
export function isoTimestamp(epochMillis: number | undefined): string | null {
  return epochMillis ? new Date(epochMillis).toISOString() : null;
}

/** Builds the response of GET /api/user-info from JWT claims + Keycloak profile. */
export function buildUserInfo(
  claims: Record<string, unknown>,
  profile: KeycloakUser,
  groups: KeycloakGroup[]
): UserInfo {
  return {
    sub: profile.id,
    username: profile.username,
    fullName: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.username,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    email: profile.email ?? null,
    emailVerified: Boolean(profile.emailVerified),
    roles: (claims.realmRoles as string[] | undefined) ?? profile.realmRoles ?? [],
    groups: groups.map((group) => ({ id: group.id, name: group.name })),
    attributes: profile.attributes ?? {},
    createdAt: isoTimestamp(profile.createdTimestamp),
    lastLogin: isoTimestamp(profile.lastLogin),
    authTime: typeof claims.auth_time === 'number' ? claims.auth_time : null,
    locale: typeof claims.locale === 'string' ? claims.locale : null,
    audience: (claims.aud as string[] | undefined) ?? [],
    keycloakUrl: config.keycloakUrl,
    accountUrl: `${config.keycloakUrl}/realms/${config.realm}/user/${profile.id}`
  };
}

/** Response shape of GET /api/users/:id (Keycloak Admin API profile only). */
export function toUserProfile(profile: KeycloakUser) {
  return {
    id: profile.id,
    username: profile.username,
    fullName: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || profile.username,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    email: profile.email ?? null,
    emailVerified: Boolean(profile.emailVerified),
    enabled: Boolean(profile.enabled),
    roles: profile.realmRoles ?? [],
    attributes: profile.attributes ?? {},
    createdAt: isoTimestamp(profile.createdTimestamp),
    lastLogin: isoTimestamp(profile.lastLogin)
  };
}

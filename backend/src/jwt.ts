import {
  jwtVerify,
  createRemoteJWKSet,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { config } from './config';
import { forbidden, upstreamError } from './errors';

export interface OpenIdConfig {
  /** Issuer URL of the realm, e.g. http://localhost:8080/realms/myapp */
  issuer: string;
  /** URL of the realm's JWKS endpoint. */
  jwksUri: string;
}

/** Cache of the OpenID discovery document (it changes only on Keycloak restart). */
let openIdCache: OpenIdConfig | null = null;

/** Loads (and caches) Keycloak's OpenID discovery document for the configured realm. */
export async function loadOpenIdConfig(): Promise<OpenIdConfig> {
  if (openIdCache) {
    return openIdCache;
  }
  const response = await fetch(
    `${config.keycloakUrl}/realms/${config.realm}/.well-known/openid-configuration`,
  );
  if (!response.ok) {
    throw upstreamError(
      `OpenID discovery request failed with HTTP ${response.status}`,
    );
  }
  const json = await response.json();
  openIdCache = { issuer: json.issuer, jwksUri: json.jwks_uri };
  return openIdCache;
}

/** Warms the discovery document at startup so the first request is fast. */
export async function warmUpOpenIdConfig(): Promise<void> {
  await loadOpenIdConfig();
}

/** Remote JWKS getters are created once per realm and refreshed on demand by jose. */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getJwks(
  jwksUri: string,
): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksCache.get(jwksUri);
  if (cached) {
    return cached;
  }
  const remote = createRemoteJWKSet(new URL(jwksUri));
  jwksCache.set(jwksUri, remote);
  return remote;
}

/**
 * Verifies the signature and claims of a JWT against a key getter.
 * Split out from verifyAccessToken so unit tests can run against a local key set.
 * @throws ApiError 403 when the token is invalid, expired, signed by another
 *         issuer, or not issued for the expected audience.
 */
export async function verifyClaims(
  rawToken: string,
  jwkGetter: JWTVerifyGetKey,
  options: { issuer: string; audience: string[] },
): Promise<JWTPayload> {
  try {
    // Keycloak writes aud: ["myapp-backend"] when the user holds the
    // myapp-backend-audience realm role; jose requires it to be present.
    const result = await jwtVerify(rawToken, jwkGetter, {
      issuer: options.issuer,
      audience: options.audience,
    });
    return result.payload;
  } catch {
    throw forbidden('JWT signature, issuer or audience validation failed');
  }
}

/**
 * Verifies a Keycloak access token (RS256 signature, issuer, expiry, audience)
 * and returns its claims.
 * @param rawToken the compact JWS from the Authorization header
 */
export async function verifyAccessToken(rawToken: string): Promise<JWTPayload> {
  const { issuer, jwksUri } = await loadOpenIdConfig();
  return verifyClaims(rawToken, getJwks(jwksUri), {
    issuer,
    audience: [config.backendClientId],
  });
}

/** Extracts realm roles from the realmRoles claim (missing claim means no roles). */
export function extractRealmRoles(claims: JWTPayload): string[] {
  const roles = claims.realmRoles;
  return Array.isArray(roles) ? roles.map(String) : [];
}

/** Returns true when the token carries the given realm role. */
export function hasRealmRole(claims: JWTPayload, role: string): boolean {
  return extractRealmRoles(claims).includes(role);
}

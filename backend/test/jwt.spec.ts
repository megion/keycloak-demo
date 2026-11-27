import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, createLocalJWKSet, type JWK } from 'jose';
import { verifyClaims, extractRealmRoles, hasRealmRole } from '../src/jwt';

/** Generates an RSA key pair and a local JWKS containing the public key. */
function makeKeys(kid: string) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const publicJwk = publicKey.export({ format: 'jwk' }) as JWK;
  publicJwk.kid = kid;
  return {
    privateJwk: privateKey.export({ format: 'jwk' }) as JWK,
    jwks: createLocalJWKSet({ keys: [publicJwk] }),
  };
}

/** Signs an RS256 access token with the given claims. */
function signToken(
  privateJwk: JWK,
  claims: Record<string, unknown>,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'demo-key' })
    .setIssuedAt()
    .setExpirationTime('30s')
    .sign(privateJwk);
}

const ISSUER = 'http://localhost:8080/realms/myapp';
const AUDIENCE = 'myapp-backend';
const OPTIONS = { issuer: ISSUER, audience: [AUDIENCE] };

describe('verifyClaims', () => {
  const keys = makeKeys('demo-key');

  it('accepts a token with the expected issuer and audience', async () => {
    const token = await signToken(keys.privateJwk, {
      iss: ISSUER,
      aud: [AUDIENCE],
      sub: 'alice',
      azp: 'myapp-frontend',
      realmRoles: ['user', AUDIENCE],
      preferred_username: 'alice',
    });
    const claims = await verifyClaims(token, keys.jwks, OPTIONS);
    expect(claims.sub).toBe('alice');
    expect(extractRealmRoles(claims)).toEqual(['user', AUDIENCE]);
    expect(hasRealmRole(claims, 'user')).toBe(true);
    expect(hasRealmRole(claims, 'guest')).toBe(false);
  });

  it('rejects a token signed by a foreign key', async () => {
    const foreign = makeKeys('evil-key');
    const token = await signToken(foreign.privateJwk, {
      iss: ISSUER,
      aud: [AUDIENCE],
      sub: 'evil',
    });
    await expect(verifyClaims(token, keys.jwks, OPTIONS)).rejects.toMatchObject(
      { status: 403, code: 'forbidden' },
    );
  });

  it('rejects a token from a different issuer', async () => {
    const token = await signToken(keys.privateJwk, {
      iss: 'http://evil/realms/other',
      aud: [AUDIENCE],
      sub: 'evil',
    });
    await expect(verifyClaims(token, keys.jwks, OPTIONS)).rejects.toMatchObject(
      { status: 403, code: 'forbidden' },
    );
  });

  it('rejects a token missing the backend audience', async () => {
    const token = await signToken(keys.privateJwk, {
      iss: ISSUER,
      aud: ['some-other-client'],
      sub: 'alice',
    });
    await expect(verifyClaims(token, keys.jwks, OPTIONS)).rejects.toMatchObject(
      { status: 403, code: 'forbidden' },
    );
  });

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      iss: ISSUER,
      aud: [AUDIENCE],
      sub: 'alice',
      iat: now - 600,
      exp: now - 300,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'demo-key' })
      .sign(keys.privateJwk);
    await expect(verifyClaims(token, keys.jwks, OPTIONS)).rejects.toMatchObject(
      { status: 403, code: 'forbidden' },
    );
  });
});

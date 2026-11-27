import { expect, it, vi } from 'vitest';
import { KeycloakAuthService } from './keycloak-auth.service';

const keycloak = vi.hoisted(() => ({
  init: vi.fn<() => Promise<boolean>>(),
  authenticated: false,
  token: undefined as string | undefined,
}));

vi.mock('keycloak-js', () => ({
  /** Supplies the session state that the adapter sets during initialization. */
  default: function KeycloakStub() {
    return keycloak;
  },
}));

it('restores the Keycloak session before reporting the user as signed in', async () => {
  keycloak.init.mockImplementation(async () => {
    keycloak.authenticated = true;
    keycloak.token = 'access-token';
    return true;
  });
  const auth = new KeycloakAuthService();

  await expect(auth.init()).resolves.toBe(true);

  expect(keycloak.init).toHaveBeenCalledWith(
    expect.objectContaining({
      onLoad: 'check-sso',
      redirectUri: `${window.location.origin}/`,
    }),
  );
  expect(auth.authenticated()).toBe(true);
  expect(auth.accessToken()).toBe('access-token');
});

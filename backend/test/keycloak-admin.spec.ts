import { buildUserInfo } from '../src/keycloak-admin';

describe('buildUserInfo', () => {
  it.each([
    ['myapp-backend', ['myapp-backend']],
    [
      ['myapp-backend', 'account'],
      ['myapp-backend', 'account'],
    ],
    [undefined, []],
  ])('returns the token audience %j as an array', (aud, expected) => {
    const profile = { id: 'alice', username: 'alice' };

    expect(buildUserInfo({ aud }, profile, []).audience).toEqual(expected);
  });
});

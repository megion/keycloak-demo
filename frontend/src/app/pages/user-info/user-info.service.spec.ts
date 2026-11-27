import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { UserInfoService, UserInfo } from './user-info.service';
import { KeycloakAuthService } from '../../auth/keycloak-auth.service';

const DEMO_USER_INFO: UserInfo = {
  sub: 'alice',
  username: 'alice',
  fullName: 'Alice Anderson',
  firstName: 'Alice',
  lastName: 'Anderson',
  email: 'alice@example.com',
  emailVerified: true,
  roles: ['user', 'admin', 'myapp-backend-audience'],
  groups: [{ id: 'admins', name: 'MyApp administrators' }],
  attributes: { department: ['Finance'] },
  createdAt: '2026-11-26T10:00:00.000Z',
  lastLogin: null,
  authTime: 1764243600,
  locale: null,
  audience: ['myapp-backend'],
  keycloakUrl: 'http://localhost:8080',
  accountUrl: 'http://localhost:8080/realms/myapp/user/alice',
};

/** Stub Keycloak service: always authenticated, hands out a fake token. */
class FakeKeycloakAuthService {
  authenticated = () => true;
  ensureValidToken = async () => 'fake.jwt.token';
}

describe('UserInfoService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserInfoService,
        provideHttpClient(
          withFetch(),
          withInterceptors([
            (req, next) => {
              if (req.url === '/api/user-info') {
                return of(
                  new HttpResponse({ status: 200, body: DEMO_USER_INFO }),
                );
              }
              return next(req);
            },
          ]),
        ),
        {
          provide: KeycloakAuthService,
          useValue: new FakeKeycloakAuthService(),
        },
      ],
    });
  });

  it('fetches the logged-in user profile with the Keycloak access token', async () => {
    const service = TestBed.inject(UserInfoService);
    const info = await service.getUserInfo();
    expect(info.username).toBe('alice');
    expect(info.roles).toContain('user');
    expect(info.groups[0].name).toBe('MyApp administrators');
  });
});

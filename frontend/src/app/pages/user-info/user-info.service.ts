import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../config';
import { KeycloakAuthService } from '../../auth/keycloak-auth.service';

/** Shape returned by GET /api/user-info of the backend. */
export interface UserInfo {
  sub: string;
  username: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  emailVerified: boolean;
  roles: string[];
  groups: { id: string; name: string }[];
  attributes: Record<string, string[]>;
  createdAt: string | null;
  lastLogin: string | null;
  authTime: number | null;
  locale: string | null;
  audience: string[];
  keycloakUrl: string;
  accountUrl: string;
}

/**
 * Calls the backend REST API with the current Keycloak access token
 * (Authorization: Bearer …). The backend verifies the token and
 * assembles the profile from Keycloak.
 */
@Injectable({ providedIn: 'root' })
export class UserInfoService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(KeycloakAuthService);

  async getUserInfo(): Promise<UserInfo> {
    const token = await this.auth.ensureValidToken();
    return firstValueFrom(
      this.http.get<UserInfo>(`${API_BASE_URL}/user-info`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  /** Admin lookup of any realm user: GET /api/users/:id. */
  async getUserById(id: string): Promise<UserInfo> {
    const token = await this.auth.ensureValidToken();
    return firstValueFrom(
      this.http.get<UserInfo>(`${API_BASE_URL}/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }
}

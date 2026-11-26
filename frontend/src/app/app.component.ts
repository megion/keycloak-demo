import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KeycloakAuthService } from './auth/keycloak-auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <header class="app-header">
      <span class="logo">MyApp</span>
      @if (auth.authenticated()) {
        <span class="user-name">{{ auth.claims()?.['preferred_username'] }}</span>
        <button class="logout" (click)="auth.logout()">Sign out</button>
      }
    </header>
    <router-outlet />
  `
})
export class AppComponent {
  readonly auth = inject(KeycloakAuthService);
}

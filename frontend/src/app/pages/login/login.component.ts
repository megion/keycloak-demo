import { Component, inject } from '@angular/core';
import { KeycloakAuthService } from '../../auth/keycloak-auth.service';

/** Entry point for sign-in through Keycloak's hosted login form. */
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly auth = inject(KeycloakAuthService);
}

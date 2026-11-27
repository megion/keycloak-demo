import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KeycloakAuthService } from './auth/keycloak-auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly auth = inject(KeycloakAuthService);
}

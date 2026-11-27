import { Component, inject, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  FormRoot,
  minLength,
  required,
} from '@angular/forms/signals';
import { KeycloakAuthService } from '../../auth/keycloak-auth.service';

/** Shape of the login model: the credentials typed before Keycloak verifies them. */
interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login form of the SPA, built with signal forms. Credentials are validated by Keycloak itself
 * (OAuth2 authorization code flow with PKCE), so the app never touches passwords — pressing
 * "Sign in" sends the browser to the Keycloak login form, and a successful login returns the
 * user to the user-info page.
 */
@Component({
  selector: 'app-login',
  imports: [FormField, FormRoot],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(KeycloakAuthService);

  /** Model signal the form is built around; field updates write into it. */
  readonly credentials = signal<LoginCredentials>({ email: '', password: '' });

  /**
   * Signal form with the validation rules of the login screen:
   * a required, well-formed email and a password of at least 8 characters.
   * Submitting a valid form redirects to Keycloak's login page; submitting an invalid one
   * marks every field touched and reports the failure in `loginError`.
   */
  readonly loginForm = form(
    this.credentials,
    (credentials) => {
      required(credentials.email, { message: 'Email is required' });
      email(credentials.email);
      required(credentials.password);
      minLength(credentials.password, 8, {
        message: 'Password must be at least 8 characters',
      });
    },
    {
      submission: {
        // Credentials are collected here and verified by Keycloak's login form.
        action: async () => {
          this.loginError.set(null);
          this.auth.login();
          return null;
        },
        onInvalid: () =>
          this.loginError.set(
            'Fill in a valid email and a password of at least 8 characters.',
          ),
      },
    },
  );

  /** Message shown when the user submits a form that fails validation. */
  readonly loginError = signal<string | null>(null);
}

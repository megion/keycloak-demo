import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { KeycloakAuthService } from '../../auth/keycloak-auth.service';

/**
 * Login form of the SPA. Credentials are validated by Keycloak itself
 * (OAuth2 authorization code flow with PKCE), so the app never touches
 * passwords — pressing "Sign in" sends the browser to the Keycloak login form,
 * and a successful login returns the user to the user-info page.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <section class="login-page">
      <div class="login-card">
        <h1>Sign in to MyApp</h1>
        <form [formGroup]="loginForm" (ngSubmit)="submitLogin()">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" required>
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password" required>
          @if (loginError()) {
            <p class="form-error" role="alert">{{ loginError() }}</p>
          }
          <button type="submit">Sign in</button>
        </form>
        <p class="hint">
          MyApp uses Keycloak as its identity provider. After you press
          "Sign in", Keycloak verifies your credentials and returns you to
          the user information page.
        </p>
      </div>
    </section>
  `
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(KeycloakAuthService);

  readonly loginForm = this.formBuilder.nonTyped.group({
    email: [undefined, [Validators.required, Validators.email]],
    password: [undefined, [Validators.required, Validators.minLength(8)]]
  });

  readonly loginError = signal<string | null>(null);

  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError.set('Fill in a valid email and a password of at least 8 characters.');
      return;
    }
    // Credentials are collected here and verified by Keycloak's login form.
    this.auth.login();
  }
}

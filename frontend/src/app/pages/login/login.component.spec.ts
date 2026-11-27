import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { submit } from '@angular/forms/signals';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { KeycloakAuthService } from '../../auth/keycloak-auth.service';

/** Stub Keycloak service: counts login() calls, never touches keycloak-js. */
class FakeKeycloakAuthService {
  loginCalls = 0;
  login(): void {
    this.loginCalls++;
  }
}

describe('LoginComponent (signal form)', () => {
  let auth: FakeKeycloakAuthService;
  let login: LoginComponent;

  beforeEach(() => {
    auth = new FakeKeycloakAuthService();
    TestBed.configureTestingModule({
      providers: [
        LoginComponent,
        provideZonelessChangeDetection(),
        { provide: KeycloakAuthService, useValue: auth },
      ],
    });
    login = TestBed.inject(LoginComponent);
  });

  it('starts empty, untouched and invalid', () => {
    expect(login.credentials()).toEqual({ email: '', password: '' });
    expect(login.loginForm().valid()).toBe(false);
    expect(login.loginForm().touched()).toBe(false);
    expect(login.loginError()).toBeNull();
  });

  it('binds the template fields to the form and marks them required', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const formElement = fixture.nativeElement.querySelector('form');
    // FormRoot disables browser validation; the field rules set the native required attribute.
    expect(formElement.hasAttribute('novalidate')).toBe(true);
    const emailInput = fixture.nativeElement.querySelector('#email');
    const passwordInput = fixture.nativeElement.querySelector('#password');
    expect(emailInput.hasAttribute('required')).toBe(true);
    expect(passwordInput.hasAttribute('minlength')).toBe(true);
  });

  it('a valid form redirects to Keycloak and clears the error', async () => {
    login.loginForm.email().value.set('alice@example.com');
    login.loginForm.password().value.set('Alice123!');
    expect(login.loginForm().valid()).toBe(true);

    await expect(submit(login.loginForm)).resolves.toBe(true);
    expect(auth.loginCalls).toBe(1);
    expect(login.loginError()).toBeNull();
    // The model signal is the source of truth: the form writes the credentials into it.
    expect(login.credentials()).toEqual({
      email: 'alice@example.com',
      password: 'Alice123!',
    });
  });

  it('a short password fails validation, reports the error and does not sign in', async () => {
    login.loginForm.email().value.set('alice@example.com');
    login.loginForm.password().value.set('Alice12');

    await expect(submit(login.loginForm)).resolves.toBe(false);
    expect(auth.loginCalls).toBe(0);
    expect(login.loginError()).toBe(
      'Fill in a valid email and a password of at least 8 characters.',
    );
    expect(login.loginForm().touched()).toBe(true);
    expect(login.loginForm.password().getError('minLength')?.message).toBe(
      'Password must be at least 8 characters',
    );
  });

  it('a malformed email fails validation and does not sign in', async () => {
    login.loginForm.email().value.set('alice-at-example');
    login.loginForm.password().value.set('Alice123!');

    await expect(submit(login.loginForm)).resolves.toBe(false);
    expect(auth.loginCalls).toBe(0);
    expect(login.loginForm.email().getError('email')).toBeTruthy();
  });

  it('pressing "Sign in" submits through the formRoot directive: invalid first, valid after', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const formElement = fixture.nativeElement.querySelector('form');

    // Empty form: the submit event reports the error, no redirect happens.
    formElement.dispatchEvent(new Event('submit'));
    await vi.waitFor(() =>
      expect(component.loginError()).toBe(
        'Fill in a valid email and a password of at least 8 characters.',
      ),
    );
    expect(auth.loginCalls).toBe(0);
    expect(component.loginForm().touched()).toBe(true);

    // Filled form: the same submit event redirects to Keycloak and clears the error.
    component.loginForm.email().value.set('alice@example.com');
    component.loginForm.password().value.set('Alice123!');
    fixture.detectChanges();
    formElement.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(auth.loginCalls).toBe(1));
    expect(component.loginError()).toBeNull();
  });
});

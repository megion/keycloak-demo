import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { KeycloakAuthService } from '../../auth/keycloak-auth.service';
import { LoginComponent } from './login.component';

it('opens Keycloak from the sign-in button without collecting credentials in MyApp', () => {
  const login = vi.fn();
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [{ provide: KeycloakAuthService, useValue: { login } }],
  });
  const fixture = TestBed.createComponent(LoginComponent);
  fixture.detectChanges();
  const page: HTMLElement = fixture.nativeElement;

  expect(page.querySelector('input')).toBeNull();
  page.querySelector('button')?.click();
  expect(login).toHaveBeenCalledOnce();
});

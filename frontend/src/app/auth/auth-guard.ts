import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KeycloakAuthService } from './keycloak-auth.service';

/**
 * Route guard: only authenticated users (with a valid, refreshed token)
 * can open the user-info page; anonymous users are redirected to the login page.
 */
export const authenticatedGuard: CanActivateFn = () => {
  const auth = inject(KeycloakAuthService);
  const router = inject(Router);
  if (!auth.authenticated()) {
    return router.createUrlTree(['/login']);
  }
  return auth.ensureValidToken().then(() => true);
};

/** Route guard for the login page: authenticated users go straight to user-info. */
export const anonymousGuard: CanActivateFn = () => {
  const auth = inject(KeycloakAuthService);
  const router = inject(Router);
  return auth.authenticated() ? router.createUrlTree(['/user-info']) : true;
};

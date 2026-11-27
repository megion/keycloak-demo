import { inject } from '@angular/core';
import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { KeycloakAuthService } from './auth/keycloak-auth.service';

/**
 * Bootstraps the SPA: initialize Keycloak before the app renders, so the
 * first navigation is evaluated against the real authentication state.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Оптимизация отслеживания изменений
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideAppInitializer(async () => {
      const auth = inject(KeycloakAuthService);
      await auth.init();
    }),
  ],
};

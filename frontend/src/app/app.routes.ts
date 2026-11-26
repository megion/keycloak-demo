import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { authenticatedGuard, anonymousGuard } from './auth/auth-guard';

/**
 * Flow:
 * - "/" redirects to the user-info page (redirect after a successful login).
 * - "user-info" is protected: anonymous users are redirected to "login".
 * - "login" is protected in the reverse direction: authenticated users
 *   are redirected to "user-info".
 */
export const routes: Routes = [
  { path: 'login', canMatch: [anonymousGuard], component: LoginComponent },
  {
    path: 'user-info',
    canMatch: [authenticatedGuard],
    loadComponent: () => import('./pages/user-info/user-info.component').then((m) => m.UserInfoComponent)
  },
  { path: '', pathMatch: 'full', redirectTo: 'user-info' },
  { path: '**', redirectTo: 'user-info' }
];

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ApiConfigService } from '../services/api-config.service';

/** Login screen: needs a server; a logged-in user goes straight to their home tab. */
export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const api = inject(ApiConfigService);
  const router = inject(Router);
  if (!api.isConfigured()) return router.createUrlTree(['/connect']);
  if (auth.isLoggedIn() && !auth.isExpired()) return router.createUrlTree([auth.homeUrl()]);
  return true;
};

/** Screens that need a valid session. */
export const sessionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const api = inject(ApiConfigService);
  const router = inject(Router);
  if (!api.isConfigured()) return router.createUrlTree(['/connect']);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (auth.isExpired()) {
    auth.logout('Your session has expired. Please log in again.');
    return false;
  }
  return true;
};

/** First screen: server setup, login or the role's home tab. */
export const startGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const api = inject(ApiConfigService);
  const router = inject(Router);
  if (!api.isConfigured()) return router.createUrlTree(['/connect']);
  if (!auth.isLoggedIn() || auth.isExpired()) return router.createUrlTree(['/login']);
  return router.createUrlTree([auth.homeUrl()]);
};

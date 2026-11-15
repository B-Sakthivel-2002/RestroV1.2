import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TabId } from '../constants/role-permissions';

/** A tab the role may not open sends the user to their own home tab. */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tab = route.data['tab'] as TabId | undefined;
  if (!tab || auth.canOpen(tab)) return true;
  return router.createUrlTree([auth.homeUrl()]);
};

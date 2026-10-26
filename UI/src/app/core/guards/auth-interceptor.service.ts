import {
  HttpInterceptorFn
} from '@angular/common/http';

import { inject } from '@angular/core';
import { Router } from '@angular/router';

import {
  catchError,
  throwError
} from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const token = localStorage.getItem('authToken');
  const router = inject(Router);

  let authReq = req;

  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((err: any) => {

      switch (err.status) {

        case 401:
          localStorage.clear();
          router.navigate(['/']);
          break;

        case 403:
          redirectByRole(router);
          break;
      }

      return throwError(() => err);
    })
  );
};

function redirectByRole(router: Router): void {

  const roles = JSON.parse(
    localStorage.getItem('authRole') || '[]'
  );

  const currentRole = roles[0];

  switch (currentRole) {

    case 'Admin':
    case 'SuperAdmin':
      router.navigate(['/dashboard']);
      break;

    case 'Captain':
      router.navigate(['/kot-list/captain']);
      break;

    case 'Chef':
      router.navigate(['/kot-list']);
      break;

    default:
      router.navigate(['/']);
      break;
  }
}
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiConfigService } from '../services/api-config.service';
import { AuthService } from '../services/auth.service';

// Adds the login token to API calls. A 401 means the token is no longer valid (expired, or the
// server's key changed): the session ends and the login screen says why.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const api = inject(ApiConfigService);
  const isApi = !!api.apiBase() && req.url.startsWith(api.apiBase());
  const isLogin = /\/auth\/(login|login-key)$/i.test(req.url);
  const token = auth.token();

  const request = isApi && token && !isLogin
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && isApi && !isLogin && auth.isLoggedIn()) {
        auth.logout('Your session has expired. Please log in again.');
      }
      return throwError(() => err);
    })
  );
};

/** Message for a failed API call, for alerts and toasts. */
export function apiError(err: any, fallback = 'Something went wrong. Please try again.'): string {
  if (err?.name === 'TimeoutError') return 'The server is not responding. Check the Wi-Fi and try again.';
  if (err?.status === 0) return 'Cannot reach the server. Check the Wi-Fi connection.';
  if (err?.status === 403) return 'Your role is not allowed to do this.';
  const body = err?.error;
  if (typeof body === 'string' && body.length < 300) return body;
  return body?.message || body?.title || err?.message || fallback;
}

import {
  ApplicationConfig,
  provideZoneChangeDetection,
  APP_INITIALIZER
} from '@angular/core';

import { provideRouter } from '@angular/router';

import {
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/guards/auth-interceptor.service';
import { ConfigService } from './core/services/config.service';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

export function initializeApp(
  configService: ConfigService
) {
  return () => configService.loadConfig();
}

export const appConfig: ApplicationConfig = {
  providers: [

    provideZoneChangeDetection({
      eventCoalescing: true
    }),

    provideRouter(routes),
     provideNoopAnimations(),

    provideHttpClient(
      withInterceptors([authInterceptor])
    ),

    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [ConfigService],
      multi: true
    }
  ]
};
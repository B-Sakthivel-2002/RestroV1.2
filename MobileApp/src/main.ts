import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideZoneChangeDetection } from '@angular/core';
import { addIcons } from 'ionicons';
import { alertCircle, checkmarkCircle, close, informationCircle } from 'ionicons/icons';
import { authInterceptor } from './app/core/guards/auth-interceptor.service';
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Icons used by toasts (registered once for the whole app).
addIcons({ alertCircle, checkmarkCircle, close, informationCircle });

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'md', swipeBackEnabled: true }),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Screens are bundled in the app, so preloading them all costs nothing and makes tab switches instant.
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});

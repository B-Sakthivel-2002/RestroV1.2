import { Component, NgZone, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AuthService } from './core/services/auth.service';
import { LiveHubService } from './core/services/live-hub.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`,
})
export class AppComponent implements OnInit {
  private platform = inject(Platform);
  private auth = inject(AuthService);
  private hub = inject(LiveHubService);
  private zone = inject(NgZone);

  ngOnInit(): void {
    if (!Capacitor.isNativePlatform()) return;

    StatusBar.setStyle({ style: Style.Default }).catch(() => { });

    // Back on the app: an expired token logs out; the live connection catches up.
    App.addListener('resume', () => this.zone.run(() => {
      this.auth.checkExpiry();
      if (this.auth.isLoggedIn()) this.hub.onResume();
    }));

    // Hardware back on a main screen (nothing to go back to) sends the app to the background
    // instead of closing it, so the session and live connection stay.
    this.platform.backButton.subscribeWithPriority(-1, () => {
      App.minimizeApp().catch(() => { });
    });
  }
}

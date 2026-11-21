import { Component, computed, inject } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { flameOutline, gridOutline, handLeftOutline, personCircleOutline, receiptOutline, statsChartOutline, ticketOutline } from 'ionicons/icons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/services/auth.service';
import { LiveHubService } from '../core/services/live-hub.service';
import { ALL_TABS } from '../core/constants/role-permissions';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        @for (t of tabs(); track t.id) {
          <ion-tab-button [tab]="t.id">
            <ion-icon [name]="t.icon" aria-hidden="true"></ion-icon>
            <ion-label>{{ t.label }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  private auth = inject(AuthService);
  private hub = inject(LiveHubService);
  readonly tabs = computed(() => ALL_TABS.filter(t => this.auth.tabs().includes(t.id)));

  constructor() {
    addIcons({ flameOutline, gridOutline, handLeftOutline, personCircleOutline, receiptOutline, statsChartOutline, ticketOutline });

    // An admin used "Log out all devices" for this branch (web Settings > Profile): leave at once.
    // The API refuses this login from now on anyway, so the next call would log out too.
    this.hub.on('ForceLogout').pipe(takeUntilDestroyed()).subscribe(() =>
      this.auth.logout('An admin logged out all devices of this branch. Please log in again.'));
  }
}

import { Component, computed, inject } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { flameOutline, gridOutline, handLeftOutline, personCircleOutline, receiptOutline, statsChartOutline, ticketOutline } from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
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
  readonly tabs = computed(() => ALL_TABS.filter(t => this.auth.tabs().includes(t.id)));

  constructor() {
    addIcons({ flameOutline, gridOutline, handLeftOutline, personCircleOutline, receiptOutline, statsChartOutline, ticketOutline });
  }
}

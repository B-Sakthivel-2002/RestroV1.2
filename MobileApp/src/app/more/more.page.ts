import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { businessOutline, chevronForward, logOutOutline, pulseOutline, serverOutline, shieldCheckmarkOutline, storefrontOutline, informationCircleOutline } from 'ionicons/icons';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../core/services/auth.service';
import { ApiConfigService } from '../core/services/api-config.service';
import { LiveHubService } from '../core/services/live-hub.service';
import { UiService } from '../core/services/ui.service';
import { roleLabel } from '../core/constants/role-permissions';

@Component({
  selector: 'app-more',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, DatePipe],
  template: `
    <ion-header><ion-toolbar><ion-title>Account</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div class="pad">
        <div class="me card">
          <div class="avatar">{{ initials() }}</div>
          <div>
            <div class="name">{{ s()?.name }}</div>
            <span class="badge b-primary">{{ role() }}</span>
          </div>
        </div>

        <div class="section-title">SmartDine</div>
        <div class="card list">
          <div class="row"><ion-icon name="storefront-outline"></ion-icon><span>Branch</span><b>{{ s()?.branchName || '—' }}</b></div>
          <div class="row"><ion-icon name="business-outline"></ion-icon><span>Outlet</span><b>{{ s()?.outletName || '—' }}</b></div>
        </div>

        <div class="section-title">Connection</div>
        <div class="card list">
          <button class="row" (click)="changeServer()">
            <ion-icon name="server-outline"></ion-icon><span>Server</span><b>{{ api.serverLabel() }}</b><ion-icon name="chevron-forward" class="chev"></ion-icon>
          </button>
          <div class="row">
            <ion-icon name="pulse-outline"></ion-icon><span>Live updates</span>
            <b class="live"><i class="live-dot" [class.off]="hub.status() !== 'connected'"></i>{{ hub.status() === 'connected' ? 'Connected' : 'Connecting…' }}</b>
          </div>
          <div class="row">
            <ion-icon name="shield-checkmark-outline"></ion-icon><span>Session valid until</span>
            <b>{{ s()?.expiresAt ? (s()!.expiresAt | date:'d MMM, h:mm a') : '—' }}</b>
          </div>
          <div class="row"><ion-icon name="information-circle-outline"></ion-icon><span>App version</span><b>{{ version() }}</b></div>
        </div>

        <button class="btn outline-danger block logout" (click)="logout()"><ion-icon name="log-out-outline"></ion-icon> Log out</button>
      </div>
    </ion-content>
  `,
  styles: [`
    .pad { padding: 16px 16px 32px; }
    .me { display: flex; align-items: center; gap: 14px; }
    .avatar { width: 56px; height: 56px; border-radius: 18px; display: grid; place-items: center; font-weight: 800; font-size: 20px; color: #fff;
      background: linear-gradient(135deg, #4361ee, #7c3aed); }
    .name { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
    .list { padding: 2px 14px; }
    .row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 13px 0; border: 0; background: transparent; color: var(--app-text);
      font-size: 14px; text-align: left; & + .row { border-top: 1px solid var(--app-border); }
      > ion-icon:first-child { font-size: 20px; color: var(--app-muted); }
      span { flex: 1; } b { font-weight: 700; text-align: right; } .chev { color: var(--app-muted); } }
    .live { display: inline-flex; align-items: center; gap: 6px; }
    .logout { margin-top: 24px; min-height: 50px; }
  `],
})
export class MorePage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private ui = inject(UiService);
  readonly api = inject(ApiConfigService);
  readonly hub = inject(LiveHubService);

  readonly s = this.auth.session;
  readonly role = computed(() => roleLabel(this.s()?.role));
  readonly initials = computed(() => String(this.s()?.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
  readonly version = signal('web');

  constructor() {
    addIcons({ businessOutline, chevronForward, logOutOutline, pulseOutline, serverOutline, shieldCheckmarkOutline, storefrontOutline, informationCircleOutline });
  }

  ngOnInit(): void {
    if (Capacitor.isNativePlatform()) {
      App.getInfo().then(i => this.version.set(`${i.version} (${i.build})`)).catch(() => { });
    }
  }

  changeServer(): void {
    this.router.navigateByUrl('/connect');
  }

  async logout(): Promise<void> {
    if (await this.ui.confirm('Log out?', 'You will need your password to sign in again.', 'Log out', true)) {
      this.auth.logout();
    }
  }
}

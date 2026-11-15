import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, checkmarkCircle, qrCodeOutline, serverOutline, wifiOutline } from 'ionicons/icons';
import { ApiConfigService } from '../core/services/api-config.service';
import { AuthService } from '../core/services/auth.service';
import { UiService } from '../core/services/ui.service';
import { QrScannerComponent } from '../core/components/qr-scanner.component';

// Server setup: scan the QR from the web app (Settings › Mobile App Connect) or type the address.
@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [IonContent, IonIcon, IonSpinner, FormsModule],
  template: `
    <ion-content [fullscreen]="true">
      <div class="wrap">
        @if (api.isConfigured()) {
          <button class="back icon-btn" (click)="back()" aria-label="Back"><ion-icon name="arrow-back-outline"></ion-icon></button>
        }
        <div class="hero">
          <div class="logo"><ion-icon name="wifi-outline"></ion-icon></div>
          <h1>Connect to your restaurant</h1>
          <p>Open the web app on the billing PC, go to <b>Settings › Mobile App Connect</b> and scan the QR code.</p>
        </div>

        <button class="btn primary block scan" (click)="scan()" [disabled]="busy()">
          <ion-icon name="qr-code-outline"></ion-icon> Scan QR code
        </button>

        <div class="or"><span>or type the address</span></div>

        <label class="field">
          <span>Server address</span>
          <input [(ngModel)]="address" placeholder="192.168.1.10:100" inputmode="url" autocapitalize="off" autocomplete="off"
                 (keyup.enter)="connect()" [disabled]="busy()" />
          <small>The address shown under the QR code, e.g. http://192.168.1.10:100/</small>
        </label>

        @if (error()) { <div class="msg err">{{ error() }}</div> }
        @if (ok()) { <div class="msg ok"><ion-icon name="checkmark-circle"></ion-icon> {{ ok() }}</div> }

        <button class="btn soft block" (click)="connect()" [disabled]="busy() || !address.trim()">
          @if (busy()) { <ion-spinner name="crescent"></ion-spinner> Connecting… } @else { <ion-icon name="server-outline"></ion-icon> Connect }
        </button>

        @if (api.isConfigured()) {
          <p class="current">Current server: <b>{{ api.serverLabel() }}</b></p>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .wrap { max-width: 460px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 28px) 22px 32px; position: relative; }
    .back { position: absolute; top: calc(env(safe-area-inset-top) + 12px); left: 16px; }
    .hero { text-align: center; margin: 28px 0 28px; }
    .logo { width: 76px; height: 76px; margin: 0 auto 18px; border-radius: 24px; display: grid; place-items: center;
      background: linear-gradient(135deg, #4361ee, #7c3aed); color: #fff; font-size: 38px; box-shadow: var(--app-shadow-lg); }
    h1 { font-size: 24px; font-weight: 800; margin: 0 0 8px; letter-spacing: -.4px; }
    .hero p { color: var(--app-muted); margin: 0; line-height: 1.5; }
    .scan { min-height: 56px; font-size: 16px; border-radius: 16px; }
    .or { display: flex; align-items: center; gap: 12px; color: var(--app-muted); font-size: 12px; margin: 22px 0 16px; }
    .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--app-border); }
    .msg { border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; font-size: 13px; font-weight: 600; display: flex; gap: 6px; align-items: center; }
    .msg.err { background: var(--app-danger-soft); color: var(--ion-color-danger); }
    .msg.ok { background: var(--app-success-soft); color: var(--ion-color-success); }
    .current { text-align: center; color: var(--app-muted); font-size: 13px; margin-top: 18px; }
    ion-spinner { width: 18px; height: 18px; }
  `],
})
export class ConnectPage {
  readonly api = inject(ApiConfigService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private modal = inject(ModalController);
  private ui = inject(UiService);

  address = this.api.serverLabel();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly ok = signal('');

  constructor() {
    addIcons({ arrowBackOutline, checkmarkCircle, qrCodeOutline, serverOutline, wifiOutline });
  }

  async scan(): Promise<void> {
    if (!QrScannerComponent.isSupported()) {
      this.error.set('This phone cannot scan QR codes in the app. Type the address shown under the QR code.');
      return;
    }
    const m = await this.modal.create({ component: QrScannerComponent });
    await m.present();
    const { data, role } = await m.onDidDismiss();
    if (role === 'scanned' && data) {
      this.address = String(data).trim();
      await this.connect();
    }
  }

  async connect(): Promise<void> {
    this.error.set('');
    this.ok.set('');
    this.busy.set(true);
    try {
      const res = await this.api.resolve(this.address);
      if (!res.ok || !res.apiBase) {
        this.error.set(res.message);
        return;
      }
      const changed = res.apiBase !== this.api.apiBase();
      this.api.save(res.apiBase);
      this.ok.set(res.message);
      this.ui.toast(res.message, 'success');
      // A token from another server is not valid here.
      if (changed && this.auth.isLoggedIn()) this.auth.logout();
      else this.router.navigateByUrl(this.auth.isLoggedIn() ? this.auth.homeUrl() : '/login', { replaceUrl: true });
    } finally {
      this.busy.set(false);
    }
  }

  back(): void {
    this.router.navigateByUrl(this.auth.isLoggedIn() ? this.auth.homeUrl() : '/login', { replaceUrl: true });
  }
}

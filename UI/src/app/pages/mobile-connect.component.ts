import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { AppSettings } from '../core/constants/Appsettings';
import { encodeQr } from '../shared/qr-code';

// Settings > Mobile App Connect: the server this UI is connected to, as http://ip:port/<app>/, with a QR
// code of the same text for the mobile app to scan. When the UI talks to the API as "localhost"
// (which a phone cannot reach), the server's own network IP from the API is shown instead.
@Component({
  selector: 'app-mobile-connect',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cnt">
      <div class="sub-header">
        <h2>Mobile App Connect</h2>
        <button type="button" class="btn btn-outline-primary btn-sm" (click)="load()" [disabled]="loading">
          <i class="pi pi-refresh"></i> Refresh
        </button>
      </div>

      <div class="mc-card">
        @if (loading && !serverUrl) {
          <p class="mc-muted">Finding the server address...</p>
        } @else if (error) {
          <p class="mc-error">{{ error }}</p>
        } @else if (serverUrl) {
          <div class="mc-qr">
            <canvas #qrCanvas [attr.aria-label]="'QR code of ' + serverUrl" role="img"></canvas>
          </div>
          <div class="mc-url">
            <code>{{ serverUrl }}</code>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="copy()" title="Copy">
              <i class="pi" [class.pi-copy]="!copied" [class.pi-check]="copied"></i> {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .mc-card { background: var(--rp-surface); border: 1px solid var(--rp-border); border-radius: 12px; padding: 32px 24px;
               margin-top: 16px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .mc-qr { background: #fff; padding: 12px; border-radius: 12px; border: 1px solid var(--rp-border); line-height: 0; }
    .mc-qr canvas { width: 280px; height: 280px; image-rendering: pixelated; }
    .mc-url { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; }
    .mc-url code { font-size: 1.4rem; font-weight: 600; padding: 6px 12px; border-radius: 6px; background: var(--rp-surface-alt); color: var(--rp-text); overflow-wrap: anywhere; }
    .mc-muted { color: var(--rp-text-muted); margin: 0; }
    .mc-error { color: #dc3545; margin: 0; }
  `
})
export class MobileConnectComponent implements OnInit, AfterViewChecked {
  @ViewChild('qrCanvas') qrCanvas?: ElementRef<HTMLCanvasElement>;

  serverUrl = '';
  loading = false;
  error = '';
  copied = false;
  private drawnUrl: string | null = null;
  private drawnCanvas: HTMLCanvasElement | null = null;

  constructor(private query: QueryService) {}

  ngOnInit(): void {
    this.load();
  }

  // The canvas appears after the data arrives: draw once per URL / canvas.
  ngAfterViewChecked(): void {
    const canvas = this.qrCanvas?.nativeElement;
    if (canvas && this.serverUrl && (this.drawnUrl !== this.serverUrl || this.drawnCanvas !== canvas)) {
      this.draw(canvas, this.serverUrl);
      this.drawnUrl = this.serverUrl;
      this.drawnCanvas = canvas;
    }
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.query.getServerConnectInfo().subscribe({
      next: (res: any) => {
        this.loading = false;
        this.serverUrl = MobileConnectComponent.serverUrlFor(AppSettings.apiUrl, res);
        if (!this.serverUrl) this.error = 'This server has no network address. Connect it to the Wi-Fi / LAN and press Refresh.';
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Could not read the server address.';
      }
    });
  }

  // http://ip:port/<IIS app>/ of the server this UI uses. A loopback host in the UI config is replaced
  // by the server's preferred network IP (the API lists it first); the scheme and port stay the UI's.
  // The IIS application path (e.g. /SmartdineAPI) is kept so the mobile app finds the API under any name.
  static serverUrlFor(apiUrl: string, info: any): string {
    let url: URL;
    try { url = new URL(apiUrl, location.href); } catch { return ''; }
    const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname.toLowerCase());
    const host = loopback ? info?.addresses?.[0]?.ip : url.hostname;
    if (!host) return '';
    const port = url.port || String(info?.port || '');
    let appPath = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '').replace(/^\/+/, '');
    if (!appPath && info?.basePath) appPath = String(info.basePath).replace(/^\/+|\/+$/g, '');
    return `${url.protocol}//${host}${port ? ':' + port : ''}/${appPath ? appPath + '/' : ''}`;
  }

  copy(): void {
    navigator.clipboard?.writeText(this.serverUrl).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    }).catch(() => { });
  }

  private draw(canvas: HTMLCanvasElement, text: string): void {
    const modules = encodeQr(text);
    const quiet = 4;
    const count = modules.length + quiet * 2;
    const scale = Math.max(4, Math.floor(560 / count)); // sharp on high-DPI screens
    canvas.width = canvas.height = count * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    modules.forEach((row, y) => row.forEach((dark, x) => {
      if (dark) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    }));
  }
}

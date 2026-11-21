import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '@appservices/auth.service';
import { LiveHubService, HubStatus } from '@appservices/live-hub.service';
import { AppSettings } from '../core/constants/Appsettings';
import { QueryService } from '@appservices/query.service';

// Settings > Profile: the same account details as the mobile app's More page
// (who is signed in, branch / outlet, server, live updates, session expiry, version) and Log out.
// Everything comes from the login session already in the browser, so no API call is needed.
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Profile</h2>
            <p class="sb-tt mb-0">Your account on this device.</p>
          </div>
        </div>

        <div class="cnt">
          <!-- Who is signed in, with Log out on the right -->
          <div class="pf-hero">
            <div class="pf-avatar" aria-hidden="true">{{ initials }}</div>
            <div class="pf-who">
              <div class="pf-name">{{ name || 'User' }}</div>
              <div class="pf-meta">
                <span class="pf-badge">{{ role }}</span>
                @if (branchName) { <span><i class="pi pi-shop"></i> {{ branchName }}</span> }
                @if (expiresAt) { <span><i class="pi pi-clock"></i> Signed in until {{ expiresAt | date: 'd MMM, h:mm a' }}</span> }
              </div>
            </div>
            <div class="pf-actions">
              @if (canLogoutAll) {
                <button type="button" class="btn pf-logout pf-logout-all" [disabled]="loggingOutAll" (click)="logoutAll()"
                  title="Log out every device of this branch: computers, tablets and the mobile app">
                  <i class="pi pi-power-off"></i> {{ loggingOutAll ? 'Logging out...' : 'Log out all devices' }}
                </button>
              }
              <button type="button" class="btn pf-logout" (click)="logout()">
                <i class="pi pi-sign-out"></i> Log out
              </button>
            </div>
          </div>

          <h3 class="pf-section">Restaurant</h3>
          <div class="pf-grid">
            <div class="pf-tile">
              <span class="pf-ic t1"><i class="pi pi-shop"></i></span>
              <div><span class="pf-lbl">Branch</span><b>{{ branchName || '—' }}</b></div>
            </div>
            <div class="pf-tile">
              <span class="pf-ic t2"><i class="pi pi-building"></i></span>
              <div><span class="pf-lbl">Outlet</span><b>{{ outletName || '—' }}</b></div>
            </div>
            <div class="pf-tile">
              <span class="pf-ic t3"><i class="pi pi-id-card"></i></span>
              <div><span class="pf-lbl">Role</span><b>{{ role }}</b></div>
            </div>
          </div>

          <h3 class="pf-section">Connection</h3>
          <div class="pf-grid">
            <div class="pf-tile">
              <span class="pf-ic t4"><i class="pi pi-server"></i></span>
              <div><span class="pf-lbl">Server</span><b class="pf-break">{{ server || '—' }}</b></div>
            </div>
            <div class="pf-tile">
              <span class="pf-ic" [class.t-ok]="hubStatus === 'connected'" [class.t-warn]="hubStatus !== 'connected'"><i class="pi pi-wave-pulse"></i></span>
              <div>
                <span class="pf-lbl">Live updates</span>
                <b class="pf-live"><i class="pf-dot" [class.off]="hubStatus !== 'connected'"></i>{{ hubStatus === 'connected' ? 'Connected' : hubStatus === 'reconnecting' ? 'Reconnecting…' : 'Connecting…' }}</b>
              </div>
            </div>
            <div class="pf-tile">
              <span class="pf-ic t1"><i class="pi pi-shield"></i></span>
              <div><span class="pf-lbl">Session valid until</span><b>{{ expiresAt ? (expiresAt | date: 'd MMM y, h:mm a') : '—' }}</b></div>
            </div>
            <div class="pf-tile">
              <span class="pf-ic t2"><i class="pi pi-info-circle"></i></span>
              <div><span class="pf-lbl">App version</span><b>{{ version }}</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    /* Banner in the theme's hero colours (same as the sales report's Total card). */
    .pf-hero {
      display: flex; align-items: center; gap: 20px; padding: 24px 28px;
      border-radius: var(--rp-radius-lg); color: var(--rp-on-hero, #fff);
      background: var(--rp-hero); box-shadow: var(--rp-hero-shadow, var(--rp-shadow-md));
    }
    .pf-avatar {
      flex: 0 0 72px; width: 72px; height: 72px; border-radius: 22px;
      display: grid; place-items: center; font-weight: 800; font-size: 26px;
      color: #fff; background: rgba(255, 255, 255, 0.18); border: 2px solid rgba(255, 255, 255, 0.35);
    }
    .pf-who { flex: 1 1 auto; min-width: 0; }
    .pf-name { font-size: 24px; font-weight: 800; line-height: 1.2; margin-bottom: 8px; overflow-wrap: anywhere; }
    .pf-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; font-size: var(--rp-fs-sm); opacity: 0.92; }
    .pf-meta .pi { margin-right: 4px; }
    .pf-badge {
      padding: 3px 12px; border-radius: var(--rp-radius-pill, 999px); font-weight: 700;
      font-size: var(--rp-fs-xs); background: rgba(255, 255, 255, 0.2);
    }
    .pf-logout {
      flex: 0 0 auto; padding: 10px 18px; font-weight: 600; color: #fff;
      background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.45);
    }
    .pf-logout:hover { color: #b02a37; background: #fff; border-color: #fff; }
    .pf-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; flex: 0 0 auto; }
    .pf-logout-all { background: rgba(220, 53, 69, 0.85); border-color: rgba(255, 255, 255, 0.55); }
    .pf-logout-all:hover { color: #fff; background: #b02a37; border-color: #fff; }

    .pf-section {
      margin: 28px 2px 12px; font-size: var(--rp-fs-xs); font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase; color: var(--rp-text-muted);
    }
    /* Laptop: 3 tiles per row; tablets 2; phones 1. */
    .pf-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
    @media (max-width: 1199.98px) { .pf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 767.98px) {
      .pf-grid { grid-template-columns: minmax(0, 1fr); }
      .pf-hero { flex-wrap: wrap; padding: 20px; }
      .pf-actions { width: 100%; }
      .pf-logout { flex: 1 1 100%; }
    }
    .pf-tile {
      display: flex; align-items: center; gap: 16px; padding: 18px 20px; min-width: 0;
      background: var(--rp-surface); border: 1px solid var(--rp-border);
      border-radius: var(--rp-radius-lg); box-shadow: var(--rp-shadow-sm);
    }
    .pf-tile > div { display: flex; flex-direction: column; min-width: 0; }
    .pf-ic {
      --tone: var(--rp-primary);
      flex: 0 0 46px; width: 46px; height: 46px; border-radius: 14px;
      display: grid; place-items: center; font-size: 19px;
      color: var(--tone); background: color-mix(in srgb, var(--tone) 13%, transparent);
    }
    .pf-ic.t1 { --tone: var(--rp-tone-1, #4361ee); }
    .pf-ic.t2 { --tone: var(--rp-tone-2, #0f766e); }
    .pf-ic.t3 { --tone: var(--rp-tone-3, #c2410c); }
    .pf-ic.t4 { --tone: var(--rp-tone-4, #6d28d9); }
    .pf-ic.t-ok { --tone: #16a34a; }
    .pf-ic.t-warn { --tone: #f59e0b; }
    .pf-lbl { font-size: var(--rp-fs-xs); color: var(--rp-text-muted); margin-bottom: 3px; }
    .pf-tile b { font-size: var(--rp-fs-md, 16px); font-weight: 700; }
    .pf-break { overflow-wrap: anywhere; }
    .pf-live { display: inline-flex; align-items: center; gap: 8px; }
    .pf-dot { width: 9px; height: 9px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18); }
    .pf-dot.off { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18); }
  `,
})
export class ProfileComponent implements OnInit, OnDestroy {
  name = '';
  role = 'User';
  branchName = '';
  outletName = '';
  server = '';
  expiresAt: Date | null = null;
  version = 'Web';
  hubStatus: HubStatus = 'connecting';
  // Branch heads and outlet owners may log out every device of their branch.
  canLogoutAll = false;
  loggingOutAll = false;

  private subs = new Subscription();

  constructor(private auth: AuthService, private hub: LiveHubService, private router: Router, private query: QueryService) {}

  ngOnInit(): void {
    const claims = this.readToken();
    this.name = claims['unique_name'] || claims['name'] || claims['sub']
      || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || '';
    const r = String(this.auth.getUserRole() || '').trim();
    this.role = r.toLowerCase() === 'cheif' ? 'Chef' : r || 'User';
    this.canLogoutAll = this.auth.hasAnyRole(['Admin', 'SuperAdmin']);
    this.expiresAt = claims['exp'] ? new Date(Number(claims['exp']) * 1000) : null;
    this.branchName = this.read('branchname');
    this.outletName = this.read('outletname');
    this.server = (AppSettings.apiUrl || '').replace(/\/api\/?$/i, '').replace(/\/$/, '');
    if (AppSettings.appName) this.version = AppSettings.appName + ' · Web';

    // Listening keeps the shared live connection open while this page is shown, so the status is real.
    this.subs.add(this.hub.status$.subscribe(s => (this.hubStatus = s)));
    this.subs.add(this.hub.on('__profile_status').subscribe());
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get initials(): string {
    return String(this.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  logout(): void {
    if (!confirm('Log out? You will need your password to sign in again.')) return;
    this.auth.clearRolesToken().subscribe({
      next: (ok: any) => { if (ok) this.router.navigate(['/']); },
    });
  }

  // Ends every login of this branch (web and mobile, this device included); the API refuses them from now on.
  logoutAll(): void {
    const branch = this.branchName || 'this branch';
    if (!confirm(`Log out ALL devices of ${branch}?\n\nEvery computer, tablet and mobile app signed in to this branch, including this one, will have to log in again.`)) return;
    this.loggingOutAll = true;
    this.auth.loggingOutAllDevices = true;
    this.query.logoutAllDevices().subscribe({
      next: () => {
        this.auth.clearRolesToken().subscribe(() => {
          this.router.navigate(['/']).then(() => {
            this.auth.loggingOutAllDevices = false;
            setTimeout(() => alert(`All devices of ${branch} have been logged out.`));
          });
        });
      },
      error: (err: any) => {
        this.loggingOutAll = false;
        this.auth.loggingOutAllDevices = false;
        const reason = err?.error?.message
          || (err?.status === 404 ? 'The server does not have this feature yet. Deploy the latest API build and try again.'
          : err?.status === 403 ? 'Only Admin and SuperAdmin users can log out all devices.'
          : err?.status === 0 ? 'The server could not be reached. Check the connection and try again.'
          : `Could not log out the devices (error ${err?.status ?? '?'}). Please try again.`);
        alert(reason);
      },
    });
  }

  private read(key: string): string {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  }

  // Claims of the login token (JWT payload); empty when there is none.
  private readToken(): Record<string, any> {
    try {
      const payload = this.read('authToken').split('.')[1];
      if (!payload) return {};
      const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '='))
        .split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
}

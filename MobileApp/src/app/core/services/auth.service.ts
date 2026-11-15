import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { AppRole, ROLE_HOME, ROLE_TABS, TabId, normalizeRole } from '../constants/role-permissions';

export interface Session {
  token: string;
  role: string;
  userId: number;
  name: string;
  branchId: number;
  branchName: string;
  outletId: number;
  outletName: string;
  /** Token expiry (ms since epoch); 0 when the token carries none. */
  expiresAt: number;
}

const SESSION_KEY = 'session';

// Login, the session and its token. The token is the only credential: it is sent on every API call
// and on the live (SignalR) connection, and the app logs out by itself when it expires.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = inject(ApiConfigService);

  private readonly state = signal<Session | null>(AuthService.restore());
  private expiryTimer: any;
  private loggingOut = false;

  readonly session = this.state.asReadonly();
  readonly isLoggedIn = computed(() => !!this.state());
  readonly role = computed<AppRole>(() => normalizeRole(this.state()?.role));
  readonly tabs = computed<TabId[]>(() => ROLE_TABS[this.role()]);
  readonly isOwner = computed(() => this.role() === 'owner');
  readonly isAdmin = computed(() => this.role() === 'owner' || this.role() === 'admin');

  /** Callbacks run on logout (e.g. close the live connection, drop caches). */
  private logoutHooks: Array<() => void> = [];

  constructor() {
    this.scheduleExpiry();
  }

  token(): string {
    return this.state()?.token ?? '';
  }

  homeUrl(): string {
    return '/tabs/' + ROLE_HOME[this.role()];
  }

  canOpen(tab: TabId): boolean {
    return this.tabs().includes(tab);
  }

  onLogout(hook: () => void): void {
    this.logoutHooks.push(hook);
  }

  async login(username: string, password: string): Promise<{ ok: boolean; message?: string }> {
    const key: any = await firstValueFrom(this.http.get(this.api.url('auth/login-key')).pipe(timeout(15000)));
    const publicKey = key?.data?.publicKey;
    const nonce = key?.data?.nonce;
    if (!publicKey || !nonce) {
      return { ok: false, message: 'The server did not send a login key. Check the server address.' };
    }
    const encrypted = await AuthService.encrypt(nonce + ':' + password, publicKey);
    const res: any = await firstValueFrom(
      this.http.post(this.api.url('auth/Login'), { username: username.trim(), password: encrypted }).pipe(timeout(20000))
    );
    if (res?.status !== 'Success' || !res?.data?.token) {
      return { ok: false, message: res?.message || 'Invalid username or password' };
    }
    const d = res.data;
    const session: Session = {
      token: d.token,
      role: d.role,
      userId: Number(d.id) || 0,
      name: d.name || username,
      branchId: Number(d.branchid) || 0,
      branchName: d.branchname || '',
      outletId: Number(d.outletid) || 0,
      outletName: d.outletname || '',
      expiresAt: AuthService.tokenExpiry(d.token),
    };
    this.persist(session);
    this.state.set(session);
    this.scheduleExpiry();
    return { ok: true };
  }

  /** Ends the session. `reason` is shown on the login screen (e.g. session expired). */
  logout(reason?: string): void {
    if (this.loggingOut) return;
    this.loggingOut = true;
    clearTimeout(this.expiryTimer);
    for (const hook of this.logoutHooks) {
      try { hook(); } catch { }
    }
    this.state.set(null);
    try {
      localStorage.removeItem(SESSION_KEY);
      // Keys written by older versions of the app.
      ['authToken', 'authRole', 'userid', 'branchid', 'outletid', 'orderHistroy'].forEach(k => localStorage.removeItem(k));
      if (reason) sessionStorage.setItem('logoutReason', reason);
    } catch { }
    this.router.navigateByUrl('/login', { replaceUrl: true }).finally(() => this.loggingOut = false);
  }

  takeLogoutReason(): string {
    try {
      const r = sessionStorage.getItem('logoutReason') || '';
      sessionStorage.removeItem('logoutReason');
      return r;
    } catch {
      return '';
    }
  }

  /** True when the stored token has expired (checked on app resume too). */
  isExpired(): boolean {
    const s = this.state();
    return !!s && s.expiresAt > 0 && Date.now() >= s.expiresAt;
  }

  checkExpiry(): void {
    if (this.isExpired()) this.logout('Your session has expired. Please log in again.');
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const s = this.state();
    if (!s || !s.expiresAt) return;
    const ms = s.expiresAt - Date.now();
    if (ms <= 0) {
      // Restored an expired session: log out once the app has started.
      setTimeout(() => this.checkExpiry());
      return;
    }
    // setTimeout overflows above ~24.8 days: wait the maximum and schedule again.
    const max = 2 ** 31 - 1;
    this.expiryTimer = setTimeout(() => ms > max ? this.scheduleExpiry() : this.checkExpiry(), Math.min(ms, max));
  }

  private persist(s: Session): void {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { }
  }

  private static restore(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return s?.token ? s : null;
    } catch {
      return null;
    }
  }

  /** "exp" claim of a JWT in ms; 0 when missing or unreadable. */
  static tokenExpiry(token: string): number {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(decodeURIComponent(escape(atob(part.padEnd(part.length + (4 - part.length % 4) % 4, '=')))));
      return typeof json.exp === 'number' ? json.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }

  /** RSA-OAEP (SHA-256) with the server's one-time key, base64 — what api/auth/Login expects. */
  private static async encrypt(text: string, publicKeyPem: string): Promise<string> {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('This device cannot encrypt the password (no WebCrypto).');
    const b64 = publicKeyPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const key = await subtle.importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const cipher = new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, key, new TextEncoder().encode(text)));
    let bin = '';
    for (let i = 0; i < cipher.length; i++) bin += String.fromCharCode(cipher[i]);
    return btoa(bin);
  }
}

import { Injectable, computed, signal } from '@angular/core';

export interface ProbeResult {
  ok: boolean;
  apiBase?: string;
  message: string;
}

// Where the API lives. The web app's Settings > Mobile App Connect QR holds only the server
// address (http://ip:port/), so the API path is found by asking the server: the API is either at
// the root (Kestrel: /api/) or under an IIS application (e.g. /Resto/api/).
@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private static readonly KEY = 'api_base_url';
  private static readonly LEGACY_KEY = 'api_server_address'; // older app versions: "host:port" under /Resto/api/
  private static readonly APP_PATHS = ['api/', 'Resto/api/'];
  private static readonly PROBE_MS = 5000;

  private readonly base = signal<string>(ApiConfigService.load());

  /** e.g. http://192.168.1.10:100/Resto/api/ ('' until a server is set). */
  readonly apiBase = this.base.asReadonly();
  readonly isConfigured = computed(() => !!this.base());
  /** Host shown to the user, e.g. 192.168.1.10:100 */
  readonly serverLabel = computed(() => {
    try { return new URL(this.base()).host; } catch { return ''; }
  });

  private static load(): string {
    try {
      const saved = localStorage.getItem(ApiConfigService.KEY);
      if (saved) return saved;
      const legacy = localStorage.getItem(ApiConfigService.LEGACY_KEY);
      if (legacy) return `http://${legacy.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')}/Resto/api/`;
    } catch { }
    return '';
  }

  url(path: string): string {
    return this.base() + path.replace(/^\//, '');
  }

  /** SignalR hub, next to the API: http://ip:port/Resto/kotHub */
  hubUrl(): string {
    return this.base().replace(/api\/?$/i, '') + 'kotHub';
  }

  save(apiBase: string): void {
    const clean = apiBase.endsWith('/') ? apiBase : apiBase + '/';
    try {
      localStorage.setItem(ApiConfigService.KEY, clean);
      localStorage.removeItem(ApiConfigService.LEGACY_KEY);
    } catch { }
    this.base.set(clean);
  }

  clear(): void {
    try {
      localStorage.removeItem(ApiConfigService.KEY);
      localStorage.removeItem(ApiConfigService.LEGACY_KEY);
    } catch { }
    this.base.set('');
  }

  /**
   * Finds the API for a scanned / typed address. Accepts "192.168.1.10", "192.168.1.10:100",
   * "http://192.168.1.10:100/" or a full API URL like "http://192.168.1.10:100/Resto/api/".
   */
  async resolve(input: string): Promise<ProbeResult> {
    const candidates = ApiConfigService.candidates(input);
    if (!candidates.length) {
      return { ok: false, message: 'Enter the server address, e.g. 192.168.1.10:100' };
    }
    // Ask every candidate at once; the first one answering like our API wins.
    const results = await Promise.all(candidates.map(c => this.probe(c)));
    const found = results.find(r => r.ok);
    if (found) return found;
    const reached = results.find(r => r.message.startsWith('reached'));
    return {
      ok: false,
      message: reached
        ? 'The server answered, but no Restro API was found at that address.'
        : 'Cannot reach the server. Check that the phone is on the same Wi-Fi and the address is right.',
    };
  }

  static candidates(input: string): string[] {
    let text = (input || '').trim();
    if (!text) return [];
    if (!/^https?:\/\//i.test(text)) text = 'http://' + text;
    let url: URL;
    try { url = new URL(text); } catch { return []; }
    const origin = `${url.protocol}//${url.host}/`;
    const path = url.pathname.replace(/^\/+/, '');
    const list: string[] = [];
    if (/api\/?$/i.test(path)) list.push(origin + path.replace(/\/?$/, '/'));
    else if (path) list.push(origin + path.replace(/\/?$/, '/') + 'api/');
    for (const p of ApiConfigService.APP_PATHS) list.push(origin + p);
    // No port given: the API is usually on IIS port 100.
    if (!url.port) {
      for (const p of ApiConfigService.APP_PATHS) list.push(`${url.protocol}//${url.hostname}:100/${p}`);
    }
    return [...new Set(list)];
  }

  private async probe(apiBase: string): Promise<ProbeResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ApiConfigService.PROBE_MS);
    try {
      const res = await fetch(apiBase + 'auth/login-key', { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) return { ok: false, message: 'reached (HTTP ' + res.status + ')' };
      const body = await res.json().catch(() => null);
      return body?.data?.publicKey
        ? { ok: true, apiBase, message: 'Connected to ' + new URL(apiBase).host }
        : { ok: false, message: 'reached (not the API)' };
    } catch {
      return { ok: false, message: 'unreachable' };
    } finally {
      clearTimeout(timer);
    }
  }
}

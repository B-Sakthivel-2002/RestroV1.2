import { Injectable, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { AuthService } from './auth.service';

export type HubStatus = 'connecting' | 'connected' | 'reconnecting';

// One SignalR connection to the API hub (/kotHub), shared by every screen — the same design as the
// web app. The token puts the connection in its branch / role / user groups, so a phone only gets its
// own branch's events. Screens reload on events; nothing polls.
@Injectable({ providedIn: 'root' })
export class LiveHubService {
  private api = inject(ApiConfigService);
  private auth = inject(AuthService);

  private static readonly CLOSE_DELAY_MS = 1500;

  readonly status = signal<HubStatus>('connecting');
  /** Fires when events may have been missed (connection came back, app returned from background). */
  readonly resync$ = new Subject<void>();

  private connection?: signalR.HubConnection;
  private connectionKey = '';
  private connectedBefore = false;
  private listeners = 0;
  private retryTimer: any;
  private closeTimer: any;

  constructor() {
    this.auth.onLogout(() => this.close());
  }

  /** Server event as an observable; subscribing keeps the connection open. */
  on<T = any>(eventName: string): Observable<T> {
    return new Observable<T>(observer => {
      const handler = (payload: T) => observer.next(payload);
      const connection = this.acquire();
      connection.on(eventName, handler);
      return () => {
        connection.off(eventName, handler);
        this.release();
      };
    });
  }

  /** App came back to the foreground: reconnect if needed and let screens reload. */
  onResume(): void {
    const c = this.connection;
    if (!c) return;
    if (c.state === signalR.HubConnectionState.Disconnected) {
      clearTimeout(this.retryTimer);
      this.start(c);
    } else if (c.state === signalR.HubConnectionState.Connected) {
      this.resync$.next();
    }
  }

  private acquire(): signalR.HubConnection {
    clearTimeout(this.closeTimer);
    const key = this.auth.token() + '|' + this.api.hubUrl();
    if (this.connection && this.connectionKey !== key) this.close();
    this.listeners++;
    if (!this.connection) {
      this.connectionKey = key;
      this.connectedBefore = false;
      this.connection = this.build();
      this.start(this.connection);
    }
    return this.connection;
  }

  private release(): void {
    this.listeners = Math.max(0, this.listeners - 1);
    if (this.listeners === 0) {
      clearTimeout(this.closeTimer);
      this.closeTimer = setTimeout(() => this.close(), LiveHubService.CLOSE_DELAY_MS);
    }
  }

  private close(): void {
    const old = this.connection;
    this.connection = undefined;
    clearTimeout(this.retryTimer);
    clearTimeout(this.closeTimer);
    this.status.set('connecting');
    old?.stop().catch(() => { });
  }

  private build(): signalR.HubConnection {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(this.api.hubUrl(), { accessTokenFactory: () => this.auth.token() })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: ctx => Math.min(30000, 2000 * (ctx.previousRetryCount + 1)) })
      .configureLogging(signalR.LogLevel.None)
      .build();
    connection.onreconnecting(() => this.status.set('reconnecting'));
    connection.onreconnected(() => {
      this.status.set('connected');
      this.resync$.next();
    });
    connection.onclose(() => {
      if (this.connection === connection) {
        this.status.set('reconnecting');
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.start(connection), 5000);
      }
    });
    return connection;
  }

  private start(connection: signalR.HubConnection): void {
    if (this.connection !== connection || connection.state !== signalR.HubConnectionState.Disconnected) return;
    this.status.set(this.connectedBefore ? 'reconnecting' : 'connecting');
    connection.start()
      .then(() => {
        this.status.set('connected');
        if (this.connectedBefore) this.resync$.next();
        this.connectedBefore = true;
      })
      .catch(() => {
        if (this.connection !== connection) return;
        this.status.set('reconnecting');
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.start(connection), 5000);
      });
  }
}

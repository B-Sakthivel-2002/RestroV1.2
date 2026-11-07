import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AppSettings } from '../constants/Appsettings';

export type HubStatus = 'connecting' | 'connected' | 'reconnecting';

// One SignalR connection to the API hub (/kotHub) shared by every screen of the tab.
// It is opened while at least one screen listens (on()) and closed after the last one leaves,
// e.g. at logout, so the next login connects with the new user's token. No polling anywhere.
@Injectable({ providedIn: 'root' })
export class LiveHubService {

  // Current connection state, for "Reconnecting..." hints.
  readonly status$ = new BehaviorSubject<HubStatus>('connecting');
  // Emits after every (re)connect: events may have been missed, screens should reload once.
  readonly resync$ = new Subject<void>();

  private connection?: signalR.HubConnection;
  private listeners = 0;
  private retryTimer: any;

  // Server event as an observable; subscribing keeps the connection open.
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

  private acquire(): signalR.HubConnection {
    this.listeners++;
    if (!this.connection) {
      this.connection = this.build();
      this.start(this.connection);
    }
    return this.connection;
  }

  private release(): void {
    this.listeners = Math.max(0, this.listeners - 1);
    if (this.listeners === 0 && this.connection) {
      const old = this.connection;
      this.connection = undefined;
      clearTimeout(this.retryTimer);
      old.stop().catch(() => { });
      this.status$.next('connecting');
    }
  }

  private build(): signalR.HubConnection {
    const connection = new signalR.HubConnectionBuilder()
      // The token puts the connection in its branch, role and user groups on the hub.
      .withUrl(AppSettings.signalrUrl, { accessTokenFactory: () => localStorage.getItem('authToken') || '' })
      // Keep trying for as long as a screen listens (the default gives up after 4 tries).
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: ctx => Math.min(30000, 2000 * (ctx.previousRetryCount + 1)) })
      .build();
    connection.onreconnecting(() => this.status$.next('reconnecting'));
    connection.onreconnected(() => {
      this.status$.next('connected');
      this.resync$.next();
    });
    // Closed for good while still in use: start over.
    connection.onclose(() => {
      if (this.connection === connection) {
        this.status$.next('reconnecting');
        this.retryTimer = setTimeout(() => this.start(connection), 5000);
      }
    });
    return connection;
  }

  private start(connection: signalR.HubConnection): void {
    if (this.connection !== connection) return;
    this.status$.next('connecting');
    connection.start()
      .then(() => {
        this.status$.next('connected');
        this.resync$.next();
      })
      .catch(() => {
        if (this.connection !== connection) return;
        this.status$.next('reconnecting');
        this.retryTimer = setTimeout(() => this.start(connection), 5000);
      });
  }
}

import { Injectable, OnDestroy } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class KotSignalrService implements OnDestroy {

  private hubConnection?: signalR.HubConnection;
  private startPromise?: Promise<void>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private manuallyStopped = false;

  constructor(private apiConfig: ApiConfigService) {}

  private orderUpdatedSource = new Subject<number>();
  /** Subscribe to get notified whenever the hub pushes an OrderUpdated event */
  readonly orderUpdated$ = this.orderUpdatedSource.asObservable();

  private orderSettledSource = new Subject<number>();
  readonly orderSettled$ = this.orderSettledSource.asObservable();

  private tableStatusSource = new Subject<unknown>();
  readonly tableStatus$ = this.tableStatusSource.asObservable();

  /**
   * Starts the SignalR connection.
   * Safe to call from multiple component instances - if a connection is
   * already live or already in the process of connecting, this reuses it
   * instead of spinning up a duplicate hub connection.
   */
  async startConnection(): Promise<void> {
    this.manuallyStopped = false;

    if (
      this.hubConnection?.state === signalR.HubConnectionState.Connected ||
      this.hubConnection?.state === signalR.HubConnectionState.Connecting ||
      this.hubConnection?.state === signalR.HubConnectionState.Reconnecting
    ) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.connect();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = undefined;
    }
  }

  private async connect(): Promise<void> {
    try {
      const signalrUrl = this.apiConfig.getSignalrUrl();

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(signalrUrl)
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

      this.hubConnection = connection;

      connection.on('OrderUpdated', (orderId: number) => {
        this.orderUpdatedSource.next(orderId);
      });

      connection.on('OrderSettled', (orderSettle: number) => {
        this.orderSettledSource.next(orderSettle);
      });     
      
      connection.on('TableStatus', (update: unknown) => {
        this.tableStatusSource.next(update);
      }); 

      connection.onreconnecting(err =>
        console.warn('⚠️ SignalR reconnecting...', err)
      );
      connection.onreconnected(id => {
        this.clearRetryTimer();
        console.log('✅ SignalR reconnected', id);
      });
      connection.onclose(err => {
        if (this.hubConnection === connection) {
          this.hubConnection = undefined;
        }
        console.error('❌ SignalR connection closed', err);
        this.scheduleReconnect();
      });

      await connection.start();
      this.clearRetryTimer();
      console.log('✅ SignalR Connected');
    } catch (error) {
      console.error('❌ SignalR connection error:', error);
      this.hubConnection = undefined; // allow a retry on next startConnection()
      this.scheduleReconnect();
      throw error;
    }
  }

  async stopConnection(): Promise<void> {
    this.manuallyStopped = true;
    this.clearRetryTimer();

    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyStopped || !localStorage.getItem('userid') || this.retryTimer) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.startConnection().catch(() => this.scheduleReconnect());
    }, 5000);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  ngOnDestroy(): void {
    this.manuallyStopped = true;
    this.clearRetryTimer();
    this.orderUpdatedSource.complete();
    this.orderSettledSource.complete();
    this.tableStatusSource.complete();
    this.hubConnection?.stop();
  }
}

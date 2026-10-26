import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';

@Injectable({
  providedIn: 'root'
})
export class KotSignalrService {

  private hubConnection!: signalR.HubConnection;

  constructor(private http: HttpClient) {}

  async startConnection(): Promise<void> {

    try {

      const config: any = await this.http
        .get('assets/config.json')
        .toPromise();

      const signalrUrl = config.signalrUrl;

      console.log('SignalR URL:', signalrUrl);

      this.hubConnection = new signalR.HubConnectionBuilder()
        // The token lets the hub put this connection in its branch group (only that branch's KOT events).
        .withUrl(signalrUrl, { accessTokenFactory: () => localStorage.getItem('authToken') || '' })
        .withAutomaticReconnect()
        .build();

      // Listener for OrderUpdated
      this.hubConnection.on('OrderUpdated', (orderId: any) => {
        console.log('🔥 SignalR OrderUpdated received:', orderId);
        window.dispatchEvent(
          new CustomEvent('kot-order-updated', {
            detail: orderId
          })
        );
      });

      // Listener for OrderSettled
      this.hubConnection.on('OrderSettled', (settlementDetail: any) => {
        console.log('💰 SignalR OrderSettled received:', settlementDetail);
        window.dispatchEvent(
          new CustomEvent('kot-order-settled', {
            detail: settlementDetail
          })
        );
      });

      await this.hubConnection.start();

      console.log('✅ SignalR Connected');

    } catch (error) {
      console.error('❌ SignalR connection error:', error);
    }
  }

  onOrderUpdated(callback: (orderId: any) => void) {
    window.addEventListener('kot-order-updated', (event: any) => {
      const orderId = event.detail;
      console.log('📢 KOT update callback:', orderId);
      callback(orderId);
    });
  }

  onOrderSettled(callback: (settlementDetail: any) => void) {
    window.addEventListener('kot-order-settled', (event: any) => {
      const settlementDetail = event.detail;
      console.log('📢 KOT settled callback:', settlementDetail);
      callback(settlementDetail);
    });
  }
}
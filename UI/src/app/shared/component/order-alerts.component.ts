import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LiveHubService } from '@appservices/live-hub.service';
import { AuthService } from '@appservices/auth.service';

// One alert from the API ("OrderAlert"): reorder / cancel / ready to serve / delayed order.
export interface OrderAlert {
  id: string;
  type: 'edited' | 'added' | 'cancelled' | 'readytoserve' | 'kitchendelay' | 'pickupdelay' | string;
  title: string;
  message: string;
  orderId: number;
  orderNumber?: string;
  tableName?: string;
  items: string[];
  byUserId?: number | null;
  at: string;
  read?: boolean;
}

// Header bell + pop-up toasts. The API sends each alert only to the people it concerns
// (kitchen = chefs of the branch, captain = the user who took the order), live over SignalR.
@Component({
  selector: 'app-order-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oa-wrap">
      <button type="button" class="oa-bell" (click)="toggle($event)" [attr.aria-expanded]="open"
              [attr.aria-label]="unread ? unread + ' new notifications' : 'Notifications'" title="Notifications">
        <i class="pi pi-bell"></i>
        @if (unread) { <span class="oa-badge">{{ unread > 9 ? '9+' : unread }}</span> }
      </button>

      @if (open) {
        <div class="oa-panel" (click)="$event.stopPropagation()">
          <div class="oa-panel-head">
            <strong>Notifications</strong>
            @if (alerts.length) {
              <button type="button" class="btn btn-link btn-sm p-0" (click)="clearAll()">Clear all</button>
            }
          </div>
          @if (!alerts.length) {
            <p class="oa-empty">No notifications yet.</p>
          }
          @for (a of alerts; track a.id) {
            <button type="button" class="oa-item" [class.oa-unread]="!a.read" (click)="openAlert(a)">
              <span class="oa-dot" [ngClass]="'oa-' + a.type"></span>
              <span class="oa-text">
                <span class="oa-title">{{ a.title }}</span>
                <span class="oa-msg">{{ a.message }}</span>
                <span class="oa-time">{{ a.at | date: 'h:mm a' }}</span>
              </span>
            </button>
          }
        </div>
      }
    </div>

    <div class="oa-toasts" aria-live="polite">
      @for (t of toasts; track t.id) {
        <div class="oa-toast" [ngClass]="'oa-t-' + t.type" role="status">
          <div class="oa-toast-body" (click)="openAlert(t)">
            <strong>{{ t.title }}</strong>
            <span>{{ t.message }}</span>
          </div>
          <button type="button" class="btn-close btn-sm" aria-label="Close" (click)="dismiss(t)"></button>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: flex; align-items: center; }
    .oa-wrap { position: relative; }
    .oa-bell { position: relative; border: 0; background: transparent; font-size: 1.25rem; padding: 6px 10px; color: inherit; }
    .oa-badge { position: absolute; top: 0; right: 2px; min-width: 18px; height: 18px; border-radius: 9px; background: #dc2626; color: #fff;
                font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; padding: 0 4px; }
    .oa-panel { position: absolute; right: 0; top: calc(100% + 6px); width: min(360px, calc(100vw - 32px)); max-height: 70vh; overflow-y: auto;
                background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.15); z-index: 1060; }
    .oa-panel-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .oa-empty { padding: 16px 12px; margin: 0; color: #6b7280; }
    .oa-item { display: flex; gap: 10px; width: 100%; text-align: left; border: 0; border-bottom: 1px solid #f1f5f9; background: #fff; padding: 10px 12px; }
    .oa-item:hover { background: #f8fafc; }
    .oa-unread { background: #eff6ff; }
    .oa-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; background: #64748b; }
    .oa-text { display: flex; flex-direction: column; min-width: 0; }
    .oa-title { font-weight: 600; }
    .oa-msg { font-size: 13px; color: #374151; overflow-wrap: anywhere; }
    .oa-time { font-size: 12px; color: #9ca3af; }
    .oa-readytoserve { background: #16a34a; } .oa-edited, .oa-added { background: #2563eb; } .oa-cancelled { background: #dc2626; }
    .oa-kitchendelay, .oa-pickupdelay { background: #d97706; } .oa-printfailed { background: #dc2626; }
    .oa-toasts { position: fixed; top: 72px; right: 16px; left: 16px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; z-index: 2000; pointer-events: none; }
    .oa-toast { pointer-events: auto; width: min(380px, 100%); display: flex; gap: 8px; align-items: flex-start; background: #fff; border-left: 5px solid #64748b;
                border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.18); padding: 10px 12px; }
    .oa-toast-body { flex: 1; display: flex; flex-direction: column; cursor: pointer; min-width: 0; overflow-wrap: anywhere; }
    .oa-t-readytoserve { border-left-color: #16a34a; } .oa-t-edited, .oa-t-added { border-left-color: #2563eb; } .oa-t-cancelled { border-left-color: #dc2626; }
    .oa-t-kitchendelay, .oa-t-pickupdelay { border-left-color: #d97706; } .oa-t-printfailed { border-left-color: #dc2626; }
  `
})
export class OrderAlertsComponent implements OnInit, OnDestroy {

  private static readonly MAX = 30;
  private static readonly TOAST_MS = 10000;
  private static readonly DELAY_TOAST_MS = 20000;

  alerts: OrderAlert[] = [];
  toasts: OrderAlert[] = [];
  open = false;

  private sub?: Subscription;
  private myUserId = 0;
  private audio?: AudioContext;
  private toastTimers = new Map<string, any>();

  constructor(private hub: LiveHubService, private auth: AuthService, private router: Router) {}

  get unread(): number {
    return this.alerts.filter(a => !a.read).length;
  }

  ngOnInit(): void {
    this.myUserId = this.userIdFromToken();
    this.sub = this.hub.on<OrderAlert>('OrderAlert').subscribe(a => this.receive(a));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.toastTimers.forEach(t => clearTimeout(t));
    this.audio?.close().catch(() => { });
  }

  // Browsers allow sound only after the user touched the page once.
  @HostListener('document:pointerdown')
  unlockSound(): void {
    if (!this.audio) {
      try { this.audio = new AudioContext(); } catch { }
    } else if (this.audio.state === 'suspended') {
      this.audio.resume().catch(() => { });
    }
  }

  @HostListener('document:click')
  closePanel(): void {
    this.open = false;
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open = !this.open;
  }

  openAlert(a: OrderAlert): void {
    a.read = true;
    this.dismiss(a);
    this.open = false;
    const isCaptain = this.auth.getUserRole().toLowerCase() === 'captain';
    this.router.navigate([isCaptain ? '/kot-list/captain' : '/kot-list']);
  }

  dismiss(a: OrderAlert): void {
    clearTimeout(this.toastTimers.get(a.id));
    this.toastTimers.delete(a.id);
    this.toasts = this.toasts.filter(t => t.id !== a.id);
  }

  clearAll(): void {
    this.alerts = [];
  }

  private receive(a: OrderAlert): void {
    // A user in several hub groups (own user + role, e.g. an owner) gets the same alert once per group.
    if (this.alerts.some(x => x.id === a.id)) return;
    // Your own changes are shown too (read): confirmation that the kitchen / captain were told.
    a.read = !!a.byUserId && a.byUserId === this.myUserId;
    this.alerts = [a, ...this.alerts].slice(0, OrderAlertsComponent.MAX);
    this.toasts = [a, ...this.toasts].slice(0, 4);
    const delay = a.type === 'kitchendelay' || a.type === 'pickupdelay';
    this.toastTimers.set(a.id, setTimeout(() => this.dismiss(a), delay ? OrderAlertsComponent.DELAY_TOAST_MS : OrderAlertsComponent.TOAST_MS));
    if (!a.read) this.beep(delay || a.type === 'cancelled' ? 3 : 2);
  }

  private beep(times: number): void {
    const ctx = this.audio;
    if (!ctx || ctx.state !== 'running') return;
    try {
      for (let i = 0; i < times; i++) {
        const start = ctx.currentTime + i * 0.25;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.2);
      }
    } catch { }
  }

  // The login token carries the user id (claim "userid").
  private userIdFromToken(): number {
    try {
      const token = localStorage.getItem('authToken') || '';
      const part = token.split('.')[1];
      if (!part) return 0;
      const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
      return Number(json.userid) || 0;
    } catch {
      return 0;
    }
  }
}

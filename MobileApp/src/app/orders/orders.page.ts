import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, chevronDownOutline, chevronUpOutline, receiptOutline } from 'ionicons/icons';
import { debounceTime, merge } from 'rxjs';
import { QueryService, isoDate } from '../core/services/query.service';
import { LiveHubService } from '../core/services/live-hub.service';
import { UiService } from '../core/services/ui.service';
import { apiError } from '../core/guards/auth-interceptor.service';

type Status = 'all' | 'submitted' | 'printed' | 'approved' | 'cancelled';

// Order history for a day (web: /order-histroy). View only: orders are not cancelled from the mobile app.
@Component({
  selector: 'app-orders',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonRefresher, IonRefresherContent, DatePipe, DecimalPipe, FormsModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Orders <span class="sub-title">{{ count() }} order{{ count() === 1 ? '' : 's' }} · ₹{{ sum() | number:'1.0-2' }}</span></ion-title>
        <label class="date" slot="end">
          <ion-icon name="calendar-outline"></ion-icon>
          <input type="date" [ngModel]="date()" (ngModelChange)="setDate($event)" [max]="today" />
        </label>
      </ion-toolbar>
      <ion-toolbar class="chips-bar">
        <div class="chip-row">
          @for (s of statuses; track s.id) {
            <button class="pill" [class.active]="status() === s.id" (click)="setStatus(s.id)">{{ s.label }}</button>
          }
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
      @if (loading()) {
        <div class="list">@for (i of [1,2,3,4]; track i) { <div class="skeleton sk"></div> }</div>
      } @else if (!orders().length) {
        <div class="empty"><ion-icon name="receipt-outline"></ion-icon><h3>No orders</h3><p>Nothing for this day and filter.</p></div>
      } @else {
        <div class="list">
          @for (o of orders(); track o.orderid) {
            <div class="card ord">
              <button class="ord-head" (click)="toggle(o.orderid)">
                <div class="l">
                  <div class="no">{{ o.ordernumber || o.orderid }}</div>
                  <div class="meta">{{ o.ordertype || 'Order' }} · {{ o.timedate | date:'h:mm a' }} · {{ o.orderdetail?.length || 0 }} item{{ o.orderdetail?.length === 1 ? '' : 's' }}</div>
                </div>
                <div class="r">
                  <div class="amt money">₹{{ o.totalprice | number:'1.0-2' }}</div>
                  <span class="badge" [class]="'badge ' + badge(o.status).cls">{{ badge(o.status).label }}</span>
                </div>
                <ion-icon [name]="open() === o.orderid ? 'chevron-up-outline' : 'chevron-down-outline'" class="chev"></ion-icon>
              </button>
              @if (open() === o.orderid) {
                <div class="ord-body">
                  @for (d of o.orderdetail; track d.orderdetailid) {
                    <div class="ln"><span><b>{{ d.qty }}×</b> {{ d.name }}</span><span class="money">₹{{ d.sumofprice | number:'1.0-2' }}</span></div>
                  }
                  @if (o.comments) { <p class="muted cm">“{{ o.comments }}”</p> }
                </div>
              }
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .date { position: relative; display: inline-flex; align-items: center; gap: 4px; margin-right: 12px; padding: 6px 10px;
      border: 1px solid var(--app-border); border-radius: 10px; font-size: 13px; color: var(--app-text);
      input { border: 0; background: transparent; color: inherit; font: inherit; width: 118px; outline: none; } }
    .chips-bar { --min-height: 48px; }
    .list { padding: 12px 16px 24px; }
    .sk { height: 72px; margin-bottom: 10px; }
    .ord { padding: 0; overflow: hidden; }
    .ord-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 0; background: transparent; color: var(--app-text); text-align: left; }
    .l { flex: 1; min-width: 0; } .no { font-weight: 800; font-size: 16px; }
    .meta { font-size: 12px; color: var(--app-muted); margin-top: 2px; }
    .r { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; } .amt { font-weight: 800; font-size: 15px; }
    .chev { color: var(--app-muted); font-size: 18px; }
    .ord-body { border-top: 1px solid var(--app-border); padding: 10px 14px 14px; }
    .ln { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; }
    .cm { font-size: 13px; font-style: italic; margin: 6px 0; }
  `],
})
export class OrdersPage {
  private query = inject(QueryService);
  private hub = inject(LiveHubService);
  private ui = inject(UiService);

  readonly today = isoDate();
  readonly statuses: { id: Status; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'submitted', label: 'Open' }, { id: 'printed', label: 'Bill printed' },
    { id: 'approved', label: 'Settled' }, { id: 'cancelled', label: 'Cancelled' },
  ];
  readonly date = signal(this.today);
  readonly status = signal<Status>('all');
  readonly orders = signal<any[]>([]);
  readonly loading = signal(true);
  readonly open = signal<number | null>(null);
  readonly count = computed(() => this.orders().length);
  readonly sum = computed(() => this.orders().filter(o => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.totalprice) || 0), 0));

  constructor() {
    addIcons({ calendarOutline, chevronDownOutline, chevronUpOutline, receiptOutline });
    merge(this.hub.on('OrderUpdated'), this.hub.on('OrderSettled'), this.hub.resync$)
      .pipe(debounceTime(800), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => { if (this.date() === isoDate()) this.load(); });
  }

  ionViewWillEnter(): void {
    this.load();
  }

  setDate(d: string): void {
    if (!d) return;
    this.date.set(d);
    this.loading.set(true);
    this.load();
  }

  setStatus(s: Status): void {
    this.status.set(s);
    this.loading.set(true);
    this.load();
  }

  toggle(id: number): void {
    this.open.set(this.open() === id ? null : id);
  }

  load(done?: () => void): void {
    const d = this.date(), s = this.status();
    this.query.getOrdersForReport({ fromDate: d, toDate: d, status: s, ordertypeid: 0 }).subscribe({
      next: (res: any) => {
        if (d !== this.date() || s !== this.status()) return;
        this.orders.set(res?.data || []);
        this.loading.set(false);
        done?.();
      },
      error: err => {
        this.loading.set(false);
        done?.();
        this.ui.toast(apiError(err, 'Could not load orders'), 'error');
      },
    });
  }

  refresh(ev: any): void {
    this.load(() => ev.target.complete());
  }

  badge(status: string): { label: string; cls: string } {
    switch (status) {
      case 'submitted': return { label: 'Open', cls: 'b-warning' };
      case 'printed': return { label: 'Bill printed', cls: 'b-primary' };
      case 'approved': return { label: 'Settled', cls: 'b-success' };
      case 'cancelled': return { label: 'Cancelled', cls: 'b-danger' };
      default: return { label: status || '—', cls: 'b-muted' };
    }
  }

}

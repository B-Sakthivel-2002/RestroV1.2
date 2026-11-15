import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cashOutline, giftOutline, receiptOutline, statsChartOutline, timeOutline, trendingUpOutline, walletOutline } from 'ionicons/icons';
import { debounceTime } from 'rxjs';
import { QueryService, isoDate } from '../core/services/query.service';
import { LiveHubService } from '../core/services/live-hub.service';
import { AuthService } from '../core/services/auth.service';
import { UiService } from '../core/services/ui.service';
import { apiError } from '../core/guards/auth-interceptor.service';

type Range = 'today' | 'yesterday' | 'week' | 'month';

interface Slice { label: string; value: number; pct: number; }

// Owner / branch head sales summary from Bill/GetBillOrderReport. Cancelled bills are listed by the
// API but never counted, the same rule as the web reports.
@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonRefresher, IonRefresherContent, DecimalPipe, DatePipe],
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage {
  private query = inject(QueryService);
  private hub = inject(LiveHubService);
  private ui = inject(UiService);
  readonly auth = inject(AuthService);

  readonly ranges: { id: Range; label: string }[] = [
    { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'week', label: '7 days' }, { id: 'month', label: 'This month' },
  ];
  readonly range = signal<Range>('today');
  readonly bills = signal<any[]>([]);
  readonly loading = signal(true);

  readonly counted = computed(() => this.bills().filter(b => String(b.lifecyclestatus).toLowerCase() !== 'cancelled'));
  readonly stats = computed(() => {
    const list = this.counted();
    const sum = (f: (b: any) => number) => list.reduce((s, b) => s + (f(b) || 0), 0);
    const total = sum(b => Number(b.totalamount));
    const comp = list.filter(b => b.iscomplementary);
    const paid = list.filter(b => !b.iscomplementary && String(b.status).toLowerCase() === 'paid');
    const unpaid = list.filter(b => !b.iscomplementary && String(b.status).toLowerCase() !== 'paid');
    return {
      total,
      count: list.length,
      avg: list.length ? total / list.length : 0,
      paid: paid.reduce((s, b) => s + (Number(b.totalamount) || 0), 0),
      unpaid: unpaid.reduce((s, b) => s + (Number(b.totalamount) || 0), 0),
      unpaidCount: unpaid.length,
      comp: comp.reduce((s, b) => s + (Number(b.totalamount) || 0), 0),
      compCount: comp.length,
      tax: sum(b => Number(b.tax)),
      discount: sum(b => Number(b.discount)),
      cancelled: this.bills().length - list.length,
    };
  });
  readonly byMode = computed(() => this.slices(
    this.counted().filter(b => !b.iscomplementary && String(b.status).toLowerCase() === 'paid'),
    b => (String(b.paymentmode || 'other').trim() || 'other').toUpperCase(),
  ));
  readonly byType = computed(() => this.slices(this.counted(), b => b.orders?.[0]?.orderType || 'Other'));
  readonly topItems = computed(() => {
    const m = new Map<string, { name: string; qty: number; amount: number }>();
    for (const b of this.counted()) for (const o of b.orders || []) for (const d of o.orderDetails || []) {
      const key = d.name || ('#' + d.itemid);
      const x = m.get(key) || { name: key, qty: 0, amount: 0 };
      x.qty += Number(d.qty) || 0;
      x.amount += Number(d.sumofprice) || 0;
      m.set(key, x);
    }
    const list = [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
    const max = list[0]?.qty || 1;
    return list.map(x => ({ ...x, pct: Math.round((x.qty / max) * 100) }));
  });
  readonly recent = computed(() => [...this.bills()].sort((a, b) => b.billid - a.billid).slice(0, 12));

  constructor() {
    addIcons({ cashOutline, giftOutline, receiptOutline, statsChartOutline, timeOutline, trendingUpOutline, walletOutline });
    // A settled bill updates today's numbers live.
    this.hub.on('OrderSettled').pipe(debounceTime(1500), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => { if (this.range() === 'today') this.load(); });
  }

  ionViewWillEnter(): void {
    this.load();
  }

  setRange(r: Range): void {
    this.range.set(r);
    this.loading.set(true);
    this.load();
  }

  private period(): { from: string; to: string } {
    const now = new Date();
    switch (this.range()) {
      case 'yesterday': {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        return { from: isoDate(y), to: isoDate(y) };
      }
      case 'week': {
        const s = new Date(now); s.setDate(s.getDate() - 6);
        return { from: isoDate(s), to: isoDate(now) };
      }
      case 'month':
        return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
      default:
        return { from: isoDate(now), to: isoDate(now) };
    }
  }

  load(done?: () => void): void {
    const r = this.range();
    const p = this.period();
    this.query.getBillReport({ fromDate: p.from, toDate: p.to, status: 'all', orderType: '' }).subscribe({
      next: (res: any) => {
        if (r !== this.range()) return;
        this.bills.set(res?.data || []);
        this.loading.set(false);
        done?.();
      },
      error: err => {
        this.loading.set(false);
        done?.();
        this.ui.toast(apiError(err, 'Could not load sales'), 'error');
      },
    });
  }

  refresh(ev: any): void {
    this.load(() => ev.target.complete());
  }

  billBadge(b: any): { label: string; cls: string } {
    if (String(b.lifecyclestatus).toLowerCase() === 'cancelled') return { label: 'Cancelled', cls: 'b-danger' };
    if (b.iscomplementary) return { label: 'Complimentary', cls: 'b-muted' };
    if (String(b.status).toLowerCase() === 'paid') return { label: (b.paymentmode || 'Paid').toUpperCase(), cls: 'b-success' };
    return { label: 'Unpaid', cls: 'b-warning' };
  }

  private slices(list: any[], key: (b: any) => string): Slice[] {
    const m = new Map<string, number>();
    for (const b of list) m.set(key(b), (m.get(key(b)) || 0) + (Number(b.totalamount) || 0));
    const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    return [...m.entries()].map(([label, value]) => ({ label, value, pct: Math.round((value / total) * 100) })).sort((a, b) => b.value - a.value);
  }
}

import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonButtons, IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chatbubbleEllipsesOutline, checkmarkDoneOutline, checkmarkOutline, flameOutline, handLeftOutline, personOutline, timeOutline } from 'ionicons/icons';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { debounceTime, merge } from 'rxjs';
import { QueryService, isoDate } from '../core/services/query.service';
import { LiveHubService } from '../core/services/live-hub.service';
import { UiService } from '../core/services/ui.service';
import { apiError } from '../core/guards/auth-interceptor.service';
import { AuthService } from '../core/services/auth.service';

type Mode = 'kitchen' | 'pickup';
type Filter = 'submitted' | 'approved' | 'cancelled';

// KOT list (web: /kot-list and /kot-list/captain).
// Kitchen: a new item has no KOT status; the chef marks it "readytoserve".
// Pickup: the captain marks ready items "submitted" (picked up).
@Component({
  selector: 'app-kot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonIcon, IonRefresher, IonRefresherContent],
  templateUrl: './kot.page.html',
  styleUrls: ['./kot.page.scss'],
})
export class KotPage {
  private query = inject(QueryService);
  private hub = inject(LiveHubService);
  private ui = inject(UiService);
  readonly liveStatus = this.hub.status;

  private auth = inject(AuthService);
  /** Kitchen (chef marks ready) or Captain (marks ready items served). Admin / owner can switch. */
  readonly mode = signal<Mode>((inject(ActivatedRoute).snapshot.data['mode'] as Mode) || 'kitchen');
  readonly canSwitch = this.auth.isAdmin;
  readonly filter = signal<Filter>('submitted');
  readonly orders = signal<any[]>([]);
  readonly loading = signal(true);

  /** Kitchen: oldest first. Pickup: orders with something ready first. */
  readonly sorted = computed(() => {
    const list = [...this.orders()];
    if (this.mode() === 'pickup' && this.filter() === 'submitted') {
      return list.sort((a, b) => Number(this.readyCount(b) > 0) - Number(this.readyCount(a) > 0) || a.orderid - b.orderid);
    }
    return this.filter() === 'submitted' ? list.sort((a, b) => a.orderid - b.orderid) : list.sort((a, b) => b.orderid - a.orderid);
  });
  readonly pendingItems = computed(() => this.orders().reduce((s, o) => s + o.orderdetails.filter((d: any) => !d.kotStatus).length, 0));
  readonly readyItems = computed(() => this.orders().reduce((s, o) => s + this.readyCount(o), 0));

  private seen = new Set<string>();
  private first = true;

  constructor() {
    addIcons({ chatbubbleEllipsesOutline, checkmarkDoneOutline, checkmarkOutline, flameOutline, handLeftOutline, personOutline, timeOutline });
    merge(this.hub.on('OrderUpdated'), this.hub.on('OrderAlert'), this.hub.resync$)
      .pipe(debounceTime(600), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.load());
  }

  ionViewWillEnter(): void {
    this.load();
  }

  setMode(m: Mode): void {
    if (this.mode() === m) return;
    this.mode.set(m);
    this.first = true; // no buzz for what is already on the list
  }

  setFilter(f: Filter): void {
    if (this.filter() === f) return;
    this.filter.set(f);
    this.loading.set(true);
    this.orders.set([]);
    this.load();
  }

  load(done?: () => void): void {
    const today = isoDate();
    const filter = this.filter();
    this.query.getOrdersForKot({ fromDate: today, toDate: today, status: filter, ordertypeid: 0 }).subscribe({
      next: (res: any) => {
        if (filter !== this.filter()) return;
        const list = (res?.data || []).map((o: any) => ({ ...o, orderdetails: o.orderdetails || [] }));
        this.alertNew(list);
        this.orders.set(list);
        this.loading.set(false);
        done?.();
      },
      error: err => {
        this.loading.set(false);
        done?.();
        this.ui.toast(apiError(err, 'Could not load KOTs'), 'error');
      },
    });
  }

  refresh(ev: any): void {
    this.load(() => ev.target.complete());
  }

  // Buzz when a new item needs the kitchen, or a new item is ready for the captain.
  private alertNew(list: any[]): void {
    if (this.filter() !== 'submitted') return;
    let fresh = false;
    for (const o of list) {
      for (const d of o.orderdetails) {
        const wanted = this.mode() === 'kitchen' ? !d.kotStatus : d.kotStatus === 'readytoserve';
        const key = d.orderdetailid + ':' + (d.kotStatus || '');
        if (wanted && !this.seen.has(key)) {
          this.seen.add(key);
          fresh = true;
        }
      }
    }
    if (fresh && !this.first) Haptics.notification({ type: NotificationType.Warning }).catch(() => { });
    this.first = false;
  }

  readyCount(o: any): number {
    return o.orderdetails.filter((d: any) => d.kotStatus === 'readytoserve').length;
  }

  pendingCount(o: any): number {
    return o.orderdetails.filter((d: any) => !d.kotStatus).length;
  }

  canAct(d: any): boolean {
    if (this.filter() !== 'submitted') return false;
    return this.mode() === 'kitchen' ? !d.kotStatus : d.kotStatus === 'readytoserve';
  }

  itemState(d: any): string {
    if (d.kotStatus === 'readytoserve') return 'ready';
    if (d.kotStatus === 'submitted') return 'served';
    return 'pending';
  }

  act(o: any, d: any): void {
    this.update(o, [d]);
  }

  actAll(o: any): void {
    this.update(o, o.orderdetails.filter((d: any) => this.canAct(d)));
  }

  private update(o: any, items: any[]): void {
    if (!items.length) return;
    this.ui.tap();
    const next = this.mode() === 'kitchen' ? 'readytoserve' : 'submitted';
    const ids = new Set(items.map(d => d.orderdetailid));
    const before = this.orders();
    // Optimistic: the list changes at once; a failure puts it back.
    this.orders.set(before.map(x => x.orderid !== o.orderid ? x : {
      ...x, orderdetails: x.orderdetails.map((d: any) => ids.has(d.orderdetailid) ? { ...d, kotStatus: next } : d),
    }));
    this.query.updateKotStatus(items.map(d => ({ orderDetailId: d.orderdetailid, kotStatus: next }))).subscribe({
      error: err => {
        this.orders.set(before);
        this.ui.toast(apiError(err, 'Could not update the item'), 'error');
      },
    });
  }
}

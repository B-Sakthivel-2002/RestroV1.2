import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, IonButtons,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, refreshOutline, gridOutline, timeOutline } from 'ionicons/icons';
import { debounceTime, forkJoin, merge } from 'rxjs';
import { QueryService } from '../core/services/query.service';
import { LiveHubService } from '../core/services/live-hub.service';
import { AuthService } from '../core/services/auth.service';
import { UiService } from '../core/services/ui.service';
import { apiError } from '../core/guards/auth-interceptor.service';

// Same four looks as the web Dine in screen: Available (white), Order in Kitchen (red),
// Ready for bill (green), Merged (red). Keep both in step.
type TileKind = 'free' | 'kitchen' | 'billed' | 'merged';

interface Tile {
  t: any;
  kind: TileKind;
  label: string;
  sub: string;
}

@Component({
  selector: 'app-dinein',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonIcon, IonRefresher, IonRefresherContent, DecimalPipe],
  templateUrl: './dinein.page.html',
  styleUrls: ['./dinein.page.scss'],
})
export class DineinPage {
  private query = inject(QueryService);
  private hub = inject(LiveHubService);
  private router = inject(Router);
  private ui = inject(UiService);
  readonly auth = inject(AuthService);
  readonly liveStatus = this.hub.status;

  readonly floors = signal<any[]>([]);
  readonly tables = signal<any[]>([]);
  readonly loading = signal(true);
  readonly floorId = signal<number | null>(null);

  readonly tiles = computed<Tile[]>(() => this.tables().map(t => DineinPage.tile(t)));
  readonly visible = computed(() => {
    const f = this.floorId();
    return this.tiles().filter(x => f == null || x.t.floorid === f);
  });
  readonly counts = computed(() => {
    const c = { free: 0, kitchen: 0, billed: 0, merged: 0 };
    for (const x of this.visible()) c[x.kind]++;
    return c;
  });

  constructor() {
    addIcons({ peopleOutline, refreshOutline, gridOutline, timeOutline });
    const snap = this.query.tablesSnapshot;
    if (snap) {
      this.floors.set(snap.floors);
      this.tables.set(snap.tables);
      this.pickFloor();
      this.loading.set(false);
    }
    // Live: any order, bill, table or token change in the branch reloads the board.
    merge(
      this.hub.on('OrderUpdated'), this.hub.on('OrderSettled'), this.hub.on('TableStatus'),
      this.hub.on('WaitlistChanged'), this.hub.resync$,
    ).pipe(debounceTime(400), takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.load());
  }

  ionViewWillEnter(): void {
    this.load();
  }

  load(done?: () => void): void {
    forkJoin({ floors: this.query.getActiveFloors(), tables: this.query.getActiveTables() }).subscribe({
      next: res => {
        this.floors.set(res.floors?.data || []);
        this.tables.set(res.tables?.data || []);
        this.query.tablesSnapshot = { floors: this.floors(), tables: this.tables() };
        this.pickFloor();
        this.loading.set(false);
        done?.();
      },
      error: err => {
        this.loading.set(false);
        done?.();
        if (!this.tables().length) this.ui.toast(apiError(err, 'Could not load tables'), 'error');
      },
    });
  }

  refresh(ev: any): void {
    this.query.clearCache();
    this.load(() => ev.target.complete());
  }

  private pickFloor(): void {
    const fl = this.floors();
    if (this.floorId() != null && !fl.some(f => f.floorid === this.floorId())) this.floorId.set(null);
    if (this.floorId() == null && fl.length) this.floorId.set(fl[0].floorid);
  }

  floorCount(floorId: number): number {
    return this.tables().filter(t => t.floorid === floorId && !!t.orderStatus).length;
  }

  open(x: Tile): void {
    this.ui.tap();
    const t = x.t;
    const main = t.mergedinto ? this.tables().find(m => m.tableid === t.mergedinto) : null;
    const target = main || t;
    this.router.navigate(['/order', target.tableid, target.floorid, 1, target.tablename]);
  }

  // Same rules and wording as the web Dine in tiles (UI dinein.component.ts).
  static tile(t: any): Tile {
    if (t.mergedinto) return { t, kind: 'merged', label: 'Merged', sub: 'with ' + (t.mergedintoname || '') };
    const sub = t.seatedToken ? `Occupied by ${t.seatedToken}${t.seatedName ? ' · ' + t.seatedName : ''}`
      : t.tablestate === 'Reserved' && t.tokencode ? `Reserved for ${t.tokencode}` : '';
    if (t.orderStatus === 'submitted') return { t, kind: 'kitchen', label: 'Order in Kitchen', sub };
    if (t.orderStatus === 'printed') return { t, kind: 'billed', label: 'Ready for bill', sub };
    return { t, kind: 'free', label: 'Available', sub };
  }
}

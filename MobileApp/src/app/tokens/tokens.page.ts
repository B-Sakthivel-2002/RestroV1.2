import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonModal, IonRefresher, IonRefresherContent,
  IonTitle, IonToolbar, ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, callOutline, checkmarkDoneOutline, closeCircleOutline, megaphoneOutline, peopleOutline, swapHorizontalOutline,
  ticketOutline, timeOutline, closeOutline, gridOutline,
} from 'ionicons/icons';
import { debounceTime, filter, forkJoin, merge } from 'rxjs';
import { QueryService } from '../core/services/query.service';
import { LiveHubService } from '../core/services/live-hub.service';
import { UiService } from '../core/services/ui.service';
import { AuthService } from '../core/services/auth.service';
import { apiError } from '../core/guards/auth-interceptor.service';
import { TokenFormComponent } from './token-form.component';

// Waitlist token queue (web: /waitlist): issue, call, assign tables, seat, no-show, cancel.
// Reloads on the branch's WaitlistChanged / order / table events; no polling. A local 30 s tick keeps
// "waiting N min" current, on the server's clock.
@Component({
  selector: 'app-tokens',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonFab, IonFabButton, IonModal, DatePipe],
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.scss'],
})
export class TokensPage {
  private query = inject(QueryService);
  private hub = inject(LiveHubService);
  private ui = inject(UiService);
  private modalCtrl = inject(ModalController);
  readonly auth = inject(AuthService);
  readonly liveStatus = this.hub.status;

  readonly tab = signal<'queue' | 'history'>('queue');
  readonly loading = signal(true);
  readonly tokens = signal<any[]>([]);
  readonly summary = signal<any>(null);
  readonly floors = signal<any[]>([]);
  readonly tables = signal<any[]>([]);
  readonly busyId = signal<number | null>(null);
  readonly now = signal(Date.now());

  readonly active = computed(() => this.tokens().filter(t => t.status === 'Waiting' || t.status === 'Called'));
  readonly closed = computed(() => this.tokens().filter(t => t.status !== 'Waiting' && t.status !== 'Called').reverse());
  readonly freeTables = computed(() => this.tables()
    .filter(t => t.state === 'Available' && !t.mergedinto && !t.mergedtables?.length)
    .sort((a, b) => a.floorid - b.floorid || a.capacity - b.capacity || String(a.tablename).localeCompare(String(b.tablename))));

  // Table picker sheet
  readonly pickToken = signal<any>(null);
  readonly picked = signal<number[]>([]);
  readonly pickedSeats = computed(() => this.tables().filter(t => this.picked().includes(t.tableid)).reduce((s, t) => s + (t.capacity || 0), 0));
  readonly pickedNames = computed(() => this.tables().filter(t => this.picked().includes(t.tableid)).map(t => t.tablename).join(' + '));

  private clockOffset = 0;
  private loadingNow = false;
  private reloadAgain = false;

  constructor() {
    addIcons({
      add, callOutline, checkmarkDoneOutline, closeCircleOutline, megaphoneOutline, peopleOutline, swapHorizontalOutline,
      ticketOutline, timeOutline, closeOutline, gridOutline,
    });
    const destroyRef = inject(DestroyRef);
    merge(
      this.hub.on<any>('WaitlistChanged').pipe(filter(e => e?.branchId == null || e.branchId === this.summary()?.branchId)),
      this.hub.on('OrderUpdated'), this.hub.on('OrderSettled'), this.hub.on('TableStatus'), this.hub.resync$,
    ).pipe(debounceTime(400), takeUntilDestroyed(destroyRef)).subscribe(() => this.load());
    const tick = setInterval(() => this.now.set(Date.now() + this.clockOffset), 30000);
    destroyRef.onDestroy(() => clearInterval(tick));
  }

  ionViewWillEnter(): void {
    this.load();
  }

  load(done?: () => void): void {
    if (this.loadingNow) {
      this.reloadAgain = true;
      done?.();
      return;
    }
    this.loadingNow = true;
    forkJoin({ wl: this.query.getWaitlist(), board: this.query.getTableBoard() }).subscribe({
      next: ({ wl, board }) => {
        this.tokens.set(wl?.data || []);
        this.summary.set(wl?.summary || null);
        if (wl?.summary?.serverTime) this.clockOffset = new Date(wl.summary.serverTime).getTime() - Date.now();
        this.now.set(Date.now() + this.clockOffset);
        this.floors.set(board?.data?.floors || []);
        this.tables.set(board?.data?.tables || []);
        this.finishLoad(done);
      },
      error: err => {
        this.finishLoad(done);
        this.ui.toast(apiError(err, 'Could not load the queue'), 'error');
      },
    });
  }

  private finishLoad(done?: () => void): void {
    this.loading.set(false);
    this.loadingNow = false;
    done?.();
    if (this.reloadAgain) {
      this.reloadAgain = false;
      this.load();
    }
  }

  refresh(ev: any): void {
    this.load(() => ev.target.complete());
  }

  // Same rules as the API (WaitlistController.GetQueue), recomputed between reloads.
  waitedMin(t: any): number {
    if (t.status !== 'Waiting' && t.status !== 'Called') return t.waitingMinutes;
    return Math.max(0, Math.floor((this.now() - new Date(t.createdat).getTime()) / 60000));
  }

  holdOverdue(t: any): boolean {
    const hold = (this.summary()?.holdMinutes ?? 0) * 60000;
    return t.status === 'Called' && !!t.calledat && hold > 0 && this.now() - new Date(t.calledat).getTime() > hold;
  }

  tablesOf(t: any): string {
    return [t.tablename, ...(t.combinedtables || [])].filter(Boolean).join(' + ');
  }

  floorName(floorId: number): string {
    return this.floors().find(f => f.floorid === floorId)?.floorname || '';
  }

  async newToken(): Promise<void> {
    this.ui.tap();
    const m = await this.modalCtrl.create({ component: TokenFormComponent, cssClass: 'sheet' });
    await m.present();
    const { role } = await m.onDidDismiss();
    if (role === 'created') this.load();
  }

  call(t: any): void {
    this.run(t, this.query.assignToken(t.tokenid, null), `${t.tokencode} called`);
  }

  seat(t: any): void {
    this.run(t, this.query.seatToken(t.tokenid, null), `${t.tokencode} seated`);
  }

  async close(t: any): Promise<void> {
    const noShow = t.status === 'Called';
    const ok = await this.ui.confirm(
      noShow ? 'Mark no-show?' : 'Cancel token?',
      noShow ? `${t.tokencode} (${t.customername}) did not come. The table goes to the next party.` : `Remove ${t.tokencode} (${t.customername}) from the queue?`,
      noShow ? 'No-show' : 'Cancel token', true);
    if (!ok) return;
    this.run(t, noShow ? this.query.noShowToken(t.tokenid) : this.query.cancelToken(t.tokenid), noShow ? 'Marked no-show' : 'Token cancelled');
  }

  // ---- table picker
  openPicker(t: any): void {
    this.picked.set([]);
    this.pickToken.set(t);
  }

  closePicker(): void {
    this.pickToken.set(null);
  }

  // Combined tables must be on one floor.
  canPick(tb: any): boolean {
    const first = this.tables().find(x => x.tableid === this.picked()[0]);
    return !first || first.floorid === tb.floorid;
  }

  togglePick(tb: any): void {
    const ids = this.picked();
    this.picked.set(ids.includes(tb.tableid) ? ids.filter(i => i !== tb.tableid) : [...ids, tb.tableid]);
  }

  assignPicked(seatNow: boolean): void {
    const t = this.pickToken();
    if (!t || !this.picked().length) return;
    const ids = [...this.picked()];
    this.closePicker();
    this.run(t, seatNow ? this.query.seatToken(t.tokenid, ids) : this.query.assignToken(t.tokenid, ids),
      seatNow ? `${t.tokencode} seated` : `${t.tokencode} called to ${this.tables().filter(x => ids.includes(x.tableid)).map(x => x.tablename).join(' + ')}`);
  }

  private run(t: any, call: any, okMsg: string): void {
    this.ui.tap();
    this.busyId.set(t.tokenid);
    call.subscribe({
      next: () => {
        this.busyId.set(null);
        this.ui.toast(okMsg, 'success');
        this.load();
      },
      error: (err: any) => {
        this.busyId.set(null);
        this.ui.toast(apiError(err), 'error');
        this.load();
      },
    });
  }
}

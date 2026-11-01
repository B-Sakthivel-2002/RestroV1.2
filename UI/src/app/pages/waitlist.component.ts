import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { QueryService } from '@appservices/query.service';
import { AlertService } from '@appservices/alert.service';
import { AuthService } from '@appservices/auth.service';
import { BranchSelectComponent } from '../shared/component/branch-select.component';

// Captain's live screen: Queue / Tables / History tabs over all floors of the branch.
// Refreshes itself every few seconds, so several captains can work on it at once.
@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BranchSelectComponent],
  providers: [BsModalService, AlertService],
  template: `
  <div class="wrapper">
    <div class="right-side wl-page">

      <div class="sub-header wl-head">
        <div class="tt">
          <h2 class="mn-tt">Waitlist &amp; Tables</h2>
          <small class="text-muted">Updated {{ lastUpdated | date:'h:mm:ss a' }}</small>
        </div>
        <div class="btn-bg wl-actions">
          @if (isOwner) {
            <div class="wl-branch"><app-branch-select [(branchId)]="branchId" (branchIdChange)="refresh()"></app-branch-select></div>
          }
          <button type="button" class="btn btn-outline-secondary" (click)="refresh()" title="Refresh"><i class="pi pi-refresh"></i></button>
          <a class="btn btn-primary" routerLink="/token-booking">+ New token</a>
        </div>
      </div>

      @if (summary && !summary.emailEnabled) {
        <div class="alert alert-warning py-2 mx-3 mb-2 small">
          Customer emails are off. Fill in EmailSettings in the API appsettings.json and set Enabled to true to send them.
        </div>
      }

      <div class="wl-card">
        <!-- same table tiles as the Tables tab, always on top -->
        <ng-container *ngTemplateOutlet="tilesTpl"></ng-container>

        <div class="wl-tabs" role="tablist">
          <button type="button" role="tab" [class.active]="tab === 'queue'" (click)="tab = 'queue'">Queue</button>
          <button type="button" role="tab" [class.active]="tab === 'tables'" (click)="tab = 'tables'">Tables</button>
          <button type="button" role="tab" [class.active]="tab === 'history'" (click)="tab = 'history'">History</button>
        </div>

        @if (tab === 'tables') {
          <ng-container *ngTemplateOutlet="tilesTpl"></ng-container>
        }

        <div class="wl-stats">
          <div><span class="wl-stat-num wl-num-available">{{ countOf('Available') }}</span><span>Available</span></div>
          <div><span class="wl-stat-num">{{ summary?.waiting ?? 0 }}</span><span>Waiting</span></div>
          <div><span class="wl-stat-num">{{ countOf('Occupied') }}</span><span>Occupied</span></div>
          <div><span class="wl-stat-num">{{ countOf('Reserved') }}</span><span>Reserved</span></div>
        </div>

        @if (tab === 'queue') {
          <h3 class="wl-title">Active queue</h3>
          @if (activeTokens.length === 0) {
            <p class="text-muted">No one is waiting.</p>
          }
          @for (t of activeTokens; track t.tokenid) {
            <div class="wl-token">
              <div class="wl-token-name">{{ t.tokencode }} &middot; {{ t.customername }}</div>
              <div class="wl-token-meta">
                {{ t.guests }} guests &middot;
                @if (t.status === 'Called') {
                  {{ tablesOf(t) }}@if (floorNameOf(t.tableid)) {, {{ floorNameOf(t.tableid) }}} ({{ t.assignmode === 'Auto' ? 'system' : 'captain' }})
                } @else {
                  Waiting {{ t.waitingMinutes }} min
                  @if (t.estimatedMinutes) { &middot; est. {{ t.estimatedMinutes }} min }
                }
              </div>
              @if (t.mobile || t.notes) {
                <div class="wl-token-sub">{{ t.mobile }} @if (t.notes) { &middot; <em>{{ t.notes }}</em> }</div>
              }
              <div class="wl-badges">
                <span class="wl-badge" [ngClass]="t.status === 'Called' ? 'wl-badge-called' : 'wl-badge-waiting'">{{ t.status }}</span>
                @if (t.status === 'Waiting') { <span class="wl-badge wl-badge-muted">#{{ t.position }}</span> }
                @if (t.holdOverdue) { <span class="wl-badge wl-badge-late">Not arrived</span> }
              </div>

              <div class="wl-pick" [attr.aria-label]="'Tables for ' + t.tokencode">
                <span class="wl-pick-label">{{ t.status === 'Called' ? 'Change table:' : 'Choose table(s):' }}</span>
                @for (tb of freeTables(); track tb.tableid) {
                  <button type="button" class="wl-pick-chip" [class.active]="isPicked(t, tb)" [disabled]="!canPick(t, tb)" (click)="togglePick(t, tb)"
                          [title]="'Seats ' + tb.capacity + (floors.length > 1 ? ', ' + floorNameOf(tb.tableid) : '')">
                    {{ tb.tablename }} &middot; {{ tb.capacity }}
                  </button>
                } @empty {
                  <span class="text-muted small">No free table</span>
                }
              </div>
              @if (picked(t).length) {
                <div class="wl-pick-sum" [class.wl-pick-short]="pickedSeats(t) < t.guests">
                  {{ pickedNames(t) }} &middot; {{ pickedSeats(t) }} seats
                  @if (pickedSeats(t) < t.guests) { &middot; need {{ t.guests }}, add another table on this floor }
                </div>
              }

              <div class="wl-token-actions">
                @if (picked(t).length) {
                  <button type="button" class="btn btn-sm btn-outline-primary" (click)="assign(t, picked(t))" [disabled]="pickedSeats(t) < t.guests">Assign Table</button>
                } @else if (t.status === 'Waiting') {
                  <button type="button" class="btn btn-sm btn-outline-primary" (click)="assign(t, null)" title="System holds the smallest free table that fits (or combines tables of one floor) and calls the customer">Call</button>
                }
                <button type="button" class="btn btn-sm btn-success" (click)="seat(t)"
                        [disabled]="picked(t).length ? pickedSeats(t) < t.guests : t.status !== 'Called'">Seat</button>
                <button type="button" class="btn btn-sm btn-outline-danger" (click)="close(t, t.status === 'Called' ? 'noshow' : 'cancel')"
                        [title]="t.status === 'Called' ? 'Did not come to the table' : 'Left the queue'">
                  {{ t.status === 'Called' ? 'No-show' : 'Cancel' }}
                </button>
              </div>
            </div>
          }
        }

        @if (tab === 'history') {
          <h3 class="wl-title">Today's finished tokens</h3>
          @if (closedTokens.length === 0) {
            <p class="text-muted">No finished tokens today.</p>
          }
          @for (t of closedTokens; track t.tokenid) {
            <div class="wl-token">
              <div class="wl-token-name">{{ t.tokencode }} &middot; {{ t.customername }}</div>
              <div class="wl-token-meta">
                {{ t.guests }} guests
                @if (t.tablename) { &middot; {{ tablesOf(t) }}@if (floorNameOf(t.tableid)) {, {{ floorNameOf(t.tableid) }}} }
                &middot; waited {{ t.waitingMinutes }} min
              </div>
              <div class="wl-badges">
                <span class="wl-badge" [ngClass]="t.status === 'Seated' ? 'wl-badge-seated' : 'wl-badge-late'">{{ t.status === 'NoShow' ? 'No-show' : t.status }}</span>
              </div>
            </div>
          }
        }
      </div>
    </div>
  </div>

  <ng-template #tilesTpl>
  @if (tables.length === 0) {
    <p class="text-muted mt-3">No active floors / tables in this branch. Add them under Master &gt; Floors and Tables.</p>
  } @else {
    <div class="wl-tiles">
      @for (tb of tables; track tb.tableid) {
        <button type="button" class="wl-tile" [ngClass]="'st-' + tb.state" (click)="openTable(tb, tableTemplate)">
          <span class="wl-tile-name">{{ tb.tablename }}</span>
          @if (floors.length > 1) { <span class="wl-tile-floor">{{ floorNameOf(tb.tableid) }}</span> }
          <span class="wl-tile-cap"><i class="pi pi-users"></i> {{ tb.capacity }}</span>
          <span class="wl-tile-state">{{ tb.state }}</span>
          @if (tb.mergedinto) {
            <span class="wl-tile-info">Merged with {{ tb.mergedintoname }}</span>
          } @else if (tb.mergedtables?.length) {
            <span class="wl-tile-info">+ {{ tb.mergedtables.join(', ') }}</span>
          }
          @if (tb.held) {
            <span class="wl-tile-info">{{ tb.held.tokencode }} &middot; {{ tb.held.customername }}</span>
          } @else if (tb.seated) {
            <span class="wl-tile-info">{{ tb.seated.tokencode }} &middot; {{ tb.seated.customername }}</span>
          }
          @if (tb.openOrders > 0) {
            <span class="wl-tile-info">Bill {{ tb.openAmount | number:'1.0-2' }}</span>
          }
          @if (tb.since && tb.state !== 'Available') {
            <span class="wl-tile-since">{{ minutesSince(tb.since) }} min</span>
          }
        </button>
      }
    </div>
  }
  </ng-template>

  <ng-template #tableTemplate>
    <div class="modal-header">
      <h4 class="modal-title pull-left">{{ selected?.tablename }} &middot; {{ selected?.capacity }} seats &middot; {{ selected?.state }}</h4>
      <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="modalRef?.hide()"></button>
    </div>
    <div class="modal-body">
      @if (selected) {
        @if (selected.mergedinto) {
          <p>Merged with <strong>{{ selected.mergedintoname }}</strong>. Its orders are billed on {{ selected.mergedintoname }}.</p>
          <button type="button" class="btn btn-outline-danger mb-3" (click)="unmerge()">Unmerge</button>
        } @else if (!selected.held) {
          @if (selected.mergedtables?.length) {
            <p class="small text-muted">Joined tables: {{ selected.mergedtables.join(', ') }}</p>
          }
        }
        @if (selected.mergedinto) {
        } @else if (selected.openOrders > 0) {
          <p>{{ selected.openOrders }} open order(s), bill {{ selected.openAmount | number:'1.0-2' }}. The table frees itself when the bill is settled.</p>
        } @else if (selected.held) {
          <p>Held for <strong>{{ selected.held.tokencode }}</strong> {{ selected.held.customername }} ({{ selected.held.guests }} guests).
             Seat, move or cancel the token from the queue.</p>
        } @else {
          <div class="d-flex flex-wrap gap-2 mb-3">
            @if (selected.storedState !== 'Available') {
              <button type="button" class="btn btn-success" (click)="setState('Available')">Mark ready</button>
            }
            @if (selected.storedState !== 'Reserved') {
              <button type="button" class="btn btn-outline-info" (click)="setState('Reserved')">Reserve</button>
            }
            @if (selected.storedState !== 'Blocked') {
              <button type="button" class="btn btn-outline-dark" (click)="setState('Blocked')">Block</button>
            }
          </div>
        }

        <h5 class="mt-2">History</h5>
        @if (historyLoading) {
          <p class="text-muted">Loading...</p>
        } @else if (history.length === 0) {
          <p class="text-muted">Nothing recorded yet.</p>
        } @else {
          <div class="wl-history">
            <table class="table table-sm">
              <thead><tr><th>When</th><th>Event</th><th>Details</th><th>By</th></tr></thead>
              <tbody>
                @for (h of history; track h.historyid) {
                  <tr>
                    <td class="text-nowrap">{{ h.createdat | date:'d MMM, h:mm a' }}</td>
                    <td>{{ eventInfo(h).label }}</td>
                    <td>
                      {{ eventInfo(h).detail }}
                      @if (h.tokencode || h.relatedtable) {
                        <span class="text-muted">{{ h.tokencode }} @if (h.relatedtable) { ({{ h.relatedtable }}) }</span>
                      }
                    </td>
                    <td>{{ h.username }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  </ng-template>
  `,
  styles: `
    .wl-page { padding-bottom: 16px; }
    .wl-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding: 12px 16px; }
    .wl-actions { display: flex; gap: 8px; align-items: center; }
    .wl-branch ::ng-deep .row { margin: 0 !important; }
    .wl-branch ::ng-deep .col-md-6 { width: auto; padding: 0; }
    .wl-branch ::ng-deep label { display: none; }
    .wl-card { background: var(--rp-surface, #fff); border: 1px solid var(--rp-border, #e4e8f0); border-radius: 14px; padding: 16px; margin: 0 16px; }
    .wl-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .wl-tabs button { border: 1px solid var(--rp-border-strong, #cfd6e3); background: transparent; border-radius: 999px; padding: 8px 12px; font-weight: 600; color: inherit; }
    .wl-tabs button.active { background: var(--rp-primary, #4361ee); border-color: var(--rp-primary, #4361ee); color: #fff; }
    .wl-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0 8px; }
    .wl-stats > div { display: flex; flex-direction: column; gap: 6px; padding-left: 8px; }
    .wl-stat-num { font-size: 1.4rem; font-weight: 700; }
    .wl-num-available { color: var(--rp-success, #16a34a); }
    .wl-title { font-size: 1rem; font-weight: 700; margin: 12px 0 10px; }
    .wl-token { border: 1px solid var(--rp-border, #e4e8f0); border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
    .wl-token-name { font-size: 1.05rem; font-weight: 700; }
    .wl-token-meta { margin-top: 4px; }
    .wl-token-sub { font-size: .8rem; color: var(--rp-text-muted, #6b7280); }
    .wl-badges { display: flex; gap: 6px; margin-top: 6px; }
    .wl-badge { font-size: .75rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
    .wl-badge-waiting { background: var(--rp-warning-soft, #fdf3e2); color: var(--rp-warning, #d97706); }
    .wl-badge-called { background: var(--rp-primary-soft, #eef1fd); color: var(--rp-primary, #4361ee); }
    .wl-badge-seated { background: var(--rp-success-soft, #e8f7ee); color: var(--rp-success, #16a34a); }
    .wl-badge-late { background: var(--rp-danger-soft, #fdecec); color: var(--rp-danger, #dc2626); }
    .wl-badge-muted { background: var(--rp-surface-alt, #f8f9fc); color: var(--rp-text-muted, #6b7280); }
    .wl-token-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .wl-pick { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
    .wl-pick-label { font-size: .8rem; color: var(--rp-text-muted, #6b7280); }
    .wl-pick-chip { border: 1px solid var(--rp-border-strong, #cfd6e3); background: var(--rp-surface, #fff); border-radius: 999px; padding: 2px 10px; font-size: .8rem; font-weight: 600; color: inherit; }
    .wl-pick-chip.active { background: var(--rp-primary, #4361ee); border-color: var(--rp-primary, #4361ee); color: #fff; }
    .wl-pick-chip:disabled { opacity: .4; }
    .wl-pick-sum { font-size: .85rem; margin-top: 6px; color: var(--rp-success, #16a34a); }
    .wl-pick-sum.wl-pick-short { color: var(--rp-danger, #dc2626); }
    @media (max-width: 600px) { .wl-card { margin: 0 8px; padding: 12px; } }
    .wl-tiles { display: flex; gap: 10px; overflow-x: auto; margin: 0 0 16px; padding-bottom: 6px; }
    .wl-tabs + .wl-tiles, .wl-tabs + p { margin-top: 16px; }
    .wl-tiles .wl-tile { flex: 0 0 150px; }
    .wl-tile-floor { font-size: .75rem; opacity: .75; }
    .wl-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; border: 0; border-radius: 10px; padding: 10px; min-height: 100px; color: #111827; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .wl-tile-name { font-size: 1.15rem; font-weight: 800; }
    .wl-tile-cap, .wl-tile-info, .wl-tile-since { font-size: .78rem; }
    .wl-tile-state { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
    .wl-tile-since { margin-top: auto; opacity: .8; }
    .st-Available { background: #dcfce7; }
    .st-Occupied { background: #fee2e2; }
    .st-Reserved { background: #dbeafe; }
    .st-Blocked { background: #d1d5db; }
    .wl-history { max-height: 320px; overflow-y: auto; }
  `
})
export class WaitlistComponent implements OnInit, OnDestroy {

  private readonly refreshMs = 8000;

  isOwner = false;
  branchId: number | null = Number(localStorage.getItem('branchid')) || null;

  tokens: any[] = [];
  activeTokens: any[] = [];
  closedTokens: any[] = [];
  summary: any = null;
  floors: any[] = [];
  tables: any[] = [];
  counts: { [state: string]: number | undefined } = {};
  lastUpdated: Date | null = null;
  tab: 'queue' | 'tables' | 'history' = 'queue';

  // Table chosen in each token's dropdown, by token id.
  pick: { [tokenId: number]: number[] | undefined } = {};

  selected: any = null;
  history: any[] = [];
  historyLoading = false;
  modalRef?: BsModalRef;

  private timer: any;
  private busy = false;

  constructor(private query: QueryService, private alertService: AlertService, private modalService: BsModalService, auth: AuthService) {
    this.isOwner = auth.isOutletOwner();
  }

  ngOnInit(): void {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), this.refreshMs);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    this.modalRef?.hide();
  }

  refresh(): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    const branch = this.isOwner ? this.branchId : null;
    let pending = 2;
    const done = () => {
      if (--pending === 0) {
        this.busy = false;
        this.lastUpdated = new Date();
      }
    };

    this.query.getWaitlist(branch).subscribe({
      next: (res: any) => {
        this.tokens = res.data || [];
        this.summary = res.summary;
        this.activeTokens = this.tokens.filter(t => t.status === 'Waiting' || t.status === 'Called');
        this.closedTokens = this.tokens.filter(t => t.status !== 'Waiting' && t.status !== 'Called').reverse();
        // Forget picks for tokens that are gone.
        const ids = new Set(this.activeTokens.map(t => t.tokenid));
        Object.keys(this.pick).forEach(k => { if (!ids.has(+k)) { delete this.pick[+k]; } });
        done();
      },
      error: () => done()
    });

    this.query.getTableBoard(branch).subscribe({
      next: (res: any) => {
        const data = res.data || {};
        this.floors = data.floors || [];
        this.tables = data.tables || [];
        this.counts = data.counts || {};
        if (this.selected) {
          this.selected = this.tables.find(t => t.tableid === this.selected.tableid) || this.selected;
        }
        done();
      },
      error: () => done()
    });
  }


  countOf(state: string): number {
    return this.tables.filter(t => t.state === state).length;
  }

  floorNameOf(tableId: number | null): string {
    const table = this.tables.find(t => t.tableid === tableId);
    return this.floors.find(f => f.floorid === table?.floorid)?.floorname || '';
  }

  // Free tables (not held, not merged), by floor then size.
  freeTables(): any[] {
    return this.tables
      .filter(t => t.state === 'Available' && !t.mergedinto && !t.mergedtables?.length)
      .sort((a, b) => a.floorid - b.floorid || a.capacity - b.capacity || String(a.tablename).localeCompare(String(b.tablename)));
  }

  picked(token: any): number[] {
    return this.pick[token.tokenid] || [];
  }

  isPicked(token: any, table: any): boolean {
    return this.picked(token).includes(table.tableid);
  }

  // Combined tables must be on one floor: after the first pick, other floors are greyed out.
  canPick(token: any, table: any): boolean {
    const first = this.tables.find(t => t.tableid === this.picked(token)[0]);
    return !first || first.floorid === table.floorid;
  }

  togglePick(token: any, table: any): void {
    const ids = this.picked(token);
    this.pick[token.tokenid] = ids.includes(table.tableid) ? ids.filter(id => id !== table.tableid) : [...ids, table.tableid];
  }

  pickedSeats(token: any): number {
    return this.tables.filter(t => this.picked(token).includes(t.tableid)).reduce((sum, t) => sum + (t.capacity || 0), 0);
  }

  pickedNames(token: any): string {
    return this.tables.filter(t => this.picked(token).includes(t.tableid)).map(t => t.tablename).join(' + ');
  }

  // "Table 1 + Table 2" for a party on combined tables.
  tablesOf(token: any): string {
    return [token.tablename, ...(token.combinedtables || [])].filter(Boolean).join(' + ');
  }

  minutesSince(value: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  }

  assign(token: any, tableIds: number[] | null): void {
    this.run(this.query.assignWaitlistToken(token.tokenid, tableIds?.length ? tableIds : null), token);
  }

  seat(token: any): void {
    const ids = this.picked(token);
    this.run(this.query.seatWaitlistToken(token.tokenid, ids.length ? ids : null), token);
  }

  close(token: any, kind: 'cancel' | 'noshow'): void {
    const text = kind === 'noshow'
      ? `Mark ${token.tokencode} (${token.customername}) as no-show? The table goes to the next party.`
      : `Cancel ${token.tokencode} (${token.customername})?`;
    this.alertService.showAlert('Confirmation !', text, () => {
      const call = kind === 'noshow' ? this.query.noShowWaitlistToken(token.tokenid) : this.query.cancelWaitlistToken(token.tokenid);
      this.run(call, token);
    });
  }

  openTable(table: any, template: TemplateRef<void>): void {
    this.selected = table;
    this.history = [];
    this.historyLoading = true;
    this.modalRef = this.modalService.show(template, { class: 'modal-lg' });
    this.query.getTableHistory(table.tableid).subscribe({
      next: (res: any) => {
        this.history = res.data?.history || [];
        this.historyLoading = false;
      },
      error: () => this.historyLoading = false
    });
  }

  setState(state: string): void {
    if (!this.selected) {
      return;
    }
    this.query.setTableState(this.selected.tableid, state).subscribe({
      next: () => {
        this.modalRef?.hide();
        this.refresh();
      },
      error: (err: any) => this.alertService.showAlert('Error !', err?.error?.message || 'Could not change the table')
    });
  }

  unmerge(): void {
    if (!this.selected) {
      return;
    }
    this.query.unmergeTable(this.selected.tableid).subscribe({
      next: () => {
        this.modalRef?.hide();
        this.refresh();
      },
      error: (err: any) => this.alertService.showAlert('Error !', err?.error?.message || 'Could not unmerge the table')
    });
  }

  // History wording shown to staff; events not in the list (merge/split/reserve/block) keep a plain label.
  eventInfo(h: any): { label: string, detail: string } {
    switch (h.event) {
      case 'TokenAssigned': return { label: 'Customer Called', detail: 'Customer called for seating' };
      case 'Seated': return { label: 'Customer Seated', detail: 'Customer assigned to a table' };
      case 'TransferOut':
      case 'TransferIn': return { label: 'Table Changed', detail: 'Customer moved to another table' };
      case 'TokenReleased':
        // a called token released because it went to a different table, not cancelled
        return /moved to|instead/.test(h.notes || '')
          ? { label: 'Table Changed', detail: 'Customer moved to another table' }
          : { label: 'Token Cancelled', detail: 'Queue token cancelled' };
      case 'Released': return { label: 'Bill Settled', detail: 'Customer bill completed' };
      case 'StateChanged':
        if (h.fromstate === 'Reserved' && h.tostate !== 'Reserved') return { label: 'Reservation Cancelled', detail: 'Table reservation cancelled' };
        if (h.tostate === 'Available') return { label: 'Table Available', detail: 'Table became available' };
        return { label: 'Table ' + h.tostate, detail: 'Table marked ' + (h.tostate || '').toLowerCase() };
      case 'Merged': return { label: 'Merged', detail: 'Tables merged' };
      case 'Unmerged': return { label: 'Separated', detail: 'Merged tables separated' };
      case 'Split': return { label: 'Split Bill', detail: 'Bill split between customers' };
      default: return { label: h.event, detail: h.notes || '' };
    }
  }

  private run(call: any, token: any): void {
    call.subscribe({
      next: () => {
        delete this.pick[token.tokenid];
        this.busy = false;
        this.refresh();
      },
      error: (err: any) => {
        this.alertService.showAlert('Error !', err?.error?.message || 'Something went wrong');
        this.busy = false;
        this.refresh();
      }
    });
  }
}

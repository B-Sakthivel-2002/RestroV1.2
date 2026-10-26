import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { QueryService } from '@appservices/query.service';
import { AlertService } from '@appservices/alert.service';
import { AuthService } from '@appservices/auth.service';
import { BranchSelectComponent } from '../shared/component/branch-select.component';
import { TableActionMode, TableActionsComponent } from '../shared/component/table-actions.component';

// Captain's live screen: the walk-in token queue on the left, the table board on the right.
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
        <div class="wl-chips">
          <span class="wl-chip wl-waiting">Waiting {{ summary?.waiting ?? 0 }}</span>
          <span class="wl-chip wl-called">Called {{ summary?.called ?? 0 }}</span>
          @for (s of states; track s) {
            <span class="wl-chip" [ngClass]="'st-' + s">{{ s }} {{ counts[s] ?? 0 }}</span>
          }
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

      <div class="wl-body">
        <!-- Queue -->
        <section class="wl-queue">
          <h3 class="wl-title">Queue</h3>
          @if (activeTokens.length === 0) {
            <p class="text-muted">No one is waiting.</p>
          }
          @for (t of activeTokens; track t.tokenid) {
            <div class="wl-token" [class.wl-token-called]="t.status === 'Called'">
              <div class="wl-token-top">
                <span class="wl-code">{{ t.tokencode }}</span>
                <span class="wl-guests"><i class="pi pi-users"></i> {{ t.guests }}</span>
                <span class="badge" [ngClass]="t.status === 'Called' ? 'bg-success' : 'bg-secondary'">
                  {{ t.status === 'Called' ? 'Table held' : ('#' + t.position) }}
                </span>
              </div>
              <div class="wl-token-name">{{ t.customername }} <span class="text-muted">&middot; {{ t.mobile }}</span></div>
              <div class="wl-token-meta">
                Waiting {{ t.waitingMinutes }} min
                @if (t.status === 'Waiting' && t.estimatedMinutes) { &middot; est. {{ t.estimatedMinutes }} min }
                @if (t.notes) { &middot; <em>{{ t.notes }}</em> }
              </div>

              @if (t.status === 'Called') {
                <div class="wl-held">
                  <strong>{{ t.tablename }}</strong> ({{ t.assignmode === 'Auto' ? 'system' : 'captain' }})
                  @if (t.holdOverdue) { <span class="badge bg-danger ms-1">Not arrived</span> }
                </div>
              }

              <div class="wl-token-actions">
                <select class="form-select form-select-sm" [(ngModel)]="pick[t.tokenid]" [attr.aria-label]="'Table for ' + t.tokencode">
                  <option [ngValue]="undefined">{{ t.status === 'Called' ? 'Change table...' : 'Choose table...' }}</option>
                  @for (tb of freeTablesFor(t); track tb.tableid) {
                    <option [ngValue]="tb.tableid">{{ tb.tablename }} ({{ tb.capacity }} seats)</option>
                  }
                </select>
                @if (pick[t.tokenid]) {
                  <button type="button" class="btn btn-sm btn-outline-primary" (click)="assign(t, pick[t.tokenid])">Hold</button>
                } @else if (t.status === 'Waiting') {
                  <button type="button" class="btn btn-sm btn-outline-primary" (click)="assign(t, null)" title="System picks the smallest free table that fits">Auto</button>
                }
                <button type="button" class="btn btn-sm btn-success" (click)="seat(t)" [disabled]="t.status !== 'Called' && !pick[t.tokenid]">Seat</button>
                <button type="button" class="btn btn-sm btn-outline-danger" (click)="close(t, t.status === 'Called' ? 'noshow' : 'cancel')"
                        [title]="t.status === 'Called' ? 'Did not come to the table' : 'Left the queue'">
                  {{ t.status === 'Called' ? 'No-show' : 'Cancel' }}
                </button>
              </div>
            </div>
          }

          @if (closedTokens.length) {
            <button type="button" class="btn btn-link px-0 mt-2" (click)="showClosed = !showClosed">
              {{ showClosed ? 'Hide' : 'Show' }} today's finished tokens ({{ closedTokens.length }})
            </button>
            @if (showClosed) {
              <table class="table table-sm wl-closed">
                <tbody>
                  @for (t of closedTokens; track t.tokenid) {
                    <tr>
                      <td>{{ t.tokencode }}</td>
                      <td>{{ t.customername }}</td>
                      <td>{{ t.guests }}</td>
                      <td>{{ t.status }}{{ t.tablename ? ' - ' + t.tablename : '' }}</td>
                      <td>{{ t.waitingMinutes }} min</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        </section>

        <!-- Table board -->
        <section class="wl-board">
          @if (floors.length === 0) {
            <p class="text-muted">No active floors / tables in this branch. Add them under Master &gt; Floors and Tables.</p>
          }
          @for (fl of floors; track fl.floorid) {
            <h3 class="wl-title">{{ fl.floorname }}</h3>
            <div class="wl-tiles">
              @for (tb of tablesOn(fl.floorid); track tb.tableid) {
                <button type="button" class="wl-tile" [ngClass]="'st-' + tb.state" (click)="openTable(tb, tableTemplate)">
                  <span class="wl-tile-name">{{ tb.tablename }}</span>
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
        </section>
      </div>
    </div>
  </div>

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
          <div class="d-flex flex-wrap gap-2 mb-3">
            @if (selected.openOrders > 0 || selected.storedState === 'Occupied') {
              <button type="button" class="btn btn-outline-primary" (click)="tableAction('transfer')"><i class="pi pi-arrow-right-arrow-left"></i> Transfer</button>
            }
            <button type="button" class="btn btn-outline-primary" (click)="tableAction('merge')"><i class="pi pi-objects-column"></i> Merge tables</button>
            @if (selected.openOrders > 0) {
              <button type="button" class="btn btn-outline-primary" (click)="tableAction('split')"><i class="pi pi-clone"></i> Split bill</button>
            }
          </div>
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
            @if (selected.storedState !== 'Cleaning') {
              <button type="button" class="btn btn-outline-warning" (click)="setState('Cleaning')">Cleaning</button>
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
                    <td>{{ eventLabel(h.event) }}</td>
                    <td>
                      @if (h.fromstate || h.tostate) { {{ h.fromstate }} &rarr; {{ h.tostate }} }
                      @if (h.tokencode) { {{ h.tokencode }} }
                      @if (h.relatedtable) { ({{ h.relatedtable }}) }
                      @if (h.notes) { <span class="text-muted">{{ h.notes }}</span> }
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
    .wl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .wl-chip { padding: 3px 10px; border-radius: 999px; font-size: .8rem; font-weight: 600; background: #e5e7eb; }
    .wl-actions { display: flex; gap: 8px; align-items: center; }
    .wl-branch ::ng-deep .row { margin: 0 !important; }
    .wl-branch ::ng-deep .col-md-6 { width: auto; padding: 0; }
    .wl-branch ::ng-deep label { display: none; }
    .wl-body { display: grid; grid-template-columns: minmax(300px, 380px) 1fr; gap: 16px; padding: 0 16px; }
    @media (max-width: 900px) { .wl-body { grid-template-columns: 1fr; } }
    .wl-title { font-size: 1rem; font-weight: 700; margin: 8px 0; }
    .wl-token { background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; border-left: 4px solid #9ca3af; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .wl-token-called { border-left-color: #16a34a; }
    .wl-token-top { display: flex; align-items: center; gap: 10px; }
    .wl-code { font-size: 1.3rem; font-weight: 800; }
    .wl-guests { color: #374151; }
    .wl-token-top .badge { margin-left: auto; }
    .wl-token-name { font-weight: 600; margin-top: 2px; }
    .wl-token-meta { font-size: .8rem; color: #6b7280; }
    .wl-held { margin-top: 4px; font-size: .9rem; color: #166534; }
    .wl-token-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .wl-token-actions select { flex: 1 1 140px; }
    .wl-closed td { font-size: .8rem; }
    .wl-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-bottom: 12px; }
    .wl-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; border: 0; border-radius: 10px; padding: 10px; min-height: 100px; color: #111827; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .wl-tile-name { font-size: 1.15rem; font-weight: 800; }
    .wl-tile-cap, .wl-tile-info, .wl-tile-since { font-size: .78rem; }
    .wl-tile-state { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
    .wl-tile-since { margin-top: auto; opacity: .8; }
    .st-Available { background: #dcfce7; }
    .st-Occupied { background: #fee2e2; }
    .st-Reserved { background: #dbeafe; }
    .st-Cleaning { background: #fef3c7; }
    .st-Blocked { background: #d1d5db; }
    .wl-waiting { background: #e5e7eb; }
    .wl-called { background: #bbf7d0; }
    .wl-history { max-height: 320px; overflow-y: auto; }
  `
})
export class WaitlistComponent implements OnInit, OnDestroy {

  readonly states = ['Available', 'Occupied', 'Reserved', 'Cleaning', 'Blocked'];
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
  showClosed = false;

  // Table chosen in each token's dropdown, by token id.
  pick: { [tokenId: number]: number | undefined } = {};

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

  tablesOn(floorId: number): any[] {
    return this.tables.filter(t => t.floorid === floorId);
  }

  // Free tables that seat the party, smallest first.
  freeTablesFor(token: any): any[] {
    return this.tables
      .filter(t => t.state === 'Available' && t.capacity >= token.guests)
      .sort((a, b) => a.capacity - b.capacity || String(a.tablename).localeCompare(String(b.tablename)));
  }

  minutesSince(value: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  }

  assign(token: any, tableId: number | null | undefined): void {
    this.run(this.query.assignWaitlistToken(token.tokenid, tableId ?? null), token);
  }

  seat(token: any): void {
    this.run(this.query.seatWaitlistToken(token.tokenid, this.pick[token.tokenid] ?? null), token);
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

  tableAction(mode: TableActionMode): void {
    const table = this.selected;
    if (!table) {
      return;
    }
    this.modalRef?.hide();
    this.modalService.show(TableActionsComponent, {
      class: 'modal-lg',
      initialState: {
        mode,
        tableId: table.tableid,
        tableName: table.tablename,
        branchId: this.isOwner ? this.branchId : null,
        onDone: (res: any) => {
          this.alertService.showAlert('Success', res.message || 'Done');
          this.refresh();
        }
      }
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

  eventLabel(evt: string): string {
    switch (evt) {
      case 'TransferOut': return 'Moved out';
      case 'TransferIn': return 'Moved in';
      case 'Merged': return 'Merged';
      case 'Unmerged': return 'Separated';
      case 'Split': return 'Split bill';
      case 'StateChanged': return 'State changed';
      case 'TokenAssigned': return 'Held for token';
      case 'TokenReleased': return 'Hold released';
      case 'Seated': return 'Seated';
      case 'Released': return 'Freed after bill';
      default: return evt;
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

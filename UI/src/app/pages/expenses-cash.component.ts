import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { QueryService } from '@appservices/query.service';
import { StateService } from '@appservices/state.service';
import { AlertService } from '@appservices/alert.service';
import { AuthService } from '@appservices/auth.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BranchSelectComponent } from '../shared/component/branch-select.component';

// Daily expenses and cash drawer: opening cash, expenses, cash in / out, cash sales from settled bills,
// expected vs counted cash. Everything is optional and independent of the work period.
@Component({
  selector: 'app-expenses-cash',
  standalone: true,
  imports: [CommonModule, FormsModule, BranchSelectComponent],
  providers: [BsModalService, AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Expenses &amp; Cash</h2>
            <h3 class="cs-spl-tt">{{ tab === 'day' ? (date | date: 'EEEE, dd-MM-yyyy') : 'Report' }}</h3>
          </div>
          <div class="btn-bg spl-bg">
            <div class="fl-spl-bg">
              @if (tab === 'day') {
                <div class="dt-bg">
                  <label class="ssb-tt" for="ecDate">Business date</label>
                  <input id="ecDate" type="date" class="form-control" [(ngModel)]="date" (change)="loadDay()" />
                </div>
                <button class="btn btn-outline-secondary" title="Today" (click)="date = today(); loadDay()"><i class="pi pi-refresh"></i></button>
              } @else {
                <div class="dt-bg">
                  <label class="ssb-tt" for="ecFrom">From Date</label>
                  <input id="ecFrom" type="date" class="form-control" [(ngModel)]="fromDate" />
                </div>
                <div class="dt-bg">
                  <label class="ssb-tt" for="ecTo">To Date</label>
                  <input id="ecTo" type="date" class="form-control" [(ngModel)]="toDate" />
                </div>
                <button class="btn btn-primary" (click)="loadReport()">Submit</button>
              }
            </div>
          </div>
        </div>

        <div class="cnt">
          <app-branch-select [branchId]="branchId" (branchIdChange)="branchId = $event; reload()"></app-branch-select>
          <ul class="nav nav-pills mb-3">
            <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab === 'day'" (click)="tab = 'day'; loadDay()">Day</button></li>
            <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab === 'report'" (click)="tab = 'report'; loadReport()">Report</button></li>
          </ul>

          @if (tab === 'day' && day) {
            <div class="ec-grid">
              <section class="ec-card">
                <h4>Cash drawer</h4>
                <label class="form-label" for="ecOpening">Opening cash</label>
                <input id="ecOpening" type="number" min="0" step="0.01" class="form-control" [(ngModel)]="openingCash" />
                <label class="form-label mt-2" for="ecCounted">Counted cash at close <small class="text-muted">(optional)</small></label>
                <input id="ecCounted" type="number" min="0" step="0.01" class="form-control" [(ngModel)]="countedCash" placeholder="Count the drawer and enter" />
                <label class="form-label mt-2" for="ecNotes">Notes</label>
                <textarea id="ecNotes" class="form-control" rows="2" [(ngModel)]="notes" maxlength="500"></textarea>
                <button type="button" class="btn btn-primary mt-3 w-100" [disabled]="saving" (click)="saveDay()">Save cash details</button>
                @if (day.drawer?.updatedat) {
                  <small class="text-muted d-block mt-1">Saved {{ day.drawer.updatedat | date: 'dd-MM h:mm a' }} by {{ day.drawer.updatedBy }}</small>
                }
              </section>

              <section class="ec-card">
                <h4>Cash summary</h4>
                <div class="ec-kv"><span>Opening cash</span><strong>{{ day.totals.openingCash | number: '1.2-2' }}</strong></div>
                <div class="ec-kv"><span>+ Cash sales (settled bills)</span><strong>{{ day.totals.cashSales | number: '1.2-2' }}</strong></div>
                <div class="ec-kv"><span>+ Cash in</span><strong>{{ day.totals.cashIn | number: '1.2-2' }}</strong></div>
                <div class="ec-kv"><span>- Cash out</span><strong>{{ day.totals.cashOut | number: '1.2-2' }}</strong></div>
                <div class="ec-kv"><span>- Expenses paid in cash</span><strong>{{ day.totals.cashExpenses | number: '1.2-2' }}</strong></div>
                <div class="ec-kv ec-total"><span>Expected cash in drawer</span><strong>{{ day.totals.expectedCash | number: '1.2-2' }}</strong></div>
                <div class="ec-kv"><span>Counted cash</span><strong>{{ day.totals.countedCash != null ? (day.totals.countedCash | number: '1.2-2') : '-' }}</strong></div>
                @if (day.totals.difference != null) {
                  <div class="ec-kv" [class.ec-short]="day.totals.difference < 0" [class.ec-excess]="day.totals.difference > 0">
                    <span>{{ day.totals.difference < 0 ? 'Short' : day.totals.difference > 0 ? 'Excess' : 'Difference' }}</span>
                    <strong>{{ day.totals.difference | number: '1.2-2' }}</strong>
                  </div>
                }
                <h4 class="mt-3">Sales of the day</h4>
                @for (m of modes(); track m.mode) {
                  <div class="ec-kv"><span>{{ m.mode | titlecase }}</span><strong>{{ m.amount | number: '1.2-2' }}</strong></div>
                } @empty { <p class="text-muted mb-1">No settled bills.</p> }
                <div class="ec-kv"><span>Unpaid / credit</span><strong>{{ day.sales.unpaid | number: '1.2-2' }}</strong></div>
                <div class="ec-kv"><span>Complimentary</span><strong>{{ day.sales.complimentary | number: '1.2-2' }}</strong></div>
                <div class="ec-kv"><span>Total expenses (all modes)</span><strong>{{ day.totals.expenses | number: '1.2-2' }}</strong></div>
                @if (day.sales.byMode?.split) { <small class="text-muted">Split payments are not counted as cash sales.</small> }
              </section>

              <section class="ec-card">
                <h4>Add entry</h4>
                <div class="btn-group w-100 mb-2" role="group" aria-label="Entry type">
                  <button type="button" class="btn" [class.btn-primary]="entry.entryType === 'expense'" [class.btn-outline-primary]="entry.entryType !== 'expense'" (click)="entry.entryType = 'expense'">Expense</button>
                  <button type="button" class="btn" [class.btn-primary]="entry.entryType === 'cashin'" [class.btn-outline-primary]="entry.entryType !== 'cashin'" (click)="entry.entryType = 'cashin'">Cash in</button>
                  <button type="button" class="btn" [class.btn-primary]="entry.entryType === 'cashout'" [class.btn-outline-primary]="entry.entryType !== 'cashout'" (click)="entry.entryType = 'cashout'">Cash out</button>
                </div>
                <label class="form-label" for="ecCat">{{ entry.entryType === 'expense' ? 'Category' : 'Reason' }}</label>
                <input id="ecCat" class="form-control" [(ngModel)]="entry.category" maxlength="60" list="ecCats"
                       [placeholder]="entry.entryType === 'expense' ? 'e.g. Vegetables' : entry.entryType === 'cashin' ? 'e.g. Change from bank' : 'e.g. Deposit to bank'" />
                <datalist id="ecCats">
                  @for (c of day.categories; track c) { <option [value]="c"></option> }
                </datalist>
                <div class="row g-2 mt-1">
                  <div class="col-7">
                    <label class="form-label" for="ecAmt">Amount</label>
                    <input id="ecAmt" type="number" min="0" step="0.01" class="form-control" [(ngModel)]="entry.amount" />
                  </div>
                  <div class="col-5">
                    <label class="form-label" for="ecMode">Paid by</label>
                    <select id="ecMode" class="form-select" [(ngModel)]="entry.paymentMode" [disabled]="entry.entryType !== 'expense'">
                      @for (m of day.paymentModes; track m) { <option [value]="m">{{ m | titlecase }}</option> }
                    </select>
                  </div>
                </div>
                <label class="form-label mt-2" for="ecENotes">Notes</label>
                <input id="ecENotes" class="form-control" [(ngModel)]="entry.notes" maxlength="200" />
                <button type="button" class="btn btn-success mt-3 w-100" [disabled]="saving || !(entry.amount > 0)" (click)="addEntry()">Add</button>
              </section>
            </div>

            <h4 class="mt-4">Entries</h4>
            <div class="table-responsive">
              <table class="table custom-table">
                <thead><tr><th>Time</th><th>Type</th><th>Category / reason</th><th>Paid by</th><th class="text-end">Amount</th><th>Notes</th><th>By</th><th></th></tr></thead>
                <tbody>
                  @for (e of day.entries; track e.cashentryid) {
                    <tr>
                      <td>{{ e.createdat | date: 'h:mm a' }}</td>
                      <td><span class="badge" [ngClass]="e.entrytype === 'expense' ? 'bg-danger' : e.entrytype === 'cashin' ? 'bg-success' : 'bg-warning text-dark'">{{ typeLabel(e.entrytype) }}</span></td>
                      <td>{{ e.category || '-' }}</td>
                      <td>{{ e.paymentmode | titlecase }}</td>
                      <td class="text-end">{{ e.amount | number: '1.2-2' }}</td>
                      <td>{{ e.notes }}</td>
                      <td>{{ e.createdby }}</td>
                      <td><button type="button" class="btn btn-sm btn-outline-danger" title="Delete" (click)="deleteEntry(e)"><i class="pi pi-trash"></i></button></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="8" class="text-center">No expenses or cash entries for this day</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (tab === 'report' && report) {
            <div class="ec-kpis">
              <div class="ec-card"><span>Sales (paid)</span><strong>{{ report.totals.sales | number: '1.2-2' }}</strong></div>
              <div class="ec-card"><span>Cash sales</span><strong>{{ report.totals.cashSales | number: '1.2-2' }}</strong></div>
              <div class="ec-card"><span>Expenses</span><strong>{{ report.totals.expenses | number: '1.2-2' }}</strong></div>
              <div class="ec-card"><span>Sales - expenses</span><strong>{{ report.totals.sales - report.totals.expenses | number: '1.2-2' }}</strong></div>
              <div class="ec-card"><span>Cash short / excess</span><strong>{{ report.totals.difference | number: '1.2-2' }}</strong></div>
            </div>
            <h4 class="mt-3">Day wise</h4>
            <div class="table-responsive">
              <table class="table custom-table">
                <thead><tr><th>Date</th><th class="text-end">Opening</th><th class="text-end">Cash sales</th><th class="text-end">All sales</th><th class="text-end">Expenses</th><th class="text-end">Cash in</th><th class="text-end">Cash out</th><th class="text-end">Expected</th><th class="text-end">Counted</th><th class="text-end">Diff.</th></tr></thead>
                <tbody>
                  @for (d of report.days; track d.date) {
                    <tr>
                      <td><a href="javascript:void(0)" (click)="openDay(d.date)">{{ d.date | date: 'dd-MM-yyyy' }}</a></td>
                      <td class="text-end">{{ d.totals.openingCash | number: '1.2-2' }}</td>
                      <td class="text-end">{{ d.totals.cashSales | number: '1.2-2' }}</td>
                      <td class="text-end">{{ d.totals.totalPaidSales | number: '1.2-2' }}</td>
                      <td class="text-end">{{ d.totals.expenses | number: '1.2-2' }}</td>
                      <td class="text-end">{{ d.totals.cashIn | number: '1.2-2' }}</td>
                      <td class="text-end">{{ d.totals.cashOut | number: '1.2-2' }}</td>
                      <td class="text-end">{{ d.totals.expectedCash | number: '1.2-2' }}</td>
                      <td class="text-end">{{ d.totals.countedCash != null ? (d.totals.countedCash | number: '1.2-2') : '-' }}</td>
                      <td class="text-end" [class.ec-short]="d.totals.difference < 0" [class.ec-excess]="d.totals.difference > 0">{{ d.totals.difference != null ? (d.totals.difference | number: '1.2-2') : '-' }}</td>
                    </tr>
                  } @empty { <tr><td colspan="10" class="text-center">No data in this period</td></tr> }
                </tbody>
              </table>
            </div>
            <h4 class="mt-3">Expenses by category</h4>
            <div class="table-responsive">
              <table class="table custom-table">
                <thead><tr><th>Category</th><th class="text-end">Entries</th><th class="text-end">Amount</th></tr></thead>
                <tbody>
                  @for (c of report.byCategory; track c.category) {
                    <tr><td>{{ c.category }}</td><td class="text-end">{{ c.count }}</td><td class="text-end">{{ c.amount | number: '1.2-2' }}</td></tr>
                  } @empty { <tr><td colspan="3" class="text-center">No expenses in this period</td></tr> }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .ec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .ec-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
    .ec-card h4 { font-size: 1rem; margin-bottom: 10px; }
    .ec-kv { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; border-bottom: 1px dashed #eef0f3; font-size: 14px; }
    .ec-total { font-size: 15px; border-bottom: 2px solid #cbd5e1; }
    .ec-short { color: #dc2626; } .ec-excess { color: #16a34a; }
    .ec-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    .ec-kpis .ec-card { display: flex; flex-direction: column; } .ec-kpis span { font-size: 12px; color: #6b7280; } .ec-kpis strong { font-size: 1.2rem; }
  `
})
export class ExpensesCashComponent implements OnInit {
  tab: 'day' | 'report' = 'day';
  branchId: number | null = Number(localStorage.getItem('branchid')) || null;
  date = this.today();
  fromDate = '';
  toDate = this.today();
  day: any = null;
  report: any = null;
  saving = false;

  openingCash: number | null = 0;
  countedCash: number | null = null;
  notes = '';
  entry = this.emptyEntry();

  constructor(private query: QueryService, private state: StateService, private alert: AlertService, private auth: AuthService) {}

  ngOnInit(): void {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    this.fromDate = this.ymd(from);
    this.loadDay();
  }

  // Local dates (toISOString would shift the day before 05:30 in India).
  private ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  today(): string {
    return this.ymd(new Date());
  }

  private get scopedBranch(): number | null {
    return this.auth.isOutletOwner() ? this.branchId : null;
  }

  private emptyEntry() {
    return { entryType: 'expense', category: '', amount: null as any, paymentMode: 'cash', notes: '' };
  }

  reload(): void {
    this.tab === 'day' ? this.loadDay() : this.loadReport();
  }

  loadDay(): void {
    if (!this.date) return;
    this.state.setLoadingState(true);
    this.query.getCashDay(this.date, this.scopedBranch)
      .pipe(finalize(() => this.state.setLoadingState(false)))
      .subscribe({
        next: (res: any) => {
          this.day = res?.data || null;
          this.openingCash = this.day?.drawer?.openingcash ?? 0;
          this.countedCash = this.day?.drawer?.countedcash ?? null;
          this.notes = this.day?.drawer?.notes ?? '';
        },
        error: (err: any) => this.alert.showAlert('Error !', err?.error?.message || 'Could not load the day')
      });
  }

  loadReport(): void {
    this.state.setLoadingState(true);
    this.query.getCashReport(this.fromDate, this.toDate, this.scopedBranch)
      .pipe(finalize(() => this.state.setLoadingState(false)))
      .subscribe({
        next: (res: any) => this.report = res?.data || null,
        error: (err: any) => this.alert.showAlert('Error !', err?.error?.message || 'Could not load the report')
      });
  }

  openDay(date: string): void {
    this.date = String(date).substring(0, 10);
    this.tab = 'day';
    this.loadDay();
  }

  modes(): { mode: string, amount: number }[] {
    const byMode = this.day?.sales?.byMode || {};
    return Object.keys(byMode).map(mode => ({ mode, amount: byMode[mode] }));
  }

  typeLabel(t: string): string {
    return t === 'expense' ? 'Expense' : t === 'cashin' ? 'Cash in' : 'Cash out';
  }

  saveDay(): void {
    this.saving = true;
    this.query.saveCashDay({
      date: this.date, branchId: this.scopedBranch,
      openingCash: Number(this.openingCash) || 0,
      countedCash: this.countedCash === null || (this.countedCash as any) === '' ? null : Number(this.countedCash),
      notes: this.notes?.trim() || null
    }).pipe(finalize(() => this.saving = false)).subscribe({
      next: () => this.loadDay(),
      error: (err: any) => this.alert.showAlert('Error !', err?.error?.message || 'Could not save')
    });
  }

  addEntry(): void {
    this.saving = true;
    this.query.addCashEntry({
      date: this.date, branchId: this.scopedBranch,
      entryType: this.entry.entryType,
      category: this.entry.category?.trim() || null,
      amount: Number(this.entry.amount),
      paymentMode: this.entry.entryType === 'expense' ? this.entry.paymentMode : 'cash',
      notes: this.entry.notes?.trim() || null
    }).pipe(finalize(() => this.saving = false)).subscribe({
      next: () => {
        this.entry = { ...this.emptyEntry(), entryType: this.entry.entryType };
        this.loadDay();
      },
      error: (err: any) => this.alert.showAlert('Error !', err?.error?.message || 'Could not add the entry')
    });
  }

  deleteEntry(e: any): void {
    if (!confirm(`Delete this ${this.typeLabel(e.entrytype).toLowerCase()} of ${e.amount}?`)) return;
    this.query.deleteCashEntry(e.cashentryid).subscribe({
      next: () => this.loadDay(),
      error: (err: any) => this.alert.showAlert('Error !', err?.error?.message || 'Could not delete')
    });
  }
}

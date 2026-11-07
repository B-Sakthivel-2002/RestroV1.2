import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { QueryService } from '@appservices/query.service';
import { StateService } from '@appservices/state.service';
import { AuthService } from '@appservices/auth.service';
import { BranchSelectComponent } from '../shared/component/branch-select.component';

// Customer loyalty & customer reports: points and tiers (earn + view only), activity in a period,
// what each customer buys (item / category), and their habits. Data: settled, paid bills with a customer.
@Component({
  selector: 'app-customer-loyalty',
  standalone: true,
  imports: [CommonModule, FormsModule, BranchSelectComponent],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Customer Loyalty</h2>
            <h3 class="cs-spl-tt">Period : ({{ fromDate | date: 'dd-MM-yyyy' }} - {{ toDate | date: 'dd-MM-yyyy' }})</h3>
          </div>
          <div class="btn-bg spl-bg">
            <div class="fl-spl-bg">
              <div class="dt-bg">
                <label class="ssb-tt" for="lyFrom">From Date</label>
                <input id="lyFrom" type="date" class="form-control" [(ngModel)]="fromDate" />
              </div>
              <div class="dt-bg">
                <label class="ssb-tt" for="lyTo">To Date</label>
                <input id="lyTo" type="date" class="form-control" [(ngModel)]="toDate" />
              </div>
              <button (click)="load()" class="btn btn-primary">Submit</button>
              <button class="btn btn-outline-secondary" title="Last 30 days" (click)="last30()"><i class="pi pi-refresh"></i></button>
            </div>
          </div>
        </div>

        <div class="cnt">
          <app-branch-select [branchId]="branchId" (branchIdChange)="branchId = $event; load()"></app-branch-select>

          @if (data) {
            <div class="ly-kpis">
              <div class="ly-kpi"><span>Loyalty customers</span><strong>{{ data.kpis.totalCustomers }}</strong></div>
              <div class="ly-kpi"><span>Active in period</span><strong>{{ data.kpis.activeCustomers }}</strong></div>
              <div class="ly-kpi"><span>New in period</span><strong>{{ data.kpis.newCustomers }}</strong></div>
              <div class="ly-kpi"><span>Repeat rate</span><strong>{{ data.kpis.repeatRate }}%</strong></div>
              <div class="ly-kpi"><span>Revenue (period)</span><strong>{{ data.kpis.periodRevenue | number: '1.0-0' }}</strong></div>
              <div class="ly-kpi"><span>Avg spend / customer</span><strong>{{ data.kpis.avgSpendPerCustomer | number: '1.0-0' }}</strong></div>
              <div class="ly-kpi"><span>Points earned (all)</span><strong>{{ data.kpis.pointsOutstanding | number }}</strong></div>
              <div class="ly-kpi"><span>Inactive &gt; {{ data.settings.inactiveDays }} days</span><strong>{{ data.kpis.inactiveCustomers }}</strong></div>
            </div>
            <p class="ly-note">
              {{ data.settings.pointsPerStep }} point per Rs.{{ data.settings.rupeesPerPoint }} spent (lifetime, settled bills).
              Tiers:
              @for (t of data.tierCounts; track t.tier; let last = $last) { {{ t.tier }} {{ t.count }}{{ last ? '' : ' · ' }} }
            </p>

            <ul class="nav nav-pills mb-3" role="tablist">
              <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab === 'customers'" (click)="tab = 'customers'">Customers</button></li>
              <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab === 'items'" (click)="tab = 'items'">Top items (period)</button></li>
              <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab === 'inactive'" (click)="tab = 'inactive'">Win back (inactive)</button></li>
            </ul>

            @if (tab !== 'items') {
              <div class="ly-filters">
                <input type="search" class="form-control" placeholder="Search name or phone" [(ngModel)]="search" aria-label="Search customers" />
                <select class="form-select" [(ngModel)]="tierFilter" aria-label="Tier">
                  <option value="">All tiers</option>
                  @for (t of data.tierCounts; track t.tier) { <option [value]="t.tier">{{ t.tier }}</option> }
                </select>
                <select class="form-select" [(ngModel)]="sortBy" aria-label="Sort">
                  <option value="totalSpent">Highest spend</option>
                  <option value="periodSpent">Spend in period</option>
                  <option value="visits">Most visits</option>
                  <option value="lastVisit">Recent visit</option>
                  <option value="points">Points</option>
                </select>
              </div>
              <div class="table-responsive">
                <table class="table custom-table">
                  <thead>
                    <tr>
                      <th>Customer</th><th>Phone</th><th>Tier</th><th class="text-end">Points</th><th class="text-end">Visits</th>
                      <th class="text-end">Total spent</th><th class="text-end">Avg bill</th><th class="text-end">Period spend</th>
                      <th>Last visit</th><th>Favourites</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of rows(); track c.customerId) {
                      <tr>
                        <td>{{ c.name }} @if (c.isNew) { <span class="badge bg-info ms-1">New</span> }</td>
                        <td>{{ c.phone }}</td>
                        <td><span class="ly-tier" [ngClass]="'ly-' + (c.tier | lowercase)">{{ c.tier }}</span></td>
                        <td class="text-end">{{ c.points | number }}</td>
                        <td class="text-end">{{ c.visits }}</td>
                        <td class="text-end">{{ c.totalSpent | number: '1.2-2' }}</td>
                        <td class="text-end">{{ c.avgBill | number: '1.2-2' }}</td>
                        <td class="text-end">{{ c.periodSpent | number: '1.2-2' }}</td>
                        <td>{{ c.lastVisit | date: 'dd-MM-yyyy' }} <small class="text-muted">({{ c.daysSinceLastVisit }}d)</small></td>
                        <td class="ly-fav">{{ c.favouriteItems.join(', ') }}</td>
                        <td><button type="button" class="btn btn-sm btn-outline-primary" (click)="openCustomer(c)">Details</button></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="11" class="text-center">No customers found. Bills count when they are settled with a customer.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="table-responsive">
                <table class="table custom-table">
                  <thead><tr><th>Item</th><th>Category</th><th class="text-end">Qty</th><th class="text-end">Amount</th><th class="text-end">Customers</th></tr></thead>
                  <tbody>
                    @for (i of data.topItems; track i.item) {
                      <tr><td>{{ i.item }}</td><td>{{ i.category }}</td><td class="text-end">{{ i.qty }}</td><td class="text-end">{{ i.amount | number: '1.2-2' }}</td><td class="text-end">{{ i.customers }}</td></tr>
                    } @empty { <tr><td colspan="5" class="text-center">No items in this period</td></tr> }
                  </tbody>
                </table>
              </div>
            }
          }
        </div>
      </div>
    </div>

    @if (detail) {
      <div class="ly-backdrop" (click)="detail = null"></div>
      <aside class="ly-drawer" role="dialog" aria-label="Customer details">
        <div class="ly-drawer-head">
          <div>
            <h3>{{ detail.name }}</h3>
            <span class="text-muted">{{ detail.phone }}{{ detail.email ? ' · ' + detail.email : '' }}</span>
          </div>
          <button type="button" class="btn-close" aria-label="Close" (click)="detail = null"></button>
        </div>

        <div class="ly-kpis ly-kpis-sm">
          <div class="ly-kpi"><span>Tier</span><strong>{{ detail.tier }}</strong></div>
          <div class="ly-kpi"><span>Points</span><strong>{{ detail.points | number }}</strong></div>
          <div class="ly-kpi"><span>Visits</span><strong>{{ detail.visits }}</strong></div>
          <div class="ly-kpi"><span>Total spent</span><strong>{{ detail.totalSpent | number: '1.0-0' }}</strong></div>
          <div class="ly-kpi"><span>Avg bill</span><strong>{{ detail.avgBill | number: '1.0-0' }}</strong></div>
          <div class="ly-kpi"><span>Visits every</span><strong>{{ detail.avgDaysBetweenVisits != null ? detail.avgDaysBetweenVisits + ' d' : '-' }}</strong></div>
        </div>
        <p class="ly-note">
          First visit {{ detail.firstVisit | date: 'dd-MM-yyyy' }} · last visit {{ detail.lastVisit | date: 'dd-MM-yyyy' }} ({{ detail.daysSinceLastVisit }} days ago)
          @if (detail.nextTier) { · Rs.{{ detail.toNextTier | number: '1.0-0' }} more to {{ detail.nextTier }} }
        </p>

        <h4>Interests (categories)</h4>
        @for (c of detail.categories; track c.category) {
          <div class="ly-bar-row">
            <span class="ly-bar-label">{{ c.category }}</span>
            <span class="ly-bar"><span [style.width.%]="c.share"></span></span>
            <span class="ly-bar-val">{{ c.share }}%</span>
          </div>
        } @empty { <p class="text-muted">No purchases yet.</p> }

        <h4>Item wise</h4>
        <div class="table-responsive">
          <table class="table table-sm">
            <thead><tr><th>Item</th><th>Category</th><th class="text-end">Qty</th><th class="text-end">Amount</th><th class="text-end">Times</th><th>Last</th></tr></thead>
            <tbody>
              @for (i of detail.items; track i.item) {
                <tr><td>{{ i.item }}</td><td>{{ i.category }}</td><td class="text-end">{{ i.qty }}</td><td class="text-end">{{ i.amount | number: '1.2-2' }}</td><td class="text-end">{{ i.timesOrdered }}</td><td>{{ i.lastOrdered | date: 'dd-MM-yy' }}</td></tr>
              }
            </tbody>
          </table>
        </div>

        <div class="ly-two">
          <div>
            <h4>Order type</h4>
            @for (o of detail.orderTypes; track o.orderType) { <div class="ly-kv"><span>{{ o.orderType }}</span><strong>{{ o.visits }}</strong></div> }
            <h4>Payment</h4>
            @for (p of detail.paymentModes; track p.mode) { <div class="ly-kv"><span>{{ p.mode | titlecase }}</span><strong>{{ p.bills }} · {{ p.amount | number: '1.0-0' }}</strong></div> }
          </div>
          <div>
            <h4>When they come</h4>
            @for (w of detail.weekdays; track w.day) { <div class="ly-kv"><span>{{ w.day }}</span><strong>{{ w.visits }}</strong></div> }
            @for (s of detail.timeOfDay; track s.slot) { @if (s.visits) { <div class="ly-kv"><span>{{ s.slot }}</span><strong>{{ s.visits }}</strong></div> } }
          </div>
        </div>

        <h4>Monthly spend</h4>
        @for (m of detail.monthly; track m.month) {
          <div class="ly-bar-row">
            <span class="ly-bar-label">{{ m.month }}</span>
            <span class="ly-bar"><span [style.width.%]="monthPct(m.amount)"></span></span>
            <span class="ly-bar-val">{{ m.amount | number: '1.0-0' }} ({{ m.visits }})</span>
          </div>
        }

        <h4>Recent bills</h4>
        <div class="table-responsive">
          <table class="table table-sm">
            <thead><tr><th>Bill</th><th>Date</th><th>Mode</th><th class="text-end">Amount</th></tr></thead>
            <tbody>
              @for (b of detail.bills; track b.billid) {
                <tr><td>{{ b.billNumber }}</td><td>{{ b.time | date: 'dd-MM-yy h:mm a' }}</td><td>{{ b.mode | titlecase }}</td><td class="text-end">{{ b.amount | number: '1.2-2' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </aside>
    }
  `,
  styles: `
    .ly-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 8px; }
    .ly-kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; }
    .ly-kpi span { font-size: 12px; color: #6b7280; } .ly-kpi strong { font-size: 1.3rem; }
    .ly-kpis-sm .ly-kpi strong { font-size: 1.05rem; }
    .ly-note { color: #6b7280; font-size: 13px; }
    .ly-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; } .ly-filters > * { max-width: 260px; }
    .ly-tier { padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; background: #e5e7eb; }
    .ly-silver { background: #e2e8f0; } .ly-gold { background: #fde68a; } .ly-platinum { background: #c7d2fe; } .ly-bronze { background: #fed7aa; }
    .ly-fav { max-width: 220px; font-size: 13px; }
    .ly-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 1040; }
    .ly-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(720px, 100vw); background: #fff; z-index: 1050; overflow-y: auto; padding: 16px 20px; box-shadow: -8px 0 24px rgba(0,0,0,.15); }
    .ly-drawer-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .ly-drawer h3 { margin: 0; font-size: 1.3rem; } .ly-drawer h4 { font-size: 1rem; margin: 16px 0 8px; }
    .ly-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 13px; }
    .ly-bar-label { width: 110px; flex: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ly-bar { flex: 1; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; } .ly-bar > span { display: block; height: 100%; background: #6366f1; }
    .ly-bar-val { width: 110px; flex: none; text-align: right; }
    .ly-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .ly-kv { display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px dashed #e5e7eb; padding: 2px 0; }
  `
})
export class CustomerLoyaltyComponent implements OnInit {
  fromDate = '';
  toDate = '';
  branchId: number | null = Number(localStorage.getItem('branchid')) || null;
  data: any = null;
  detail: any = null;
  tab: 'customers' | 'items' | 'inactive' = 'customers';
  search = '';
  tierFilter = '';
  sortBy = 'totalSpent';

  constructor(private query: QueryService, private state: StateService, private auth: AuthService) {}

  ngOnInit(): void {
    this.last30();
  }

  // Local dates (toISOString would shift the day before 05:30 in India).
  private ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private get scopedBranch(): number | null {
    return this.auth.isOutletOwner() ? this.branchId : null;
  }

  last30(): void {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    this.fromDate = this.ymd(from);
    this.toDate = this.ymd(to);
    this.load();
  }

  load(): void {
    this.state.setLoadingState(true);
    this.query.getLoyaltySummary(this.fromDate, this.toDate, this.scopedBranch)
      .pipe(finalize(() => this.state.setLoadingState(false)))
      .subscribe({
        next: (res: any) => this.data = res?.data || null,
        error: () => this.data = null
      });
  }

  rows(): any[] {
    if (!this.data) return [];
    const q = this.search.trim().toLowerCase();
    let list: any[] = this.data.customers;
    if (this.tab === 'inactive') list = list.filter(c => c.daysSinceLastVisit > this.data.settings.inactiveDays);
    if (this.tierFilter) list = list.filter(c => c.tier === this.tierFilter);
    if (q) list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q));
    const key = this.sortBy;
    return [...list].sort((a, b) => key === 'lastVisit'
      ? new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      : (b[key] || 0) - (a[key] || 0));
  }

  openCustomer(c: any): void {
    this.state.setLoadingState(true);
    this.query.getLoyaltyCustomer(c.customerId, this.scopedBranch)
      .pipe(finalize(() => this.state.setLoadingState(false)))
      .subscribe({ next: (res: any) => this.detail = res?.data || null });
  }

  monthPct(amount: number): number {
    const max = Math.max(...(this.detail?.monthly || []).map((m: any) => m.amount), 1);
    return Math.round((amount / max) * 100);
  }
}

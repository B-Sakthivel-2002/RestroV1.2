import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QueryService } from '@appservices/query.service';
import { StateService } from '@appservices/state.service';
import { AlertService } from '@appservices/alert.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { finalize } from 'rxjs';

// Home delivery bills only, as cards like the KOT board: customer, phone, address, items, total and a
// reprint button (the bill printer prints the ticket again, marked DUPLICATE, with the delivery address).
@Component({
  selector: 'app-home-delivery-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [BsModalService, AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Home Delivery Report</h2>
            <h3 class="cs-spl-tt">
              Report Date : ({{ post.fromDate | date: 'dd-MM-YYYY' }} -
              {{ post.toDate | date: 'dd-MM-YYYY' }})
            </h3>
          </div>
          <div class="btn-bg spl-bg">
            <div class="fl-spl-bg">
              <div class="dt-bg">
                <label class="ssb-tt">From Date</label>
                <input type="date" class="form-control" [(ngModel)]="post.fromDate" />
              </div>
              <div class="dt-bg">
                <label class="ssb-tt">To Date</label>
                <input type="date" class="form-control" [(ngModel)]="post.toDate" />
              </div>
              <button (click)="load()" class="btn btn-primary">Submit</button>
              <button class="btn btn-outline-secondary" title="Today" (click)="today()">
                <i class="pi pi-refresh"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="cnt">
          <div class="hd-toolbar">
            <input type="text" class="form-control hd-search" placeholder="Search bill no, name, phone or address"
              [(ngModel)]="search" />
            <span class="hd-total">
              Delivery bills: <b>{{ count }}</b> &middot; Total: <b>{{ totalAmount | number: '1.2-2' }}</b>
            </span>
          </div>

          <div class="hd-grid">
            @for (bl of filtered; track bl.billid) {
              <div class="kot-card hd-card" [class.hd-cancelled]="bl.lifecyclestatus === 'cancelled'">
                <div class="sb-tt kot-hd-txt hd-head">
                  <span class="hd-name" [title]="bl.customerName || 'No name'"><i class="pi pi-user"></i> {{ bl.customerName || 'No name' }}</span>
                  <span class="sb-badge hd-billno" [title]="bl.billnumber">{{ bl.billnumber }}</span>
                </div>

                <div class="sb-tt">
                  <div class="sb-cnt">
                    <div>
                      <span class="spl-tt">Date: {{ bl.datetime | date: 'dd-MM-yyyy hh:mm a' }}</span>
                      <span class="spl-tt txt-camel">Status: {{ bl.lifecyclestatus }}</span>
                    </div>
                    <div>
                      <span class="spl-tt"><i class="pi pi-phone"></i> {{ bl.phone || '-' }}</span>
                      <span class="spl-tt txt-camel">{{ bl.status }}{{ bl.paymentmode ? ' · ' + bl.paymentmode : '' }}</span>
                    </div>
                    @if (bl.branch) {
                      <div><span class="spl-tt">Branch: {{ bl.branch }}</span></div>
                    }
                  </div>
                </div>

                <div class="hd-address">
                  <i class="pi pi-map-marker"></i>
                  <span>{{ bl.address || 'No address saved' }}</span>
                </div>

                <div class="cs-tb-gd">
                  <div class="cs-tb-hd">
                    <div class="ct">Item</div>
                    <div class="lft">Qty</div>
                    <div class="rgt hd-amt">Amount</div>
                  </div>
                  @for (it of bl.items; track it.itemId) {
                    <div class="cs-tb-body">
                      <div class="ct">{{ it.itemName }}</div>
                      <div class="lft">{{ it.qty }}</div>
                      <div class="rgt hd-amt">{{ it.amount | number: '1.2-2' }}</div>
                    </div>
                  } @empty {
                    <div class="cs-tb-body hd-noitems">No items</div>
                  }
                </div>

                <div class="hd-foot">
                  <div class="hd-sum">
                    <span class="spl-tt">Total</span>
                    <b>{{ bl.totalamount | number: '1.2-2' }}</b>
                  </div>
                  <button class="btn btn-primary" title="Print this bill again"
                    [disabled]="!bl.canReprint || printing === bl.billid"
                    (click)="reprint(bl)">
                    <i class="pi pi-print"></i>
                    {{ printing === bl.billid ? 'Sending...' : 'Reprint' }}
                  </button>
                </div>
              </div>
            } @empty {
              <div class="no-data">No home delivery bills</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    /* 3 cards per row, filled left to right (row by row); 2 on mid screens, 1 on phones. */
    .hd-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 20px;
      padding: 10px;
      align-items: stretch;
    }
    @media (max-width: 1199.98px) { .hd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 767.98px) { .hd-grid { grid-template-columns: minmax(0, 1fr); } }
    .hd-grid .no-data { grid-column: 1 / -1; }
    .hd-card { display: flex; flex-direction: column; margin: 0; min-width: 0; }
    .hd-head { gap: 10px; }
    .hd-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hd-billno { flex: 0 0 auto; font-size: var(--rp-fs-xs) !important; padding: 3px 8px !important; white-space: nowrap; }
    .hd-card .cs-tb-gd { margin-bottom: 12px; }
    .hd-noitems { justify-content: center; color: var(--rp-text-muted); font-size: var(--rp-fs-sm); padding: 4px 0; }
    .hd-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 0 10px 10px; }
    .hd-search { max-width: 360px; }
    .hd-total { color: var(--rp-text-muted); }
    .hd-total b { color: var(--rp-text); }
    .hd-address {
      display: flex; gap: 8px; align-items: flex-start;
      margin-top: 10px; padding: 10px 12px;
      border-radius: var(--bs-border-radius);
      background: var(--rp-surface-2, rgba(127, 140, 160, 0.1));
      white-space: pre-line; word-break: break-word;
    }
    .hd-address .pi { margin-top: 3px; color: var(--rp-primary); }
    .hd-amt { width: 90px; }
    .hd-foot {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: auto; /* keeps Total + Reprint on the card's bottom edge */
      padding-top: 10px; padding-top: 10px; border-top: 1px solid var(--rp-border);
    }
    .hd-sum { display: flex; flex-direction: column; }
    .hd-sum b { font-size: 18px; }
    .hd-cancelled { opacity: 0.6; }
    .hd-cancelled .kot-hd-txt span:first-child { text-decoration: line-through; }
  `,
})
export class HomeDeliveryReportComponent implements OnInit {
  post = { fromDate: this.formatDate(new Date()), toDate: this.formatDate(new Date()) };
  bills: any[] = [];
  search = '';
  count = 0;
  totalAmount = 0;
  printing: number | null = null;

  constructor(
    private query: QueryService,
    private stateService: StateService,
    private alertService: AlertService,
  ) {}

  ngOnInit() {
    this.load();
  }

  get filtered(): any[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.bills;
    return this.bills.filter((b) =>
      [b.billnumber, b.customerName, b.phone, b.address]
        .some((v) => (v ?? '').toString().toLowerCase().includes(q)),
    );
  }

  formatDate(date: Date) {
    return date.toISOString().substring(0, 10); // YYYY-MM-DD
  }

  today() {
    this.post = { fromDate: this.formatDate(new Date()), toDate: this.formatDate(new Date()) };
    this.load();
  }

  load() {
    this.stateService.setLoadingState(true);
    this.query
      .getHomeDeliveryBills(this.post.fromDate, this.post.toDate)
      .pipe(finalize(() => this.stateService.setLoadingState(false)))
      .subscribe({
        next: (res: any) => {
          this.bills = res.data || [];
          this.count = res.count || 0;
          this.totalAmount = res.totalAmount || 0;
        },
        error: (err: any) =>
          this.alertService.showAlert('Error', err?.error?.message || 'Could not load the delivery bills'),
      });
  }

  reprint(bl: any) {
    this.printing = bl.billid;
    this.query
      .reprintBill(bl.billid)
      .pipe(finalize(() => (this.printing = null)))
      .subscribe({
        next: (res: any) => this.alertService.showAlert('Success', res?.message || 'Bill sent to the printer'),
        error: (err: any) => this.alertService.showAlert('Error', err?.error?.message || 'Could not print the bill'),
      });
  }
}

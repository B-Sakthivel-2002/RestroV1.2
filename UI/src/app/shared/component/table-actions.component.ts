import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { QueryService } from '@appservices/query.service';

export type TableActionMode = 'transfer' | 'merge' | 'split';

// Dialog for moving guests between tables: transfer (to a free table), merge (other tables into this one)
// and split bill (items to another guest at the same table). Opened with BsModalService.show(..., { initialState }).
@Component({
  selector: 'app-table-actions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-header">
      <h4 class="modal-title pull-left">{{ title }}</h4>
      <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="modalRef.hide()"></button>
    </div>

    <div class="modal-body">
      @if (loading) {
        <p class="text-muted">Loading...</p>
      } @else {

        <!-- TRANSFER -->
        @if (mode === 'transfer') {
          @if (orders.length) {
            <p class="mb-1 fw-semibold">Orders to move</p>
            @for (o of orders; track o.orderid) {
              <label class="ta-row">
                <input type="checkbox" [(ngModel)]="o.selected" [disabled]="o.status === 'printed'" />
                <span>{{ o.ordernumber }} &middot; {{ o.totalprice | number:'1.0-2' }}
                  @if (o.guestlabel) { &middot; {{ o.guestlabel }} }
                  @if (o.status === 'printed') { <span class="badge bg-warning text-dark">bill printed</span> }
                </span>
              </label>
            }
          } @else {
            <p class="text-muted">No open orders. The seated party will move to the new table.</p>
          }
          <p class="mb-1 mt-3 fw-semibold">Move to</p>
          @if (freeTables.length === 0) {
            <p class="text-muted">No free table right now.</p>
          }
          <div class="ta-tables">
            @for (t of freeTables; track t.tableid) {
              <button type="button" class="btn" [class.btn-primary]="targetId === t.tableid" [class.btn-outline-secondary]="targetId !== t.tableid" (click)="targetId = t.tableid">
                {{ t.tablename }} <small>({{ t.capacity }})</small>
              </button>
            }
          </div>
        }

        <!-- MERGE -->
        @if (mode === 'merge') {
          <p>Choose the tables to join with <strong>{{ tableName }}</strong>. Their orders move here and are billed together.</p>
          @if (mergeCandidates.length === 0) {
            <p class="text-muted">No other table can be merged right now.</p>
          }
          <div class="ta-tables">
            @for (t of mergeCandidates; track t.tableid) {
              <button type="button" class="btn" [class.btn-primary]="t.selected" [class.btn-outline-secondary]="!t.selected" (click)="t.selected = !t.selected">
                {{ t.tablename }} <small>({{ t.state }}{{ t.openOrders ? ', ' + (t.openAmount | number:'1.0-2') : '' }})</small>
              </button>
            }
          </div>
        }

        <!-- SPLIT -->
        @if (mode === 'split') {
          @if (splitLines.length === 0) {
            <p class="text-muted">No unbilled items on this table.</p>
          } @else {
            <p class="mb-2">Add the items that the selected customer will pay for.</p>
            <table class="table table-sm align-middle">
              <thead><tr><th>Item</th><th>Customer</th><th class="text-end">Qty</th><th class="text-center">Move</th></tr></thead>
              <tbody>
                @for (l of splitLines; track l.orderdetailid) {
                  <tr [class.ta-selected]="l.move > 0">
                    <td>{{ l.name }} <small class="text-muted">({{ l.price }})</small></td>
                    <td>{{ customerOf(l) }}</td>
                    <td class="text-end">{{ l.qty }}</td>
                    <td class="text-center text-nowrap">
                      <button type="button" class="btn btn-sm btn-outline-primary" (click)="l.move = l.move < l.qty ? l.move + 1 : l.qty" [disabled]="l.move === l.qty || !movable(l)">Add</button>
                      @if (l.qty > 1 && l.move > 0) { <span class="ta-move">{{ l.move }} of {{ l.qty }}</span> }
                      <button type="button" class="btn btn-sm btn-outline-secondary ms-1" (click)="l.move = l.move > 0 ? l.move - 1 : 0" [disabled]="l.move === 0">Remove</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <div class="row g-2 align-items-end">
              <div class="col-sm-6">
                <label class="form-label mb-1" for="taCustomer">Customer</label>
                <select id="taCustomer" class="form-select" [(ngModel)]="splitCustomerId">
                  <option [ngValue]="null" disabled>Select customer</option>
                  @for (c of customers; track c.customerid) {
                    <option [ngValue]="c.customerid">{{ c.name }}{{ c.contactnumber ? ' - ' + c.contactnumber : '' }}</option>
                  }
                  <option [ngValue]="newCustomerKey">+ Add customer</option>
                </select>
              </div>
              @if (splitCustomerId === newCustomerKey) {
                <div class="col-sm-3">
                  <label class="form-label mb-1" for="taNewName">Customer name</label>
                  <input id="taNewName" class="form-control" [(ngModel)]="newCustomerName" maxlength="100" />
                </div>
                <div class="col-sm-3">
                  <label class="form-label mb-1" for="taNewPhone">Mobile</label>
                  <input id="taNewPhone" class="form-control" [(ngModel)]="newCustomerPhone" maxlength="20" inputmode="tel" />
                </div>
              }
            </div>
            <p class="small text-muted mt-2 mb-0">Afterwards, each customer has a tab on the order screen with its own bill. A new customer is saved in the customer master.</p>
          }
        }

        @if (errorMessage) { <div class="alert alert-danger mt-3 mb-0">{{ errorMessage }}</div> }
      }
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-primary" (click)="submit()" [disabled]="saving || !canSubmit()">
        {{ saving ? 'Please wait...' : submitLabel }}
      </button>
      <button type="button" class="btn btn-secondary" (click)="modalRef.hide()">Close</button>
    </div>
  `,
  styles: `
    .ta-row { display: flex; gap: 8px; align-items: center; padding: 4px 0; }
    .ta-tables { display: flex; flex-wrap: wrap; gap: 8px; }
    .ta-tables .btn { min-width: 72px; }
    .ta-move { display: inline-block; min-width: 44px; text-align: center; font-weight: 700; font-size: .85rem; }
    .ta-selected td { background: #e8f0fe; }
  `
})
export class TableActionsComponent implements OnInit {

  // Set through initialState.
  mode: TableActionMode = 'transfer';
  tableId = 0;
  tableName = '';
  // Outlet owner viewing another branch; null = own branch.
  branchId: number | null = null;
  onDone?: (result: any) => void;

  readonly newCustomerKey = -1;

  loading = true;
  saving = false;
  errorMessage = '';

  orders: any[] = [];
  freeTables: any[] = [];
  mergeCandidates: any[] = [];
  targetId: number | null = null;

  splitLines: any[] = [];
  customers: any[] = [];
  splitCustomerId: number | null = null;
  newCustomerName = '';
  newCustomerPhone = '';

  constructor(public modalRef: BsModalRef, private query: QueryService) {}

  get title(): string {
    switch (this.mode) {
      case 'transfer': return `Transfer ${this.tableName}`;
      case 'merge': return `Merge tables into ${this.tableName}`;
      default: return `Split bill - ${this.tableName}`;
    }
  }

  get submitLabel(): string {
    return this.mode === 'transfer' ? 'Move' : this.mode === 'merge' ? 'Merge' : 'Assign to selected Customer';
  }

  ngOnInit(): void {
    if (this.mode === 'split') {
      this.loadSplit();
    } else {
      this.loadTablesAndOrders();
    }
  }

  canSubmit(): boolean {
    if (this.loading) {
      return false;
    }
    switch (this.mode) {
      case 'transfer':
        return !!this.targetId && (this.orders.length === 0 || this.orders.some(o => o.selected));
      case 'merge':
        return this.mergeCandidates.some(t => t.selected);
      default:
        return this.splitLines.some(l => l.move > 0 && this.movable(l)) && this.splitCustomerId !== null
          && (this.splitCustomerId !== this.newCustomerKey || !!this.newCustomerName.trim());
    }
  }

  // Who pays for the line: its split customer, else the customer chosen on the order screen (by id), else Unknown.
  customerOf(line: any): string {
    return line.guestlabel
      || line.customername
      || (line.customerid > 0 ? this.customers.find(c => c.customerid === line.customerid)?.name : null)
      || 'Unknown';
  }

  // Items already with the chosen customer cannot be moved to that customer.
  movable(line: any): boolean {
    if (this.splitCustomerId === null || this.splitCustomerId === this.newCustomerKey) {
      return true;
    }
    const name = this.customers.find(c => c.customerid === this.splitCustomerId)?.name;
    return !(line.guestlabel && line.guestlabel === name);
  }

  submit(): void {
    this.errorMessage = '';
    this.saving = true;
    let call;
    if (this.mode === 'transfer') {
      const all = this.orders.every(o => o.selected);
      const ids = all ? [] : this.orders.filter(o => o.selected).map(o => o.orderid);
      call = this.query.transferTable(this.tableId, this.targetId!, ids);
    } else if (this.mode === 'merge') {
      call = this.query.mergeTables(this.tableId, this.mergeCandidates.filter(t => t.selected).map(t => t.tableid));
    } else {
      this.assignToCustomer();
      return;
    }

    call.subscribe({
      next: (res: any) => {
        this.saving = false;
        this.modalRef.hide();
        this.onDone?.({ mode: this.mode, ...res });
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMessage = err?.error?.message || 'Something went wrong';
      }
    });
  }

  private loadTablesAndOrders(): void {
    let pending = 2;
    const done = () => { if (--pending === 0) { this.loading = false; } };

    this.query.getTableBoard(this.branchId).subscribe({
      next: (res: any) => {
        const tables: any[] = res.data?.tables || [];
        const others = tables.filter(t => t.tableid !== this.tableId);
        // Transfer: every table except occupied ones (orders on it, or merged into another table).
        // Reserved / Blocked tables can still take the transfer.
        this.freeTables = others.filter(t => t.state !== 'Occupied' && !t.mergedinto);
        const empty = (t: any) => !t.mergedinto && !t.held && t.state === 'Available';
        // Empty tables or tables with guests; not blocked, held for a token or already merged elsewhere.
        this.mergeCandidates = others
          .filter(t => empty(t) || (!t.mergedinto && !t.held && t.state === 'Occupied'))
          .map(t => ({ ...t, selected: false }));
        done();
      },
      error: () => done()
    });

    this.query.getOrderByTableId(this.tableId).subscribe({
      next: (res: any) => {
        this.orders = (res.data || []).map((o: any) => ({ ...o, selected: o.status !== 'printed' }));
        done();
      },
      error: () => done()
    });
  }

  // Split: creates the customer first when "Add customer" was chosen, then moves the items to them.
  private assignToCustomer(): void {
    const items = this.splitLines.filter(l => l.move > 0 && this.movable(l)).map(l => ({ orderDetailId: l.orderdetailid, qty: l.move }));
    const fail = (err: any) => {
      this.saving = false;
      this.errorMessage = err?.error?.message || 'Something went wrong';
    };
    const split = (customerId: number) => this.query.splitOrderItems(this.tableId, '', items, customerId).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.modalRef.hide();
        this.onDone?.({ mode: this.mode, ...res });
      },
      error: fail
    });

    if (this.splitCustomerId !== this.newCustomerKey) {
      split(this.splitCustomerId!);
      return;
    }
    const customer = {
      customerid: 0,
      name: this.newCustomerName.trim(),
      contactnumber: this.newCustomerPhone.trim(),
      email: '',
      address: '',
      branchid: this.branchId ?? Number(localStorage.getItem('branchid') || 0),
      outletid: Number(localStorage.getItem('outletid') || 0)
    };
    this.query.addCustomer(customer).subscribe({
      next: (res: any) => {
        this.query.clearCustomerCache();
        const id = res?.data?.customerid;
        if (!id) {
          fail({ error: { message: 'The customer could not be created' } });
          return;
        }
        split(id);
      },
      error: fail
    });
  }

  private loadSplit(): void {
    this.query.getBranchCustomers().subscribe({
      next: (res: any) => this.customers = (res.data || []).slice().sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
      error: () => this.customers = []
    });
    this.query.getOrderByTableId(this.tableId).subscribe({
      next: (res: any) => {
        const orders: any[] = (res.data || []).filter((o: any) => o.status === 'submitted');
        this.splitLines = orders.flatMap(o => (o.orderdetail || []).map((d: any) => ({
          ...d, guestlabel: o.guestlabel, customerid: o.customerid, customername: o.customername, move: 0
        })));

        this.splitCustomerId = null;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

}

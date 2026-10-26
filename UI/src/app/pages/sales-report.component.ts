import {
  ChangeDetectorRef,
  Component,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { QueryService } from '@appservices/query.service';
import { async, from, finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';
import { Router } from '@angular/router';
import { StateService } from '@appservices/state.service';
import * as XLSX from 'xlsx';

interface PostBillType {
  status: string;
  paymentmode: string;
  paidamount?: number | null;
  notes: string;
  iscomplementary: boolean;
  complementaryreason: string;
  lifecycleStatus?: string;
}

export interface IOrderTypeWise {
  ordertypeid: number;  
  ordertypename: string;  
}

export interface Order {
  orderid: number | string;
}
export interface itemWiseOrder {
  itemid: number;
  itemName: string;
  qty: number;
  amount: number;
}
@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  providers: [BsModalService, AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Sale Report</h2>
            <h3 class="cs-spl-tt">
              Report Date : ({{ post.fromDate | date: 'dd-MM-YYYY' }} -
              {{ post.toDate | date: 'dd-MM-YYYY' }})
            </h3>
          </div>
          <div class="btn-bg spl-bg">
            <div class="fl-spl-bg">
              <div class="dt-bg">
                <label class="ssb-tt">From Date</label>
                <input
                  type="date"
                  class="form-control"
                  [(ngModel)]="post.fromDate"
                />
              </div>
              <div class="dt-bg">
                <label class="ssb-tt">To Date</label>
                <input
                  type="date"
                  class="form-control"
                  [(ngModel)]="post.toDate"
                />
              </div>
              <div class="dt-bg">
                <label class="ssb-tt">Payment Status</label>
                <select class="form-control" [(ngModel)]="post.status">
                  <option value="all" default>All</option>
                  <option value="paid">paid</option>
                  <option value="unpaid">unpaid</option>
                </select>
              </div>

              <div class="dt-bg">
                <label class="ssb-tt">Order Type</label>
                <select class="form-control" [(ngModel)]="post.orderType">
                  <option value="all">All</option>
                  @for(st of orderTypeList; track st.ordertypeid){
                    <option [value]="st.ordertypename">{{st.ordertypename}}</option>
                  }
                </select>
              </div>
              

              <button (click)="getOrderByDate()" class="btn btn-primary">
                Submit
              </button>
              <button (click)="TodayDate()" class="btn btn-outline-secondary" title="Today">
                <i class="pi pi-refresh"></i>
              </button>
              <button (click)="TodayDate()" class="btn btn-outline-secondary" title="Today">
                <i class="pi pi-calendar-clock"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="cnt">
          

          <div class="row">
            <div class="col-12">
              <div>
                <div class="ds-grd-box">
                  <div class="grd-cnt">
                    <span>Total</span>
                    <h2>{{ getTotalWithTax() | number: '1.2-2' }}</h2>
                    <div class="sm-cnt">
                      <div>
                        <span class="sb-tt">Sub Total</span>
                        <h4 class="mn-tt">
                          {{ getTotalSubTotal() | number: '1.2-2' }}
                        </h4>
                      </div>
                      <div>
                        <span class="sb-tt">Tax</span>
                        <h4 class="mn-tt">
                          {{ getTotalTax() | number: '1.2-2' }}
                        </h4>
                      </div>
                    </div>
                  </div>

                  @for (bl of orderTypeWise; track bl.orderTypeId) {
                    <div class="grd-cnt">
                      <span>{{ bl.ordertype }}</span>
                      <h2>
                        {{
                          bl.totalWithTax
                            ? (bl.totalWithTax | number: '1.2-2')
                            : 0.0
                        }}
                      </h2>
                      <div class="sm-cnt">
                        <div>
                          <span class="sb-tt">Sub Total</span>
                          <h4 class="mn-tt">
                            {{ bl.subTotalAmount | number: '1.2-2' }}
                          </h4>
                        </div>
                        <div>
                          <span class="sb-tt">Tax</span>
                          <h4 class="mn-tt">
                            {{ bl.totalTax | number: '1.2-2' }}
                          </h4>
                        </div>
                      </div>
                    </div>

                    <!-- <tr>
                              <td>{{bl.ordertype}}</td>                          
                              <td>{{bl.subTotalAmount | number:'1.2-2'}}</td>
                              <td>{{bl.totalTax | number:'1.2-2'}}</td>
                              <td>{{bl.totalWithTax | number:'1.2-2'}}</td>
                            </tr> -->
                  }

                  @if (itemWiseOrders && itemWiseOrders.length != 0) {
                    <div class="grd-cnt">
                      <span>Item Wise Report</span>
                      <!-- <h2>1000</h2> -->
                      <div class="sm-cnt cs-column cs-auto-scroll">
                        @for (item of itemWiseOrders; track item.itemid) {
                          <div class="menuListReport">
                            <span class="sb-tt"
                              >{{ item.itemName }}
                              <b class="badge">{{ item.qty }}</b></span
                            >
                            <!-- <h4 class="mn-tt"></h4>
                                <h4 class="mn-tt">{{item.amount | number:'1.2-2'}}</h4> -->
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="col-12 cs-tab">
              <ul class="nav nav-pills" role="tablist">
                <li class="nav-item" role="presentation">
                  <button
                    class="nav-link active"
                    id="bill-summary-tab"
                    data-bs-toggle="pill"
                    data-bs-target="#bill-summary"
                    type="button"
                    role="tab"
                    aria-controls="bill-summary"
                    aria-selected="true"
                  >
                    Bills
                  </button>
                </li>

                <li class="nav-item" role="presentation">
                  <button
                    class="nav-link"
                    id="summary-tab"
                    data-bs-toggle="pill"
                    data-bs-target="#summary"
                    type="button"
                    role="tab"
                    aria-controls="summary"
                    aria-selected="false"
                  >
                    Summary
                  </button>
                </li>

                <li class="nav-item" role="presentation">
                  <button
                    class="nav-link"
                    id="itemwise-tab"
                    data-bs-toggle="pill"
                    data-bs-target="#itemwise"
                    type="button"
                    role="tab"
                    aria-controls="itemwise"
                    aria-selected="false"
                  >
                    Item Wise
                  </button>
                </li>
                <li>
                  <button class="btn btn-success" (click)="exportToExcel()">
                    Export to Excel
                  </button>
                </li>
              </ul>
              <div class="tab-content " id="summary-content">
                <div
                  class="tab-pane fade show active"
                  id="bill-summary"
                  role="tabpanel"
                  aria-labelledby="bill-summary-tab"
                >
                  <div class="custom-table-bg">
                    <h3 class="cs-mn-tt">Bill Summary</h3>
                    <div class="fl-bg">
                      <div class="ls">
                        <label>Bill ID</label>
                        <input
                          type="text"
                          value=""
                          class="form-control"
                          [(ngModel)]="billFilter.billId"
                          (ngModelChange)="billFilterList()"
                        />
                      </div>
                       <div class="ls">
                        <label>Bill Number</label>
                        <input
                          type="text"
                          value=""
                          class="form-control"
                          [(ngModel)]="billFilter.billnumber"
                          (ngModelChange)="billFilterList()"
                        />
                      </div>
                      <div class="ls">
                        <label>Total Amount</label>
                        <input
                          type="text"
                          value=""
                          class="form-control"
                          [(ngModel)]="billFilter.totalAmount"
                          (ngModelChange)="billFilterList()"
                        />
                      </div>
                      <div class="ls">
                        <label>Bill Status</label>
                        <select
                          class="form-select"
                          (ngModelChange)="billFilterList()"
                          [(ngModel)]="billFilter.status"
                          (change)="onChangeFilter($event)"
                        >
                          <option value="">All</option>
                          <option value="printed">Printed</option>
                          <option value="finalized">Finalized</option>
                          <option value="complementary">Complementary</option>
                        </select>
                      </div>
                      <!-- <div class="ls">
                        <label>Order Type</label>
                        <select
                          class="form-select"
                          [(ngModel)]="billFilter.orderType"
                          (ngModelChange)="billFilterList()"
                        >
                          <option value="">All</option>
                          <option value="Dine-in">Dine-in</option>
                          <option value="Takeaway">Takeaway</option>
                        </select>
                      </div> -->

                    </div>

                    <table class="table custom-table" id="billSummaryTable">
                      <thead>
                        <tr>
                          <th>Bill Id</th>
                          <th>Bill Number</th>
                          <th>Business Date</th>
                          <th>Sub Total Amount</th>
                          <th>Tax</th>
                          <th>Discount</th>
                          <th>Extra Charges</th>
                          <th>Total Amount</th>
                          <th>Bill Status</th>
                          <th>Payment Status</th>
                          <th>Order Type</th>
                          <th>Order Ids</th>
                          <th>Branch</th>
                          <th style="width:200px;">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (
                          bl of pagedOrderList;
                          track bl.billid;
                          let blIndex = $index
                        ) {
                          <tr>
                            <td>{{ bl.billid }}</td>
                            <td>{{ bl.billnumber }}</td>
                            <!-- <td>{{bl.datetime	 | date: 'dd-MM-yyyy'}}</td> -->
                            <td>{{ bl.businessdate | date: 'dd-MM-yyyy' }}</td>
                            <td>{{ bl.subtotal }}</td>
                            <td>{{ bl.tax }}</td>
                            <td>{{ bl.discount }}</td>
                            <td>{{ bl.extraamount }}</td>
                            <td>{{ bl.totalamount }}</td>
                            <td class="txt-camel">{{ bl.lifecyclestatus }}</td>
                            <td>{{ bl.status }}</td>
                            <td>{{ bl.orders[0].orderType }}</td>
                            <td>{{ getOrderIds(bl.orders) }}</td>
                            <td>{{ bl.branch }}</td>

                            <td>
                              <button
                                class="btn btn-primary" title="Update settlement"
                                (click)="
                                  openModal(
                                    settleTemplate,
                                    blIndex,
                                    'updateBill'
                                  )
                                "
                                *ngIf="bl.lifecyclestatus == 'printed'"
                              >
                                <i class="pi pi-pencil"></i>
                              </button>

                              <button
                                class="btn btn-primary"
                                (click)="
                                  openModal(
                                    orderFloorTemplate,
                                    blIndex,
                                    'orderView'
                                  )
                                "
                              >
                                <i class="pi pi-list-check"></i>
                              </button>
                            </td>
                            <!-- <td>
                                        <button class="btn btn-primary">
                                          <i class="pi pi-file-o"></i>
                                      </button></td> -->
                          </tr>
                        } @empty {
                          <tr>
                            <td colspan="12" class="text-center">
                              No data found
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>

                    <div
                      class="d-flex justify-content-between align-items-center mt-3"
                    >
                      <!-- Rows per page -->
                      <div>
                        <label>Rows per page</label>
                        <select
                          class="form-select d-inline w-auto ms-2"
                          [(ngModel)]="pageSize"
                          (change)="onPageSizeChange()"
                        >
                          @for (opt of pageSizeOptions; track opt) {
                            <option [value]="opt">{{ opt }}</option>
                          }
                        </select>
                      </div>

                      <!-- Pagination buttons -->
                      <ul class="pagination mb-0">
                        <!-- PREV -->
                        <li
                          class="page-item"
                          [class.disabled]="currentPage === 1"
                        >
                          <button
                            class="page-link"
                            (click)="changePage(currentPage - 1)"
                          >
                            <
                          </button>
                        </li>

                        <!-- PAGE NUMBERS -->
                        @for (p of pages; track p) {
                          <li
                            class="page-item"
                            [class.active]="currentPage === p"
                          >
                            <button class="page-link" (click)="changePage(p)">
                              {{ p }}
                            </button>
                          </li>
                        }

                        <!-- NEXT -->
                        <li
                          class="page-item"
                          [class.disabled]="currentPage === totalPages"
                        >
                          <button
                            class="page-link"
                            (click)="changePage(currentPage + 1)"
                          >
                            >
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div
                  class="tab-pane fade"
                  id="summary"
                  role="tabpanel"
                  aria-labelledby="summary"
                >
                  <h3 class="cs-mn-tt">Report Summary</h3>
                  <table class="table custom-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Sub Total</th>
                        <th>Tax</th>
                        <th>Total (with tax)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- Order type rows -->
                      @for (bl of orderTypeWise; track bl.orderTypeId) {
                        <tr>
                          <td>{{ bl.ordertype }}</td>
                          <td>{{ bl.subTotalAmount | number: '1.2-2' }}</td>
                          <td>{{ bl.totalTax | number: '1.2-2' }}</td>
                          <td>{{ bl.totalWithTax | number: '1.2-2' }}</td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="4">No data found</td>
                        </tr>
                      }

                      <!-- TOTAL -->
                      <tr>
                        <td><b>Total</b></td>
                        <td class="txt-blue">
                          <b>{{ getTotalSubTotal() | number: '1.2-2' }}</b>
                        </td>
                        <td class="txt-blue">
                          {{ getTotalTax() | number: '1.2-2' }}
                        </td>
                        <td class="txt-blue">
                          <b>{{ getTotalWithTax() | number: '1.2-2' }}</b>
                        </td>
                      </tr>

                      <!-- UNPAID -->
                      @if (getUnpaidTotal() > 0) {
                        <tr class="bg-black">
                          <td>Unpaid</td>
                          <td colspan="3">
                            {{ getUnpaidTotal() | number: '1.2-2' }}
                          </td>
                        </tr>
                      }

                      <!-- PAID -->
                      @if (getPaidTotal() > 0) {
                        <tr class="bg-green">
                          <td>Paid</td>
                          <td colspan="3">
                            {{ getPaidTotal() | number: '1.2-2' }}
                          </td>
                        </tr>
                      }

                      <!-- COMPLEMENTARY -->
                      @if (getComplementaryTotal() > 0) {
                        <tr class="bg-grey">
                          <td>Complementary</td>
                          <td colspan="3">
                            {{ getComplementaryTotal() | number: '1.2-2' }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <div
                  class="tab-pane fade"
                  id="itemwise"
                  role="tabpanel"
                  aria-labelledby="itemwise"
                >
                  <h3 class="cs-mn-tt">Item Wise Report</h3>
                  <div class="row">
                    <div class="col-md-6">
                      <table class="table table-bordered table-striped custom-table">
                        <thead>
                          <tr>
                            <th>Menu Name</th>
                            <th>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of leftItems; track item.itemid) {
                            <tr>
                              <td>{{ item.itemName }}</td>
                              <td>{{ item.qty }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>

                    <div class="col-md-6">
                      <table class="table table-bordered table-striped custom-table">
                        <thead>
                          <tr>
                            <th>Menu Name</th>
                            <th>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of rightItems; track item.itemid) {
                            <tr>
                              <td>{{ item.itemName }}</td>
                              <td>{{ item.qty }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ng-template #orderFloorTemplate>
      <div class="modal-header">
        <h4 class="modal-title custom-modal-title pull-left">
          Bill Id: {{ pagedOrderList[selectedOrderId].billid }}
          <span
            >Date :
            {{
              pagedOrderList[selectedOrderId].businessdate | date: 'dd-MM-yyyy'
            }}</span
          >
        </h4>
        <button
          type="button"
          class="btn-close close pull-right"
          aria-label="Close"
          (click)="orderFloorModalRef?.hide()"
        >
          <span aria-hidden="true" class="visually-hidden">&times;</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="cnt-scrl">
          <!-- {{pagedOrderList[selectedOrderId]?.orders | json}}      -->
          @for (
            bl of pagedOrderList[selectedOrderId]?.orders;
            track bl.orderid;
            let ind = $index
          ) {
            <table class="table custom-table table-bordered spl-table">
              <thead>
                <tr>
                  <th colspan="4">Order No: {{ bl.orderid }}</th>
                </tr>
                <tr>
                  <th>Menu Name</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Sum of Price</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  tl of bl?.orderDetails;
                  track tl.orderdetailid;
                  let tlind = $index
                ) {
                  <tr>
                    <td>{{ tl.name }}</td>
                    <td>({{ tl.price }})</td>
                    <td>{{ tl.qty }}</td>
                    <td>{{ tl.sumofprice }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @empty {
            No data found
          }

          <table class="table custom-table table-bordered spl-table">
            <thead>
              <tr>
                <th>Sub Total</th>
                <th>Tax</th>
                <th>Extra Amount</th>
                <th>Discount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ pagedOrderList[selectedOrderId].subtotal }}</td>
                <td>{{ pagedOrderList[selectedOrderId].tax }}</td>
                <td>{{ pagedOrderList[selectedOrderId].extraamount }}</td>
                <td>{{ pagedOrderList[selectedOrderId].discount }}</td>
                <td>{{ pagedOrderList[selectedOrderId].totalamount }}</td>
              </tr>
            </tbody>
          </table>

          <table class="table custom-table table-bordered spl-table">
            <thead>
              <tr>
                <th>Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ pagedOrderList[selectedOrderId].paidamount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer"></div>
    </ng-template>

    <ng-template #settleTemplate *ngIf="postBill">
      <div class="modal-header">
        <h4 class="modal-title pull-left">
          {{ postBill.status ? 'Update Settle' : 'Settle' }}
        </h4>
        <button
          type="button"
          class="btn-close close pull-right"
          aria-label="Close"
          (click)="settleModalRef?.hide()"
        >
          <span aria-hidden="true" class="visually-hidden">&times;</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="row mb3">
          <div class="col-md-6">
            <label class="col-form-label">Payment Status</label>
            <select
              class="form-select"
              [(ngModel)]="postBill.status"
              (ngModelChange)="onStatusChange($event)"
            >
              <option value="" default>Select status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="col-form-label">Payment Mode</label>
            <select
              class="form-select"
              [(ngModel)]="postBill.paymentmode"
              [disabled]="postBill.status !== 'paid' ? true : false"
            >
              <option value="" default>Select payment</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="split">Split</option>
            </select>
          </div>
        </div>
        <div class="row mb3">
          <div class="col-md-6">
            <label class="col-form-label">Paid Amount</label>
            <input
              type="text"
              class="form-control"
              [(ngModel)]="postBill.paidamount"
              [disabled]="postBill.status == 'unpaid'"
            />
          </div>
          <div class="col-md-6">
            <label class="col-form-label">Notes </label>
            <textarea
              class="form-control"
              class="form-control"
              [(ngModel)]="postBill.notes"
              [disabled]="postBill.status == 'unpaid'"
            >
            </textarea>
          </div>
        </div>
        <div class="row mb3">
          <div class="col-md-6">
            <label class="col-form-label">Is It Complementary ?</label>
            <div>
              <label>
                <input
                  type="radio"
                  name="iscomplementary"
                  [value]="true"
                  [(ngModel)]="postBill.iscomplementary"
                  [disabled]="postBill.status == 'paid'"
                  (click)="
                    postBill.status = 'unpaid';
                    postBill.paymentmode = '';
                    postBill.paidamount = 0
                  "
                />
                Yes
              </label>
              <label style="margin-left: 10px;">
                <input
                  type="radio"
                  name="iscomplementary"
                  [value]="false"
                  [(ngModel)]="postBill.iscomplementary"
                  [disabled]="postBill.status == 'paid'"
                />
                No
              </label>
            </div>
          </div>
          <div class="col-md-6">
            <label class="col-form-label">Complementary Reason</label>
            <textarea
              class="form-control"
              class="form-control"
              [(ngModel)]="postBill.complementaryreason"
              [disabled]="!postBill.iscomplementary"
            >
            </textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          type="submit"
          class="btn btn-primary"
          [disabled]="
            (postBill.status == 'paid' &&
              !(postBill.paidamount && postBill.paymentmode)) ||
            (postBill.status == 'unpaid' && !postBill.iscomplementary) ||
            postBill.status == ''
          "
          (click)="
            updateNewBill(
              pagedOrderList[selectedOrderId].billid,
              pagedOrderList[selectedOrderId].orders,
              pagedOrderList[selectedOrderId].lifecyclestatus
            )
          "
        >
          Save
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          data-bs-dismiss="modal"
          (click)="settleModalRef?.hide()"
        >
          Close
        </button>
      </div>
    </ng-template>
  `,
  styles: ``
})
export class SalesReportComponent {
orderlist: any;
  orderListSource: Array<any> = [];
  orderTypeWise: Array<any> = [];
  totalEarnings: any = {
    totalAmount: '',
    billAmount: '',
  };
  selectedOrderId: number = 0;
  // pagination
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [2, 5, 10];
  totalPages = 0;
  pagedOrderList: any[] = [];
  itemWiseOrders: Array<itemWiseOrder> = [];

  settleModalRef?: BsModalRef;

  initialPostBill: PostBillType = {
    status: '',
    paymentmode: '',
    paidamount: null,
    notes: '',
    iscomplementary: false,
    complementaryreason: '',
    lifecycleStatus: '',
  };

  postBill: PostBillType = { ...this.initialPostBill };

  post: any = {
    fromDate: this.formatDate(new Date()),
    toDate: this.formatDate(new Date()),
    status: 'all',    
    orderType: 'all'
  };

  orderFloorModalRef?: BsModalRef;
  @ViewChild('settleTemplate') settleTemplate!: TemplateRef<any>;

  billFilter: any = {
    billId: '',
    billnumber: '',
    totalAmount: '',
    status: ''
  };

  orderTypeList: Array<IOrderTypeWise> = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    private stateService: StateService,
    private alertService: AlertService,
    private router: Router,
    private query: QueryService,
    private changeDef: ChangeDetectorRef,
    private modalService: BsModalService,
  ) {}

  ngOnInit(): void {
    this.getOrderReport(new Date(), new Date(), 'all', 'all');
    this.getorderTypeList();

    // this.activatedRoute.data.subscribe(data => {
    //   this.dataRoles = data['dataRoles'];
    //   console.log(this.dataRoles,'this.dataRoles');
    // });
  }

  onChangeFilter(evt: any) {
    console.log(evt.target.value, 'evet');
    this.billFilter.status = evt.target.value;
    this.billFilterList();
  }

  billFilterList() {
  let localOrderList = [...this.orderListSource];


    // Bill ID
  if (this.billFilter.billId) {
    localOrderList = localOrderList.filter((x: any) =>
      x.billid?.toString().includes(this.billFilter.billId.toString())
    );
  }

  // Bill Number
  if (this.billFilter.billnumber) {
    localOrderList = localOrderList.filter((x: any) =>
      x.billnumber?.toString().includes(this.billFilter.billnumber.toString())
    );
  }

  // Total Amount
  if (this.billFilter.totalAmount) {
    localOrderList = localOrderList.filter((x: any) =>
      x.totalamount?.toString().includes(this.billFilter.totalAmount.toString())
    );
  }

  // Status
  if (this.billFilter.status) {
    localOrderList = localOrderList.filter(
      (x: any) =>
        x.lifecyclestatus?.toString() ===
        this.billFilter.status.toString()
    );
  }

  // Order Type
  if (
    this.billFilter.orderType &&
    this.billFilter.orderType !== 'all'
  ) {
    localOrderList = localOrderList.filter(
      (x: any) =>
        x.orders?.some(
          (o: any) => o.orderType === this.billFilter.orderType
        )
    );
  }

  this.orderlist = localOrderList;

  this.currentPage = 1;
  this.updatePagination();
}



  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  updatePagination() {
    const source = this.orderlist || [];
    this.totalPages = Math.ceil(source.length / this.pageSize);

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;

    // console.log(this.pagedOrderList,'this.pagedOrderList');

    this.pagedOrderList = source.slice(start, end);
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  formatDate(date: Date) {
    return date.toISOString().substring(0, 10); // YYYY-MM-DD
  }

  TodayDate() {
    console.log('1');
    this.post.fromDate = this.formatDate(new Date());
    this.post.toDate = this.formatDate(new Date());
    this.changeDef.detectChanges();
    this.getOrderByDate();
    //this.getOrderReport(this.post.formDate,this.post.toDate);
  }

  navigateOrderHistory() {
    let inputDate = new Date();
    let splitDate = inputDate.toISOString();

    this.router.navigate(['/order-histroy'], {
      queryParams: {
        date: splitDate,
        status: 'all',
      },
    });
  }

  getOrderIds(inputList: Order[]) {
    let result = inputList
      .filter((x) => x.orderid != null)
      .map((x: any) => x.orderid)
      .join(',');
    return result.toString();
  }

  openModal(
    template: TemplateRef<void>,
    blIndex: number,
    templateType: 'orderView' | 'updateBill',
  ): void {
    this.selectedOrderId = blIndex;

    switch (templateType) {
      case 'orderView':
        this.orderFloorModalRef = this.modalService.show(template);
        break;

      case 'updateBill':
        this.settleModalRef = this.modalService.show(template);
        break;
    }
  }

  getOrderByDate() {
    let fromDate = this.post.fromDate;
    let toDate = this.post.toDate;
    let status = this.post.status;
    let orderType = this.post.orderType;
    console.log(fromDate, toDate, '--fromDate,--toDate',orderType);
    this.getOrderReport(new Date(fromDate), new Date(toDate), status, orderType);
  }

  

  getOrderReport(fromDate: Date, toDate: Date, status: any, orderType: any) {
    let convertFromDate = fromDate.toISOString().split('T')[0];
    let convertToDate = toDate.toISOString().split('T')[0];

    this.stateService.setLoadingState(true);

    console.log(convertFromDate, convertToDate, '--convert From date');

    let getObject = {
      fromDate: convertFromDate,
      toDate: convertToDate,
      status: status,
      ordertype: orderType,
    };

    this.query
      .getBillForReport(getObject)
      .pipe(
        finalize(() => {
          this.stateService.setLoadingState(false);
        }),
      )
      .subscribe({
        next: (res: any) => {
          this.totalEarnings.totalAmount = res.totalAmount;
          this.totalEarnings.subTotal = res.subtotal;
          this.orderlist = res.data;
          this.itemWiseOrders = res.itemWiseOrders || [];
          console.log(res.data, '---order-detail--->');
          // this.orderDetail =
          this.orderListSource = res.data;
          this.orderTypeWise = res.orderTypeWiseTotals;

          this.updatePagination();        
          //this.stateService.setLoadingState(false);
        },
        error: (err: any) => {
          //this.stateService.setLoadingState(false);
        },
      });
  }

  getTotalSubTotal() {
    return (this.orderTypeWise ?? []).reduce(
      (acc, x) => acc + (x.subTotalAmount || 0),
      0,
    );
  }

  getTotalTax() {
    return (this.orderTypeWise ?? []).reduce(
      (acc, x) => acc + (x.totalTax || 0),
      0,
    );
  }

  getTotalWithTax() {
    return (this.orderTypeWise ?? []).reduce(
      (acc, x) => acc + (x.totalWithTax || 0),
      0,
    );
  }

  getPaidTotal() {
    return (this.orderTypeWise ?? []).reduce(
      (acc, x) => acc + (x.paidAmount || 0),
      0,
    );
  }

  getUnpaidTotal() {
    return (this.orderTypeWise ?? []).reduce(
      (acc, x) => acc + (x.unpaidAmount || 0),
      0,
    );
  }

  getComplementaryTotal() {
    return (this.orderTypeWise ?? []).reduce(
      (acc, x) => acc + (x.complementaryAmount || 0),
      0,
    );
  }

  onStatusChange(newStatus: string) {
    console.log('Status changed:', newStatus);

    if (newStatus === 'paid') {
      this.postBill.lifecycleStatus = 'finalized';
      this.postBill.iscomplementary = false;
      this.postBill.complementaryreason = '';
      //  this.postBill.paidamount = this.postBill.billAmount; // auto set full payment
    }

    if (newStatus === 'unpaid') {
      this.postBill.lifecycleStatus = 'complementary';
      this.postBill.iscomplementary = true;
      this.postBill.complementaryreason = '';
      this.postBill.paidamount = 0;
    }
  }

  async updateNewBill(inputBillId: any, orders: [], billStatus: string) {
    if (billStatus == 'finalized') {
      this.settleModalRef?.hide();
      this.alertService.showAlert(
        'Notice',
        'This bill is already finalized and cannot be updated.',
      );
      return;
    }

    let updateBillObj = {
      billId: inputBillId,
      lifecycleStatus: this.postBill.lifecycleStatus,
      paidamount: this.postBill.paidamount ? this.postBill.paidamount : null,
      paymentmode: this.postBill.paymentmode ? this.postBill.paymentmode : null,
      status: this.postBill.status,
      notes: this.postBill.notes,
      iscomplementary: this.postBill.iscomplementary,
      complementaryreason: this.postBill.complementaryreason,
      orderids: orders,
    };

    this.query.updateBillList(updateBillObj).subscribe({
      next: async (res: any) => {
        this.settleModalRef?.hide();
        this.handleUpdatePost();
        if (res.status == 'Success') {
          this.alertService.showAlert(
            'Success',
            'Bill has been updated successfully',
          );
        } else {
          this.alertService.showAlert(
            'Error',
            'Bill has not updated Please try again.',
          );
        }
      },
      error: (err: any) => {
        this.settleModalRef?.hide();
        this.handleUpdatePost();
        this.alertService.showAlert('Error', err.error.message);
      },
    });
  }

  handleUpdatePost() {
    this.getOrderByDate();
    this.postBill = { ...this.initialPostBill };
  }

  get leftItems() {
    const mid = Math.ceil(this.itemWiseOrders.length / 2);
    return this.itemWiseOrders.slice(0, mid);
  }

  get rightItems() {
    const mid = Math.ceil(this.itemWiseOrders.length / 2);
    return this.itemWiseOrders.slice(mid);
  }

//   exportToPdf(): void {
//   const doc = new jsPDF();

//   doc.text('Sales Report', 14, 15);

//   autoTable(doc, {
//     startY: 25,
//     head: [['Bill No', 'Customer', 'Amount', 'Status']],
//     body: this.orderlist.map((x: any) => [
//       x.billid,
//       x.customername,
//       x.totalamount,
//       x.lifecyclestatus
//     ])
//   });

//   doc.save('SalesReport.pdf');
// }

exportToExcel() {
  const table = document.getElementById('billSummaryTable');

  const worksheet = XLSX.utils.table_to_sheet(table);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Sales Report'
  );

  XLSX.writeFile(workbook, 'SalesReport.xlsx');
}

 getorderTypeList() {
    //this.stateService.setLoadingState(true);

    this.query.getOrderTypes().subscribe({
      next: (res: any) => {
        this.orderTypeList = res.data ? res.data : [];
        console.log(res, 'res');
      },
      error: (err: any) => {},
      //complete: () => this.stateService.setLoadingState(false)
    });
  }

}

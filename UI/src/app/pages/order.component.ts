import {
  Component,
  ElementRef,
  input,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { ActivatedRoute, Router } from '@angular/router';
import {
  debounceTime,
  Observable,
  takeUntil,
  Subject,
  take,
  switchMap,
  tap,
  of,
  finalize,
  firstValueFrom,
} from 'rxjs';
import { TableActionMode, TableActionsComponent } from '../shared/component/table-actions.component';
import { ChangeDetectorRef } from '@angular/core';
import { StateService } from '@appservices/state.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { StorageService } from '@appservices/storage.service';
import { AppSettings } from '../core/constants/Appsettings';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';

export interface IShortBillForReport {
  billId: number;
  totalAmount: number;
  orders: string;
}

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TypeaheadModule],
  providers: [BsModalService, AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="order-content">
          <div class="lft">
            <div class="cnt-scrl">
              @if (typeId != 1) {
                <div class="sh-grd-bg">
                  <div class="sh-grd-cnt header">
                    <span>Bill Id</span>
                    <span>Order No.</span>
                    <span>Amt</span>
                  </div>
                  @for (ot of getAllOrderlist; track ot.billId) {
                    <div class="sh-grd-cnt">
                      <span>{{ ot.billId }}</span>
                      <span>{{ ot.orders }}</span>
                      <span
                        ><b>{{ ot.totalAmount }}</b></span
                      >
                    </div>
                  }
                </div>
              }

              <div class="mn-list-bg">
                <!-- {{foodMenuList | json}} -->
                @for (
                  fd of foodMenuList;
                  track fd.id;
                  let customIndex = $index
                ) {
                  <div
                    class="mn-list"
                    [ngClass]="fd.flag ? 'active' : ''"
                    (click)="getSubMenuList(fd.id)"
                    [ngStyle]="{
                      'background-color': colorList[customIndex],
                      color: colorList[customIndex] ? '#fff' : '#000',
                      'border-color': colorList[customIndex],
                    }"
                  >
                    <h4>{{ fd.name }}</h4>
                  </div>
                }
              </div>
              <div class="mn-ls-vw-bg flex-column">
                <div class="tt spl-inp-bg">
                  <input
                    type="text"
                    value=""
                    class="form-control"
                    [formControl]="inputSearchMenu"
                    placeholder="Search menu..."
                  />
                </div>
                <div class="mn-ls-vw">
                  <!-- {{subMenuList | json}}  -->
                  @for (sb of subMenuList; track sb.itemid) {
                    <div class="ls-vw" (click)="addOrderList(sb)">
                      <h4>{{ sb.name }}</h4>
                      <span
                        ><i class="icon pi pi-indian-rupee"></i>
                        {{ sb.price }}
                        <i class="spl-icon pi pi-shopping-cart"></i
                      ></span>
                    </div>
                  } @empty {
                    <div>No data found</div>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="rgt">
            <div class="container-bill">
              <div class="order-list grey-bg">
                <div class="ls">
                  <p class="text-left spl-bg">
                    Type :
                    @for (ot of orderTypeList; track ot.ordertypeid) {
                      <span *ngIf="ot.ordertypeid == typeId">{{
                        ot.ordertypename
                      }}</span>
                    }
                  </p>
                  <p class="spl-bg">{{ tableName }}</p>
                </div>
              </div>
              @if (typeId == 1 && +tableId > 0) {
                <div class="table-ops">
                  <button type="button" class="btn btn-sm btn-outline-secondary" (click)="openTableAction('transfer')" title="Move this table's orders to a free table">
                    <i class="pi pi-arrow-right-arrow-left"></i> Transfer
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-secondary" (click)="openTableAction('merge')" title="Join other tables to this table">
                    <i class="pi pi-objects-column"></i> Merge
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-secondary" (click)="openTableAction('split')" title="Separate bills for guests at this table">
                    <i class="pi pi-clone"></i> Split bill
                  </button>
                </div>
                @if (splitMode) {
                  <div class="guest-tabs">
                    @for (g of guestTabs; track g.guestlabel) {
                      <button type="button" class="btn btn-sm" [class.btn-primary]="g.guestlabel === selectedGuest" [class.btn-outline-primary]="g.guestlabel !== selectedGuest" (click)="selectGuest(g.guestlabel)">
                        {{ g.guestlabel || 'Guest 1' }} &middot; {{ g.total | number:'1.0-2' }}
                        @if (g.printed) { <i class="pi pi-print" title="Bill printed"></i> }
                      </button>
                    }
                  </div>
                }
              }
              <div class="mini-tab">
                <button
                  class="btn btn-outline-primary"
                  [class.active]="miniTabOption['customer']"
                  title="Customer"
                  (click)="handleSelectOption('customer')"
                  [disabled]="isPrinted"
                >
                  <i class="pi pi-user-plus"></i>
                </button>

                <button
                  class="btn btn-outline-primary"
                  [class.active]="miniTabOption['comments']"
                  title="KOT comments"
                  (click)="handleSelectOption('comments')"
                  [disabled]="isPrinted"
                >
                  <i class="pi pi-align-left"></i>
                </button>
                <button
                  class="btn btn-outline-primary"
                  [class.active]="miniTabOption['discount']"
                  title="Discount"
                  [disabled]="(typeId == 1 && !this.isSettle) || isPrinted"
                  (click)="handleSelectOption('discount')"
                >
                  %
                </button>
              </div>
            </div>

            <div class="container-bill ct-frm-bg">
              <div class="child" [class.show]="miniTabOption['customer']">
                <div class="row">
                  <div class="col-6">
                    <div class="form-group">
                      <h4 class="sb-tt">Customer name</h4>
                      <input
                        type="text"
                        class="form-control"
                        [(ngModel)]="selectedcustomername"
                        (ngModelChange)="onCustomerNameChange($event)"
                        [typeahead]="customerList"
                        typeaheadOptionField="name"
                        [typeaheadMinLength]="3"
                        [typeaheadWaitMs]="200"
                        (typeaheadOnSelect)="onCustomerSelect($event)"
                        placeholder="Search customer..."
                      />
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="form-group">
                      <h4 class="sb-tt">Phone Number</h4>
                      <input
                        type="text"
                        class="form-control"
                        [(ngModel)]="selectedcustomerphoneno"
                      />
                    </div>
                  </div>
                </div>

                <div class="row">
                  <div class="col-12">
                    <div class="form-group">
                      <h4 class="sb-tt">Address</h4>
                      <textarea
                        class="form-control"
                        rows="1"
                        [(ngModel)]="selectedcustomeraddress"
                      >
                      </textarea>
                    </div>
                  </div>
                </div>
              </div>

              <div class="child" [class.show]="miniTabOption['comments']">
                <div class="row">
                  <div class="col-12">
                    <div class="form-group">
                      <h4 class="sb-tt">KOT Comments</h4>
                      <textarea
                        [(ngModel)]="inputComment"
                        class="form-control"
                        name="comment"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <div class="child" [class.show]="miniTabOption['discount']">
                <div class="row">
                  <div class="col-6">
                    <div class="form-group">
                      <h4 class="sb-tt">Select discount</h4>
                      <select
                        class="form-select"
                        [(ngModel)]="selectDiscount.id"
                        (change)="onChangeDiscountSelect($event)"
                      >
                        <option [value]="-1" selected>Select a discount</option>
                        @for (
                          sd of discountList;
                          track sd.discountId;
                          let idx = $index
                        ) {
                          <option [value]="idx">
                            {{ sd.discountname }}
                          </option>
                        }
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="container-bill"
              #customPrintOut
              id="customPrintOut"
              [class.minimize]="miniTabFlag"
            >
              <div class="order-list spl-bg">
                <div class="ls hd">
                  <h2 class="text-left">Menu Name</h2>
                  <p>Rate</p>
                  <p>Quantity</p>
                  <p>T.Price</p>
                </div>
              </div>
              <!-- {{postBill.orders | json}} -->
              <div class="cnt-scrl">
                @for (
                  ls of postBill.orders;
                  track ls.orderid;
                  let ind = $index
                ) {
                  <div
                    class="order-list"
                    [ngStyle]="{
                      'background-color': ls.orderid != 0 ? '#fff' : '#fffad6',
                    }"
                  >
                    <div class="ls spl">
                      @if (ls.orderid != 0) {
                        <h2>
                          <input
                            type="checkbox"
                            [checked]="ls.flag"
                            class="check-box"
                            [disabled]="true"
                          />
                          <span
                            >Order Id. {{ ls.orderid }}
                            <b>{{ ls.status | uppercase }}</b>
                          </span>
                          <button
                            type="button"
                            class="btn btn-sm btn-link p-0 ms-2"
                            title="Reprint KOT in every kitchen"
                            (click)="reprintKot(ls.orderid)"
                          >
                            <i class="pi pi-print"></i>
                          </button>
                        </h2>
                      } @else {
                        <h2>
                          <span>New Order</span>
                        </h2>
                      }
                    </div>

                    @for (
                      bl of ls.orderdetail;
                      track bl.orderdetailid;
                      let ind = $index
                    ) {
                      <div class="ls">
                        <h2>
                          <span>{{ bl.name }}</span>
                        </h2>
                        <p>({{ bl.price }})</p>
                        @if (ls.orderid != 0) {
                          <p>{{ bl.qty }}</p>
                        } @else {
                          <p>
                            <span
                              (click)="substractOrder(ind)"
                              class="btn btn-outline-secondary btn-sm"
                              >-</span
                            >{{ bl.qty }}
                            <span
                              (click)="addOrderList(bl)"
                              class="btn btn-primary btn-sm"
                              >+</span
                            >
                          </p>
                        }
                        <p>{{ bl.sumofprice }}</p>
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="price-tag">
                <div class="ls">
                  <div class="pr-lft">
                    <h4 [ngClass]="postBill.discount ? 'show' : 'hide'">
                      <span>Discount</span>
                      <span class="spl">{{ postBill.discount }} </span>
                    </h4>
                    <h4>
                      <span>Tax</span>
                      <span class="spl">{{ postBill.tax }}</span>
                    </h4>
                    <h4>
                      <span>Extra charges</span>
                      <span class="spl">{{ postBill.extraAmount }}</span>
                    </h4>

                    <h4>
                      <span>Sub Total Amount</span>
                      <span class="spl"
                        ><b>{{ postBill.subTotalAmount }}</b></span
                      >
                    </h4>
                    <h4>
                      <span>Total amount</span>
                      <span class="spl">{{ postBill.totalAmount }}</span>
                    </h4>
                  </div>
                </div>
              </div>

              <div class="btn-bg">
                <div class="row">
                  <div class="col-md-12">
                    <div class="comment-bg" *ngIf="inputCommentFlag">
                      <h4>
                        KOT Comments
                        <i
                          class="pi pi-times icon"
                          (click)="inputCommentFlag = !inputCommentFlag"
                        ></i>
                      </h4>
                      <textarea
                        [(ngModel)]="inputComment"
                        class="form-control"
                        name="comment"
                      ></textarea>
                    </div>
                    <div class="ds-btn-bg">
                      <!-- <select class="form-control" (change)="onDiscountSelect($event)" >
                            <option [value]="-1" selected>Select a discount</option>                         
                            @for(sd of discountList; track sd.discountId; let idx= $index){
                              <option [value]="idx">
                                {{ sd.discountname }}
                              </option>
                            }
                          </select> -->
                    </div>
                    <!-- (click)="setNewBill()" -->

                    <button
                      class="btn btn-primary"
                      (click)="openModal(settleTemplate, 'settle')"
                      [disabled]="!this.isSettle"
                    >
                      Settle
                    </button>
                    @if (typeId == 1) {
                      <button
                        class="btn btn-primary"
                        (click)="setNewOrder()"
                        [disabled]="!this.isKOT || isPrinted"
                      >
                        KOT
                      </button>
                    }

                    @if (typeId != 1) {
                      <button
                        (click)="createBillDirectly()"
                        class="btn btn-primary"
                      >
                        KOT & Print Bill
                      </button>
                    }

                    <button
                      class="btn btn-outline-secondary"
                      title="Print bill"
                      (click)="setPrintBill()"
                      [disabled]="!this.isSettle || isPrinted"
                    >
                      <i class="pi pi-print"></i>
                    </button>

                    <!-- <button
                      class="btn btn-primary"
                      (click)="inputCommentFlag = !inputCommentFlag"
                      [disabled]="!this.isKOT"
                    >
                      <i class="pi pi-align-left"></i>
                    </button>
                     -->

                    <button
                      class="btn btn-outline-secondary float-end"
                      title="Save order"
                      [disabled]="!this.isKOT"
                      (click)="setLocalOrderStorage()"
                    >
                      <i class="pi pi-save"></i>
                    </button>

                    <!-- <button
                      class="btn btn-primary"
                      (click)="openModal(discountTemplate, 'discount')"
                      [disabled]="!this.isSettle"
                    >
                      %
                    </button> -->
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ng-template #discountTemplate>
      <div class="modal-header">
        <h4 class="modal-title pull-left">Discount</h4>
        <button
          type="button"
          class="btn-close close pull-right"
          aria-label="Close"
          (click)="discountModalRef?.hide()"
        >
          <span aria-hidden="true" class="visually-hidden">&times;</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="row mb3">
          <div class="col-md-6">
            <label for="floorname" name="floorname" class="col-form-label"
              >Select discount</label
            >
            <select
              class="form-control"
              [(ngModel)]="selectDiscount.id"
              (change)="onChangeDiscountSelect($event)"
            >
              <option [value]="-1" selected>Select a discount</option>
              @for (sd of discountList; track sd.discountId; let idx = $index) {
                <option [value]="idx">
                  {{ sd.discountname }}
                </option>
              }
            </select>
          </div>
          <div class="col-md-6">
            @if (selectDiscount.flag) {
              <input
                type="text"
                [(ngModel)]="selectDiscount.value"
                class="form-control"
                (keypress)="allowOnlyNumbers($event)"
              />
            }
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <!-- {{localDiscount.id}} -->
        <button
          type="submit"
          [disabled]="!selectDiscount.id"
          class="btn btn-primary"
          (click)="onDiscountSelect(selectDiscount.id)"
        >
          Save
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          data-bs-dismiss="modal"
          (click)="discountModalRef?.hide()"
        >
          Close
        </button>
      </div>
    </ng-template>

    <ng-template #settleTemplate>
      <div class="modal-header">
        <h4 class="modal-title pull-left">
          {{ isPrinted ? 'Update Settle' : 'Settle' }}
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
            <!-- [disabled]="postBill.status!=='paid' ? true : false "  -->
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
                    postBill.paidamount = ''
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
        <!-- {{localDiscount.id}} -->
        <!-- {{postBill.isComplementary }} {{postBill.status}}
         {{ (postBill.status == 'paid' && !(postBill.paidamount && postBill.paymentmode))}} -->
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
            isPrinted ? updateNewBill(updateBillId) : setNewBill();
            settleModalRef?.hide()
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
  styles: `
    .table-ops, .guest-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 10px; }
    .guest-tabs { padding-top: 0; }
  `,
})
export class OrderComponent implements OnInit {
  constructor(
    private router: Router,
    private modalService: BsModalService,
    private orderLocalStorage: StorageService,
    private alertService: AlertService,
    private stateService: StateService,
    private query: QueryService,
    private activeRoute: ActivatedRoute,
    private changeDetectRef: ChangeDetectorRef,
  ) {}

  // Split bill: one tab per guest with open orders; the screen shows and bills one guest at a time.
  guestTabs: any[] = [];
  selectedGuest: string | null = null;
  get splitMode(): boolean {
    return this.guestTabs.length > 1 || (this.guestTabs.length === 1 && this.guestTabs[0].guestlabel != null);
  }

  tableId!: Number;
  floorId!: Number;
  //tableid!:Number;
  typeId!: Number;
  tableName!: String;
  customerList: any = [];
  selectedcustomerid: any = 0;
  selectedcustomername: string = '';
  selectedcustomerphoneno: number | null = null;
  selectedcustomeraddress: string = '';
  selectedwaiterid: any = 0;
  selectedordertypeid: any = 1;
  waiterList: any = [];
  foodMenuList: any = [];
  subMenuList: any = [];
  inputTax: any = 5;
  inputDiscount: any = [];
  discountList: any = [];
  extraList: any = [];
  taxList: any = [];
  orderTypeList: any = [];
  getAllOrderlist: IShortBillForReport[] = [];
  isPrinted: boolean = false;
  updateBillId: any = -1;
  isSettle: boolean = false;
  isKOT: boolean = false;
  inputSearchMenu = new FormControl('');
  inputComment: any = '';
  inputCommentFlag: boolean = false;
  selectDiscount: any = {
    id: -1,
    value: 0,
    flag: '',
  };
  @ViewChild('settleTemplate') settleTemplate!: TemplateRef<any>;

  allowOnlyNumbers(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  miniTabFlag: boolean = false;

  miniTabOption: { [key: string]: boolean } = {
    customer: false,
    comments: false,
    discount: false,
  };

  discountModalRef?: BsModalRef;
  settleModalRef?: BsModalRef;

  private defaultPostBill = {
    orders: [],
    lifecycleStatus: 'finalized',
    totalAmount: 0,
    billAmount: 0,
    tax: 0,
    subTotalAmount: 0,
    taxList: [],
    discountList: [],
    discountid: [],
    extraList: [],
    extraAmount: 0,
    discount: 0,
    discountType: '',
    discountIndex: 0,
    discountFlag: false,
    notes: '',
    paidamount: '',
    paymentmode: 'cash',
    status: 'paid',
    iscomplementary: false,
    complementaryreason: '',
  };

  postBill: any = { ...this.defaultPostBill };

  destroy$ = new Subject<void>();

  colorList: string[] = [
    '#0f766e',
    '#c2410c',
    '#6d28d9',
    '#4361ee',
    '#be185d',
    '#1e3a8a',
    '#b45309',
    '#7e22ce',
    '#0369a1',
    '#475569',
    '#15803d',
    '#9f1239',
  ];

  foodMenuSearchList: any = [];

  @ViewChild('customPrintOut') customPrintOut!: ElementRef;

  openModal(template: TemplateRef<void>, type: 'discount' | 'settle') {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }

    const modalRef = this.modalService.show(template);

    if (type === 'discount') {
      this.discountModalRef = modalRef;
    } else if (type === 'settle') {
      this.settleModalRef = modalRef;
    }
  }

  onStatusChange(newStatus: string) {
    console.log('Status changed:', newStatus);

    if (newStatus === 'paid') {
      this.postBill.lifecycleStatus = 'finalized';
      this.postBill.iscomplementary = false;
      this.postBill.complementaryreason = '';
      this.postBill.paidamount = this.postBill.billAmount; // auto set full payment
    }

    if (newStatus === 'unpaid') {
      this.postBill.lifecycleStatus = 'complementary';
      this.postBill.iscomplementary = true;
      this.postBill.complementaryreason = '';
      this.postBill.paidamount = 0;
    }
  }

  print() {
    const printContents = this.customPrintOut.nativeElement.innerHTML;
    const printWindow = window.open('', '', 'width=400,height=600');

    if (printWindow) {
      const doc = printWindow.document;

      // Create HTML elements safely
      const html = doc.createElement('html');
      const head = doc.createElement('head');
      const body = doc.createElement('body');

      // Add styles
      const style = doc.createElement('style');
      style.textContent = `
      body { font-family: Arial, sans-serif; padding: 0px; font-size: 10px; }
      h2 { color: #333; }
      button,select { display: none; }  
     .order-list {
  display: flex;
  flex-direction: column;
  background: #fff;
}

 .order-list .ls {
display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 5px 0px;
  font-size: 13px;
}

 .order-list .ls h2{
 width:30%;
 font-size: 14px;
  margin: 0;
  font-weight:normal;
  }

 .order-list .ls .text-left {
  text-align: left;
}
 .order-list .ls p {
  margin-bottom: 0px;
  width: 20%;
  text-align: right;
  font-weight: normal;
  margin-top:0;
}

 .order-list .ls p.spl-bg {
  width: auto;
}
 .order-list .ls p {
  margin-bottom: 0px;
  width: 20%;
  text-align: right;
  font-weight: normal;
}
  .price-tag .ls .pr-lft h4{
	text-align:right;
font-size:14px;
border-top:1px solid #ccc;
margin:0px;
padding:10px 0px;
font-weight:normal;
}
.price-tag .ls .pr-lft h4.show{
display:block;
}
.price-tag .ls .pr-lft h4.hide{
display:none;
}
.price-tag .ls .pr-lft h4 span{
margin-left:10px;
}

 .order-list .ls.hd{
 border-top:1px solid #ccc;
 padding:7px 0px;
 border-bottom:1px solid #ccc;
  }

.price-tag .ls .pr-lft h4 span.spl{
width: 150px;
  display: inline-block;
  font-weight:bold;
  }
  .order-list .ls.spl{
  display:none;
  }
    `;
      head.appendChild(style);

      // Set print contents
      body.innerHTML = printContents;

      // Auto-print and close after printing
      body.onload = () => {
        // console.log('onloading');
        printWindow?.print();
        printWindow?.close();
      };

      html.appendChild(head);
      html.appendChild(body);

      doc.documentElement.replaceWith(html); // replaces current empty <html> with the new one
    }
  }

  ngOnInit(): void {
    this.loadMasterData();
    this.getParameterValue();
    if(this.typeId != 1){
      this.getOrderReport(new Date(), new Date(), 'all');
    }
    this.searchMenuList();
  }

  loadMasterData(): void {
    this.getCustomerList();
    this.getFoodMenuList();
    this.getDiscountList();
    this.getTaxList();
    this.getorderTypeList();
    this.getExtraChargesList();
  }

  getLocalOrderStorage() {
    let inputParam = {
      tableId: this.tableId,
      floorId: this.floorId,
      typeId: this.typeId,
    };
    console.log('getLocalStorage');
    this.orderLocalStorage.getOrderDetail(inputParam).subscribe({
      //  next:((res:any)=>{
      //   this.orderTypeList = res.data;
      //   console.log(res,'res');
      // }),
      // error:((err:any)=>{
      // }),

      next: (res: any) => {
        console.log(res, '-----get--local--stoorage');
        // if(res.length !=0 && res.orderDetail.length !=0){
        //   this.postBill.orders.push(res.orderDetail);
        //   this.calculatetotalprice();
        //   this.isSettle = false;
        //   this.isKOT = true;
        //  // this.calculatetotalprice();
        // }
        console.log(res, 'getLocalStorage');
      },
      error: (err: any) => {},
    });
  }

  setLocalOrderStorage() {
    let orderDetail = this.postBill.orders[this.postBill.orders.length - 1];
    if (orderDetail.orderid) return;
    let inputParam = {
      tableId: this.tableId,
      floorId: this.floorId,
      typeId: this.typeId,
      orderDetail: orderDetail,
    };
    this.orderLocalStorage.setOrderDetail(inputParam, true).subscribe({
      next: (res: any) => {
        console.log(res, 'setLocalStorage');
      },
      error: (err: any) => {},
    });
  }

  onCustomerNameChange(value: string) {
    if (!value) {
      this.selectedcustomerid = null;
    }
  }

  onCustomerSelect(event: any): void {
    console.log(event, 'customer-event');
    const customer = event.item;

    if (!customer) {
      return;
    }

    this.selectedcustomerid = customer.customerid;
    this.selectedcustomername = customer.name;
    this.selectedcustomerphoneno = customer.contactnumber;
    this.selectedcustomeraddress = customer.address;

    // return ;
    // let inputValue = event.target.value;
    // this.selectedcustomerid = inputValue;
    // // this.postBill.
    // console.log(inputValue);
  }

  // onWaiterSelect(event:any){
  //   let inputValue = event.target.value;
  //   this.selectedwaiterid = inputValue;
  // }

  onOrderTypeSelect(event: any) {
    let inputValue = event.target.value;
    this.selectedordertypeid = inputValue;
  }

  onSelectedBill(ind: any) {
    if (!this.postBill.orders[ind] || this.postBill.orders[ind].orderid === 0) {
      return;
    }
    this.postBill.orders[ind].flag = !this.postBill.orders[ind].flag;
  }

  onOrderDecrement(ind: any) {}

  getParameterValue() {
    this.activeRoute.paramMap.subscribe((params: any) => {
      this.tableId = params?.get('tableId');
      this.floorId = params?.get('floorId');
      this.typeId = params?.get('typeId');
      this.tableName = params?.get('tableName');
      this.getOrderByTable(this.tableId, this.typeId);
      this.getLocalOrderStorage();
    });
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

  getCustomerList() {
    // .pipe(take(1))
    console.log(this.customerList, '<---this.customerList--->');
    this.query.getCustomers().subscribe({
      next: (res: any) => {
        console.log(res, 'res');
        this.customerList = res.data ? res.data : [];
        if (res.status == 'success') {
          console.log(this.customerList);
        }
      },
      error: (err: any) => {},
    });
  }

  getCustomerById(customerId: number) {
    let customer = this.customerList.find((customer: any) => customer.customerid === customerId);
    if (customer) {
      this.selectedcustomername = customer.name;
      this.selectedcustomerphoneno = customer.contactnumber;
      this.selectedcustomeraddress = customer.address;
    }
  }


  
  // getWaiterList(){
  //   this.query.getWaiters().subscribe({
  //     next:((res:any)=>{
  //       this.waiterList = res.data;
  //       if(res.status=='success'){
  //         console.log(this.waiterList);
  //       }
  //     }),
  //     error:((err:any)=>{
  //     })
  //   })
  // }

  getFoodMenuList() {
    this.query.getFoodMenuList().subscribe({
      next: (res: any) => {
        console.log(res, 'res111');
        this.foodMenuList = res.menu;
        this.foodMenuSearchList = this.foodMenuList
          .map((x: any) => x.orderdetail)
          .flat();
        this.getSubMenuList(this.foodMenuList[0].id);
      },
      error: (err: any) => {},
    });
  }

  getDiscountList() {
    this.query.getDiscounts().subscribe({
      next: (res: any) => {
        this.discountList = res.data ? res.data : [];
        console.log(res, 'get-discount-list');
      },
      error: (err: any) => {},
    });
  }

  // getExtrasList(){
  //   this.query.getExtraCharges().subscribe({
  //     next:((res:any)=>{
  //       this.extraList = res.data;
  //       console.log(res,'get-getExtraCharges-list');
  //     }),
  //     error:((err:any)=>{

  //     })
  //   })
  // }

  async getTaxList() {
    this.query.getTax().subscribe({
      next: async (res: any) => {
        console.log(res, 'getTax');
        this.taxList = res.data ? res.data : [];
        this.postBill.taxList = this.taxList;
        this.calculatetotalprice();
      },
      error: (err: any) => {},
    });
  }

  async getExtraChargesList() {
    this.query.getExtraCharges().subscribe({
      next: async (res: any) => {
        console.log(res, 'getExtra');
        this.extraList = res.data ? res.data : [];
      },
      error: (err: any) => {},
    });
  }

  onChangeDiscountSelect(event: any) {
    const selectedValue = event.target.value;
    if (this.discountList[selectedValue].discountname == 'customize') {
      this.selectDiscount.flag = true;
    } else {
      this.selectDiscount.flag = false;
    }
  }

  onDiscountSelect(inputId: any): void {
    //const selectedValue = event.target.value;
    const selectedValue = inputId;

    if (selectedValue != -1) {
      this.postBill.discountFlag = true;
      // this.postBill.discount = this.discountList[selectedValue].discountrate;
      this.postBill.discountType =
        this.discountList[selectedValue].discounttype;
      this.postBill.discountIndex = Number(selectedValue);
      this.postBill.discountid = [this.discountList[selectedValue].discountid];
      this.discountModalRef?.hide();
    } else {
      this.postBill.discountFlag = false;
      this.postBill.discount = 0;
      this.postBill.discountType = '';
      this.postBill.discountIndex = -1;
      this.postBill.discountid = [];
      this.selectDiscount.value = 0;
      // this.postBill.discount = 0;
    }
    this.calculatetotalprice();
  }

  async addOrderList(InputObject: any) {
    console.log(InputObject, 'Object');
    let orderIndex = this.postBill.orders.findIndex(
      (x: { orderid: number }) => x.orderid === 0,
    );
    if (orderIndex !== -1) {
      let order = this.postBill.orders[orderIndex];
      let itemIndex = order.orderdetail.findIndex(
        (x: { itemid: number }) => x.itemid === InputObject.itemid,
      );
      if (itemIndex !== -1) {
        this.postBill.orders[orderIndex].orderdetail[itemIndex].qty += 1;
        //this.postBill.orders[orderIndex].orderdetails[itemIndex].sumofprice += InputObject.price;
        this.postBill.orders[orderIndex].orderdetail[itemIndex].sumofprice =
          parseFloat(
            (
              this.postBill.orders[orderIndex].orderdetail[itemIndex]
                .sumofprice + InputObject.price
            ).toFixed(2),
          );
      } else {
        InputObject.qty = InputObject.qty ? InputObject.qty : 1;
        InputObject.sumofprice = InputObject.sumofprice
          ? InputObject.sumofprice
          : InputObject.price;
        this.postBill.orders[orderIndex].orderdetail.push({ ...InputObject });
      }
      order.totalprice = order.totalprice + InputObject.price;
    } else {
      InputObject.qty = InputObject.qty ? InputObject.qty : 1;
      InputObject.sumofprice = InputObject.sumofprice
        ? InputObject.sumofprice
        : InputObject.price;
      this.postBill.orders.push({
        orderid: 0,
        waiterid: this.selectedwaiterid,
        tableid: this.tableId,
        timedate: new Date().toISOString(),
        customerid: this.selectedcustomerid,
        bookingid: 0,
        ordertypeid: this.typeId,
        orderdetail: [{ ...InputObject }],
        totalprice: InputObject.price,
        status: '',
        billingid: 0,
        printf: false,
        comments: this.inputComment,
      });
    }
    this.calculatetotalprice();
    this.isSettle = false;
    this.isKOT = true;
  }

  substractOrder(ind: any) {
    let orderIndex = this.postBill.orders.findIndex(
      (x: { orderid: number }) => x.orderid === 0,
    );
    if (orderIndex !== -1) {
      let localPrice = this.postBill.orders[orderIndex].orderdetail[ind].price;
      if (this.postBill.orders[orderIndex].orderdetail[ind].qty != 1) {
        this.postBill.orders[orderIndex].orderdetail[ind].qty -= 1;
        this.postBill.orders[orderIndex].orderdetail[ind].sumofprice =
          parseFloat(
            (
              this.postBill.orders[orderIndex].orderdetail[ind].sumofprice -
              localPrice
            ).toFixed(2),
          );
        this.postBill.orders[orderIndex].totalprice = parseFloat(
          (this.postBill.orders[orderIndex].totalprice - localPrice).toFixed(2),
        );
      } else {
        this.postBill.orders[orderIndex].orderdetail.splice(ind, 1);
        this.postBill.orders[orderIndex].totalprice = parseFloat(
          (this.postBill.orders[orderIndex].totalprice - localPrice).toFixed(2),
        );
        console.log(
          this.postBill.orders[orderIndex].orderdetail.length,
          '---len',
        );
        if (this.postBill.orders[orderIndex].orderdetail.length == 0) {
          this.postBill.orders.splice(orderIndex, 1);
          this.isSettle = true;
          this.isKOT = false;
        }
      }
      this.calculatetotalprice();
    }
  }

  setNewOrder() {
    this.selectedwaiterid = localStorage.getItem('userid');
    let orderDetail = this.postBill.orders[this.postBill.orders.length - 1];
    let inputParamStorage = {
      tableId: this.tableId,
      floorId: this.floorId,
      typeId: this.typeId,
    };

    if (orderDetail.orderid) return;

    orderDetail.customerid = this.selectedcustomerid
      ? this.selectedcustomerid
      : 0;
    orderDetail.waiterid = this.selectedwaiterid ? this.selectedwaiterid : 0;
    orderDetail.comments = this.inputComment;
    orderDetail.guestlabel = this.splitMode ? this.selectedGuest : null;

    console.log(orderDetail, 'set-new-orderDetail');
    this.query.setOrderList(orderDetail).subscribe({
      next: (res: any) => {
        if (res.status == 'Success') {
          this.orderLocalStorage.setOrderDetail(inputParamStorage, false);
          this.getOrderByTable(this.tableId, this.typeId);
          this.changeDetectRef.detectChanges();
          this.inputComment = '';
          const failed = (res.printResults || []).filter((r: any) => !r.ok);
          if (failed.length) {
            this.alertService.showAlert(
              'KOT saved - printing failed',
              'Not printed in: ' + failed.map((r: any) => `${r.kitchen} (${r.printer || 'default printer'})`).join(', ') +
              '. Check the printer and use the print button on the order to reprint.',
            );
          } else {
            this.alertService.showAlert(
              'Success',
              'KOT has been sent successfully',
            );
          }
        } else {
          this.inputComment = '';
          this.alertService.showAlert(
            'Error !',
            'KOT has not been sent. Kindly check and resend.',
          );          
        }
      
      },
      error:async (err: any) => {
        this.alertService.showAlert('Error', err.error.message);
         await this.resetPostBill();
         await this.getOrderByTable(this.tableId, this.typeId);        
        //console.log(err, 'set New Order ');
      },
    });
  }
  //Cash / UPI / Card / Split

  setPrintBill() {
    this.postBill.lifecycleStatus = 'printed';
    this.postBill.iscomplementary = false;
    this.postBill.complementaryreason = '';
    this.postBill.status = 'unpaid';
    this.postBill.paidamount = null;
    this.postBill.notes = null;
    this.setNewBill();
  }

  async setNewBill(lifeStatus?: any) {
    let createBillObj = {
      billId: 0,
      lifecycleStatus: this.postBill.lifecycleStatus,
      dateTime: new Date().toISOString(),
      customerid: this.selectedcustomerid,
      phone: this.selectedcustomerphoneno,
      address: this.selectedcustomeraddress,
      billname: this.selectedcustomername,
      gstin: '',
      comments: '',
      totalamount: this.postBill.totalAmount,
      billamount: this.postBill.billAmount,
      tax: this.postBill.tax,
      extraamount: this.postBill.extraAmount,
      discount: this.postBill.discount,
      discountid: this.postBill.discountid,
      orderids: [],
      taxid: [],
      extraid: [],
      subtotal: this.postBill.subTotalAmount,
      paidamount: this.postBill.paidamount ? this.postBill.paidamount : null,
      paymentmode: this.postBill.paymentmode ? this.postBill.paymentmode : null,
      status: this.postBill.status,
      notes: this.postBill.notes,
      iscomplementary: this.postBill.iscomplementary,
      complementaryreason: this.postBill.complementaryreason,
    };

    createBillObj.orderids = this.postBill.orders
      .filter((x: any) => x.flag)
      .map((x: any) => x.orderid);
    createBillObj.taxid = this.postBill.taxList.map((x: any) => x.taxid);

    this.query
      .setBillList(createBillObj)
      .pipe(
        finalize(async () => {
          if (this.typeId != 1) {
            await this.refreshData();
          }
          if (this.typeId == 1) {
            this.redirectRoutePage();
          }
        }),
      )
      .subscribe({
        next: async (res: any) => {
          console.log(res, 'result of bill list');

          if (res.status == 'Success') {
            this.alertService.showAlert(
              'Success',
              'Bill has been created successfully',
            );
          } else {
            this.alertService.showAlert(
              'Error',
              'Bill has not created Please try again.',
            );
          }
        },
        error: (err: any) => {
          this.alertService.showAlert('Error', err.error.message);
        },
      });
  }

  redirectRoutePage() {
    console.log(this.typeId, '---swithc');
    if (this.typeId == 1) {
      this.router.navigate(['/dinein']);
    } else if (this.typeId == 2) {
      this.router.navigate(['/take-away']);
    } else if (this.typeId == 3) {
      this.router.navigate(['/home-delivery']);
    } else {
      this.router.navigate(['/']); // fallback route
    }
  }

  async updateNewBill(inputBillId: any) {
    let updateBillObj = {
      billId: inputBillId,
      lifecycleStatus: this.postBill.lifecycleStatus,
      paidamount: this.postBill.paidamount ? this.postBill.paidamount : null,
      paymentmode: this.postBill.paymentmode ? this.postBill.paymentmode : null,
      status: this.postBill.status,
      notes: this.postBill.notes,
      iscomplementary: this.postBill.iscomplementary,
      complementaryreason: this.postBill.complementaryreason,
      orderids: [],
    };

    updateBillObj.orderids = this.postBill.orders
      .filter((x: any) => x.flag)
      .map((x: any) => x.orderid);

    this.query.updateBillList(updateBillObj).pipe(
      finalize(async () => {
        if (this.typeId != 1) {
            this.getOrderReport(new Date(), new Date(), 'all');
        }
        await this.resetPostBill();
        if (this.typeId == 1) {
            this.redirectRoutePage();
        }
      })
    ).subscribe({
      next: async (res: any) => {
        if (res.status == 'Success') {
          await this.resetPostBill();
          this.redirectRoutePage();        
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
        this.alertService.showAlert('Error', err.error.message);
      },
    });
  }

  searchMenuList() {
    // this.inputSearchMenu.valueChanges.pipe(debounceTime(100)).subscribe((x:any)=>{
    //   this.getSubMenuListBySearch(this.inputSearchMenu);
    // })

    this.inputSearchMenu.valueChanges
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((value: any) => {
        console.log(value, '---value--');
        this.getSubMenuListBySearch(value);
      });
  }

  resetPostBill() {
    this.postBill = {
      ...this.defaultPostBill,
      orders: [],
      taxList: [],
      discountList: [],
      discountid: [],
      extraList: [],
    };
    this.selectedcustomerid = 0;
    this.selectedcustomername = '';
    this.selectedcustomerphoneno = null;
    this.selectedcustomeraddress = '';
    this.inputComment = '';
    this.isPrinted = false;
    this.updateBillId = -1;
    this.isSettle = false;
    this.isKOT = false;
    this.selectDiscount = {
      id: -1,
      value: 0,
      flag: false,
    };

    this.changeDetectRef.detectChanges();
    console.log(this.postBill, 'reset-post-bill');
  }

  async getOrderByTable(id: any, typeId: Number) {
    if (!id || !typeId) return; // ✅ guard
    this.stateService.setLoadingState(true);
    this.postBill.orders = [];

    let localGetOrder;

    if (typeId == 1) {
      await this.refreshGuestTabs(id);
      localGetOrder = this.query.getOrderByTableId(id, this.splitMode ? this.selectedGuest : undefined);
    } else {
      localGetOrder = this.query.getOrderByType(typeId);
    }

    localGetOrder.subscribe({
      next: (res: any) => {
        if (res.status == 'Success') {
          console.log(res, 'get-order-by-table--');
          this.postBill.orders = res.data.map((x: any) => {
            return { ...x, flag: true };
          });

          this.postBill.orders = res.data.map((x: any) => {
            if (x.status == 'printed') {
              this.isPrinted = true;
              this.updateBillId = x.billingid;
            }
            return { ...x, flag: true };
          });

          this.getCustomerById(this.postBill.orders[0]?.customerid);

          console.log(this.postBill.orders);
          this.isSettle = true;
          this.isKOT = false;
          this.calculatetotalprice();
          if (this.isPrinted) {
            this.openModal(this.settleTemplate, 'settle');
          }
          this.changeDetectRef.detectChanges();
        } else {
        }

        this.stateService.setLoadingState(false);
        console.log(res, 'getOrderBy Table ');
      },
      error: (err: any) => {
        this.stateService.setLoadingState(false);
      },
    });
  }

  // Guest tabs of the table; keeps the chosen guest while it still has open orders.
  async refreshGuestTabs(tableId: any) {
    try {
      const res: any = await firstValueFrom(this.query.getTableGuests(tableId));
      this.guestTabs = res?.data?.guests || [];
    } catch {
      this.guestTabs = [];
    }
    if (!this.guestTabs.some((g: any) => g.guestlabel === this.selectedGuest)) {
      this.selectedGuest = this.guestTabs.length ? this.guestTabs[0].guestlabel : null;
    }
  }

  selectGuest(label: string | null) {
    if (label === this.selectedGuest) return;
    if (this.postBill.orders.some((o: any) => !o.orderid)) {
      this.alertService.showAlert('Alert !', 'Send the new KOT before switching guests.');
      return;
    }
    this.selectedGuest = label;
    this.isPrinted = false;
    this.updateBillId = -1;
    this.getOrderByTable(this.tableId, this.typeId);
  }

  reprintKot(orderId: number) {
    this.query.reprintKot(orderId).subscribe({
      next: (res: any) => this.alertService.showAlert(res.status === 'Success' ? 'Success' : 'Error !', res.message),
      error: (err: any) => this.alertService.showAlert('Error !', err?.error?.message || 'Could not reprint the KOT'),
    });
  }

  openTableAction(mode: TableActionMode) {
    if (this.postBill.orders.some((o: any) => !o.orderid)) {
      this.alertService.showAlert('Alert !', 'Send the new KOT first.');
      return;
    }
    this.modalService.show(TableActionsComponent, {
      class: 'modal-lg',
      initialState: {
        mode,
        tableId: Number(this.tableId),
        tableName: String(this.tableName ?? ''),
        onDone: (res: any) => this.onTableActionDone(res),
      },
    });
  }

  private onTableActionDone(res: any) {
    const data = res?.data || {};
    if (res.mode === 'transfer' && data.toTableId) {
      // Everything moved: continue on the new table; otherwise stay here.
      const remaining = this.postBill.orders.filter((o: any) => !(data.movedOrders || []).includes(o.orderid));
      if (remaining.length === 0) {
        this.router.navigate(['/order', data.toTableId, data.floorid ?? this.floorId, 1, data.tablename]);
        return;
      }
    }
    if (res.mode === 'split') {
      this.selectedGuest = data.guestLabel ?? null;
      this.isPrinted = false;
      this.updateBillId = -1;
    }
    this.alertService.showAlert('Success', res.message || 'Done');
    this.getOrderByTable(this.tableId, this.typeId);
  }

  async calculatetotalprice() {
    console.log(this.postBill.orders, '---otfd--');

    if (!Array.isArray(this.postBill.orders)) {
      console.error('postBill.orders is not an array!');
    }

    let localtotalprice = this.postBill.orders.reduce(
      (sum: number, order: any) => {
        let price = Number(order.totalprice) || 0; // Ensure it's a valid number
        console.log(sum, price, 'totalprice');
        return sum + price;
      },
      0,
    );
    // Round to 2 decimal places

    this.postBill.subTotalAmount = parseFloat(localtotalprice.toFixed(2));

    // config.json "taxInclusive": true = extract tax from price, false = add tax on top.
    if (this.taxList.length && localtotalprice) {
      let localTaxAmount = 0;
      await this.taxList.forEach((x: any) => {
        const inRange = x.taxrangestatus
          ? x.taxfrom <= localtotalprice && x.taxto >= localtotalprice
          : true;
        if (!inRange) return;
        let taxAmount = 0;
        const inclusive = AppSettings.taxInclusive;
        if (x.taxtype === 'percentage') {
          taxAmount = inclusive
            ? localtotalprice - localtotalprice / (1 + x.taxrate / 100)
            : (localtotalprice * x.taxrate) / 100;
        } else if (x.taxtype === 'flat') {
          taxAmount = x.taxrate;
        }
        if (taxAmount) {
          if (!inclusive) localtotalprice += Number(taxAmount) || 0;
          localTaxAmount += Number(taxAmount) || 0;
        }
      });
      this.postBill.tax = parseFloat(localTaxAmount.toFixed(2));
      if (AppSettings.taxInclusive) {
        this.postBill.subTotalAmount = parseFloat(
          (localtotalprice - localTaxAmount).toFixed(2),
        );
      }
    }

    if (this.postBill.discountFlag) {
      //let localDiscount.valueAmount =0;
      let discountObject = await this.discountList[this.postBill.discountIndex];

      console.log(discountObject, 'discountObject');

      if (discountObject.discountname == 'customize') {
        this.postBill.discount =
          Number(this.selectDiscount.value).toFixed(2) || 0;
        this.postBill.discountList = discountObject;
        localtotalprice -= Number(this.selectDiscount.value) || 0;
      } else {
        let discountRangeStatus = discountObject.discountrangestatus
          ? discountObject.discountfrom <= localtotalprice &&
            discountObject.discountto >= localtotalprice
          : true;

        if (discountRangeStatus) {
          let discountAmount = 0;
          if (discountObject.discounttype == 'percentage') {
            discountAmount =
              (localtotalprice * discountObject.discountrate) / 100;
          } else if (discountObject.discounttype == 'flat') {
            discountAmount = discountObject.discountrate;
          }
          localtotalprice -= Number(discountAmount) || 0;
          this.postBill.discount = Number(discountAmount).toFixed(2) || 0;
          this.postBill.discountList = discountObject;
        }
      }
    }

    /*extralist*/

    if (this.extraList.length && localtotalprice) {
      let localextraAmount = 0;
      await this.extraList.forEach((x: any) => {
        console.log(this.extraList, x.ordertypeid);
        if (this.typeId == x.ordertypeid) {
          const inRange = x.extrachargestatus
            ? x.extrachargefrom <= localtotalprice &&
              x.extrachargeto >= localtotalprice
            : true;
          if (!inRange) return;
          let extraAmount = 0;
          if (x.extrachargetype === 'percentage') {
            extraAmount = (localtotalprice * x.extrachargerate) / 100;
          } else if (x.extrachargetype === 'flat') {
            extraAmount = x.extrachargerate;
          }
          if (extraAmount) {
            localtotalprice += Number(extraAmount) || 0;
            localextraAmount += Number(extraAmount) || 0;
          }
        }
      });

      this.postBill.extraAmount = parseFloat(localextraAmount.toFixed(2));
    }

    this.postBill.taxList = this.taxList;
    this.postBill.totalAmount = parseFloat(localtotalprice.toFixed());
    this.postBill.billAmount = parseFloat(localtotalprice.toFixed());
    this.postBill.paidamount = parseFloat(localtotalprice.toFixed());
  }

  async removeOrderList(Obj: any) {
    this.postBill.orders[0].items.findIndex((x: any) => x.itemID == Obj.id);
  }

  getSubMenuList(id: Number) {
    console.log(id, 'submenu-list', this.foodMenuList);
    let getFoodMenuList: any = {};

    const index = this.foodMenuList.findIndex((x: any) => x.id === id);
    getFoodMenuList =
      index !== -1 ? { data: this.foodMenuList[index], index } : null;

    this.foodMenuList.filter((x: any) => (x.flag = false));
    this.foodMenuList[getFoodMenuList.index].flag = true;
    this.subMenuList = getFoodMenuList.data.orderdetail;
    //this.foodMenuList
  }

  getSubMenuListBySearch(searchText: any) {
    console.log(searchText, 'searchText');
    let inputSearchText = searchText.toLowerCase();
    console.log(inputSearchText);
    let searchMenuList = this.foodMenuSearchList.filter((y: any) => {
      if (
        y.name.toLowerCase().includes(inputSearchText) ||
        y.code?.includes(inputSearchText)
      ) {
        return y;
      }
    });

    this.subMenuList = searchMenuList;
    // if(searchMenuList.length !=0){

    // }
    console.log(searchMenuList, inputSearchText);
    console.log(searchMenuList, 'allF');
  }

  createBillDirectly() {
    let outputParams = {
      customerid: 0,
      name: this.selectedcustomername,
      contactnumber: this.selectedcustomerphoneno,
      email: '',
      address: this.selectedcustomeraddress,
      branchid: 1,
      outletid: 1,
    };   

    if (this.selectedcustomerid || !this.selectedcustomername) {     
      this.setNewOrderDirectly().subscribe({
        next: (res: any) => {         
          if (res?.data?.orderid) {
            let customSingleOrders = {
              orderid: res.data.orderid,
              flag: true,
            };
            this.postBill.orders.push(customSingleOrders);
            this.setNewBill();
          }
        },
        error: async (err: any) => {
          this.alertService.showAlert('Error', err.error.message);
          await this.refreshData();         
        },
      });
    } else {
      this.query
        .addCustomer(outputParams)
        .pipe(
          switchMap((customerRes: any) => {
            this.selectedcustomerid = customerRes.data.customerid;
            return this.setNewOrderDirectly();
          }),
        )
        .subscribe({
          next: (res: any) => {
            if (res?.data?.orderid) {
              let customSingleOrders = {
                orderid: res.data.orderid,
                flag: true,
              };
              this.postBill.orders.push(customSingleOrders);
              this.setNewBill();
            }
          },
          error: async (err: any) => {
            this.alertService.showAlert('Error', err.error.message);
            await this.refreshData();
          },
        });
    }
  }

  setNewOrderDirectly(): Observable<any> {
    this.selectedwaiterid = localStorage.getItem('userid');

    if (!this.postBill.orders.length) {
      this.alertService.showAlert(
        'Failed',
        'Please select items to add to the order',
      );

      return of({});
    }    
    let orderDetail = this.postBill.orders[this.postBill.orders.length - 1];
    console.log(orderDetail, 'set-new-orderDetail');
    if (orderDetail.orderid) {
      this.alertService.showAlert(
        'Failed',
        'Please select items to add to the order',
      );
      return of({}); 
    }
    // Prevent duplicate order creation
    orderDetail.customerid = this.selectedcustomerid || 0;
    orderDetail.waiterid = this.selectedwaiterid || 0;
    orderDetail.comments = this.inputComment;
    return this.query.setOrderList(orderDetail);
  }

  handleSelectOption(key: string): void {
    let getTabOption = this.miniTabOption[key];

    Object.keys(this.miniTabOption).forEach((k) => {
      this.miniTabOption[k] = false;
    });

    this.miniTabFlag = !getTabOption;
    this.miniTabOption[key] = !getTabOption;
  }

  getOrderReport(fromDate: Date, toDate: Date, status: any) {
    let convertFromDate = fromDate.toISOString().split('T')[0];
    let convertToDate = toDate.toISOString().split('T')[0];

    let getObject = {
      fromDate: convertFromDate,
      toDate: convertToDate,
      ordertype: 'Takeaway',
      status: status,
    };

    this.query.getShortBillForReport(getObject).subscribe({
      next: (res: any) => {
        this.getAllOrderlist = res.data;
        console.log(this.getAllOrderlist, 'get-all-order-list');
      },
      error: (err: any) => {},
    });
  }


  async refreshData(): Promise<void> {
    await this.resetPostBill();
    await this.getOrderReport(new Date(), new Date(), 'all');
    await this.getOrderByTable(this.tableId, this.typeId);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

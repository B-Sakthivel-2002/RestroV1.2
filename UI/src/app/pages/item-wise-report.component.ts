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
  selector: 'app-item-wise-report',
standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  providers: [BsModalService, AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Item Wise Report</h2>
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
    
  `,
  styles: ``
})
export class ItemWiseReportComponent {
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

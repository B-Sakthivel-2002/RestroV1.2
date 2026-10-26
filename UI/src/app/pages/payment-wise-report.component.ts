import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { QueryService } from '@appservices/query.service';
import { StateService } from '@appservices/state.service';
import { finalize, map } from 'rxjs';

@Component({
  selector: 'app-payment-wise-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Payment Mode Report</h2>
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

              <button (click)="getByDate()" class="btn btn-primary">
                Submit
              </button>
              <button class="btn btn-outline-secondary" title="Today" (click)="todayDate()">
                <i class="pi pi-refresh"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="cnt">
          <table class="table custom-table" id="billSummaryTable">
            <thead>
              <tr>
                <th>Payment Mode</th>
                <th>Bill Count</th>
                <th>Total Amount</th>
                <th>Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (item of reportList; track item.id) {
                <tr>
                  <td>{{item.paymentMode}}</td>
                  <td>{{item.billCount}}</td>
                  <td>{{item.totalAmount}}</td>
                  <td>{{item.paidAmount}}</td>
                </tr>
                <!-- {{ item | json }} -->
              } @empty {
                <tr>
                  <td colspan="12" class="text-center">No data found</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: ``,
})
export class PaymentWiseReportComponent implements OnInit {
  post = {
    fromDate: this.formatDate(new Date()),
    toDate: this.formatDate(new Date()),
  };

  $reportList: any;
  reportList: any[] = [];

  constructor(
    private query: QueryService,
    private stateService: StateService,
    private changeDef: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.getReportByDate(new Date(), new Date());
  }

  formatDate(date: Date) {
    return date.toISOString().substring(0, 10); // YYYY-MM-DD
  }

  todayDate() {
    this.getReportByDate(new Date(), new Date());
  }

  getByDate() {
    let fromDate = this.post.fromDate;
    let toDate = this.post.toDate;
    this.getReportByDate(new Date(fromDate), new Date(toDate));
  }

  getReportByDate(fromDate: Date, toDate: Date) {
    let convertFromDate = fromDate.toISOString().split('T')[0];
    let convertToDate = toDate.toISOString().split('T')[0];

    const getObject = {
      fromDate: convertFromDate,
      toDate: convertToDate,
    };

    this.stateService.setLoadingState(true);

    this.query
      .getPaymentWiseReport(getObject)
      .pipe(
        finalize(() => {
          this.stateService.setLoadingState(false);
        }),
      )
      .subscribe({
        next: (res: any) => {
          this.reportList = res.data || [];
        },
      });
  }
}

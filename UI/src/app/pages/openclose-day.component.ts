import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';
import { ChangeDetectorRef } from '@angular/core';
import { StateService } from '@appservices/state.service';
import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-openclose-day',
  standalone: true,
  imports: [ CommonModule, ReactiveFormsModule, FormsModule],
  providers: [BsModalService, AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="mn-tt">Work Period</h2>
          </div>
          <div class="btn-bg spl-bg">
            <div class="fl-spl-bg">
                <button
                  (click)="openDaySummary()"
                  class="btn btn-primary"
                  [disabled]="isDayOpened"
                >
                  Start Work Period
                </button>
            </div>
          </div>
        </div>
        <div class="cnt">
          <div class="row">
            <div class="col-md-12">
              <div class="closing-card">
                <div>
                  <table class="table custom-table">
                    <thead>                     
                      <tr>
                        <th>ID</th>
                        <th>Business Date</th>
                       
                        <th>Open Date</th>
                        <th>Close Date</th>
                        <th>Status</th>
                        <th>Orders</th>
                       
                        <th >Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for(ls of openCloseDayList; track ls.id){

                      <tr>
                        <td>{{ ls.id }}</td>
                        <td>{{ ls.date }} <br>
                         ({{ ls.branch }})</td>
                        <td>{{ ls.openedat | date : 'dd-MM-yyyy hh:mm a' }}</td>
                        <td>
                          @if(ls.closedat){
                            {{ ls.closedat | date : 'dd-MM-yyyy hh:mm a' }}
                          }
                        </td>
                        <td>{{ ls.status }}</td>

                        <td>
                          <span>Pending ({{ ls.pendingorderscount }})</span><br>
                          <span>Completed ({{ ls.completedorderscount }})</span>
                        </td>

                        <td >
                          @if(!ls.closedat){
                          <button
                           [disabled]="ls.pendingorderscount>0"
                            (click)="closeDaySummary(ls.id)"
                            class="btn btn-danger"
                          >
                            Close Work Period
                          </button>

                          <button (click)="openOrderHistory(ls.openedat)" class="btn btn-primary">
                             Order History
                          </button>
                          }
                        </td>
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
  `,
  styles: ``,
})
export class OpencloseDayComponent implements OnInit {
  businessDate: string = ''; // yyyy-mm-dd
  othersActual: 0 | undefined;
  notes: any = '';
  summary: any;
  // actuals:any ={
  //   cashActual:'',
  //   cardActual:'',
  //   upiActual:'',
  //   othersActual:''
  // };

  openCloseDayList: Array<any> = [];
  isDayOpened: Boolean = false;

  constructor(
    private query: QueryService,
    private alertService: AlertService,
    private stateService: StateService,
    private router:Router,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    // default to current business date using your business rule (11 AM shift handled server-side)
    this.businessDate = today.toISOString().slice(0, 10);
    //this.loadSummary();
    this.loadDaySummary();
  }

  openDaySummary() {
    this.query.postOpenDay().subscribe({
      next: (res: any) => {
        this.alertService.showAlert(
          'Success !',
          'Work Period has started to open'
        );
        this.loadDaySummary();
      },
      error: (err: any) => {
        if (err.status) {
          this.alertService.showAlert(err.error.status, err.error.message);
        }
      },
    });
  }

  openOrderHistory(inputDate:Date){
    this.router.navigate(['/order-report'],
      {
      queryParams:{ 
        date:inputDate,
        status:'all'
      }
    })
   }

  closeDaySummary(postId: any) {
    this.query.postCloseDay(postId).subscribe({
      next: (res: any) => {
        this.alertService.showAlert(
          'Success !',
          'Work Period has updated to close'
        );
        this.loadDaySummary();
      },
      error: (err: any) => {
        console.log(err);
        if (err.status) {
          this.alertService.showAlert(err.error.status, err.error.message);
        }
      },
    });
  }

  loadDaySummary() {
    this.query.getOpenCloseDay().subscribe({
      next: (res: any) => {
        this.openCloseDayList = res.data;
        console.log(res, 'result-getopenclose');
      },
      error: (err: any) => {
        if (err.status) {
          this.alertService.showAlert(err.error.status, err.error.message);
        }
      },
    });
  }
}

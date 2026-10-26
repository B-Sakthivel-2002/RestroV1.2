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

export interface itemWiseOrder {
  itemid: number;
  itemName: string;
  qty: number;
  amount: number;
}

export interface Order {
  orderid: number | string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  providers: [BsModalService, AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Dashboard</h2>           
          </div>
        </div>
        <div class="cnt">
          <div class="row">
            <div class="col-12">
              <div class="wrk-prd-bg">
                <a [routerLink]="['/open-close-day']" class="btn btn-trans">
                  <i class="icon pi pi-calendar-plus"></i>
                  Work Period
                </a>
                <a [routerLink]="['/kot-list']" class="btn btn-trans">
                  <i class="icon pi pi-user"></i>
                  KOT Dashboard
                </a>

                <a [routerLink]="['/kot-list/captain']" class="btn btn-trans">
                  <i class="icon pi pi-user"></i>
                  Captain Dashboard
                </a>

                <a [routerLink]="['/dinein']" class="btn btn-trans">
                  <i class="icon pi pi-calendar-plus"></i>
                 Dine In
                </a>

                <a [routerLink]="['/order/0/0/2']" class="btn btn-trans">
                  <i class="icon pi pi-shop"></i>
                 Take away  
                </a>


                <a [routerLink]="['/order/0/0/3']" class="btn btn-trans">
                  <i class="icon pi pi-shop"></i>
                 Home Delivery
                </a>

              </div>
            </div>
          </div>

     
        <div class="row">
          <div class="col-12">
                   <h2 class="spl-tt mt-md">Reports</h2>
                 <div class="wrk-prd-bg">
               
                <a [routerLink]="['/sales-report']" class="btn btn-trans">
                  <i class="icon pi pi-chart-bar"></i>
                  Sales Report
                </a>

                <a [routerLink]="['/item-wise-report']" class="btn btn-trans">
                  <i class="icon pi pi-chart-bar"></i>
                  Item Wise Report
                </a>

                <a [routerLink]="['/order-report']" class="btn btn-trans">
                  <i class="icon pi pi-chart-bar"></i>
                  Order Report
                </a>

                <a [routerLink]="['/captain-wise-report']" class="btn btn-trans">
                  <i class="icon pi pi-chart-bar"></i>
                  Captain Wise Report
                </a>


                <a [routerLink]="['/customer-wise-report']" class="btn btn-trans">
                  <i class="icon pi pi-chart-bar"></i>      
                  Customer Wise Report  
                </a>

                <a [routerLink]="['/payment-mode-wise-report']" class="btn btn-trans">
                  <i class="icon pi pi-chart-bar"></i>
                  Payment Mode Wise Report
                </a>  

                <a [routerLink]="['/tax-wise-report']" class="btn btn-trans">
                  <i class="icon pi pi-chart-bar"></i>        
                  Tax Wise Report  
                </a>

                <a [routerLink]="['/complementary-report']" class="btn btn-trans">    
                    <i class="icon pi pi-chart-bar"></i>
                  Complementary Report
                </a>  

              </div>
          </div>
        </div>

              </div>
          </div>
        </div>

          


        
    
  `,
  styles: ``,
})
export class DashboardComponent implements OnInit {
  
  constructor(
    private router: Router,
  ) {}

  ngOnInit(): void {
   // this.getOrderInit();   
  }

    navigateOrderHistory() {
    let inputDate = new Date();
    let splitDate = inputDate.toISOString();

    this.router.navigate(['/order-report'], {
      queryParams: {
        date: splitDate,
        status: 'all',
      },
    });
  }
  

}

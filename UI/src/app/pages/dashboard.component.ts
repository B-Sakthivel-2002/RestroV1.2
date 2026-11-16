import {
  ChangeDetectorRef,
  Component,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { QueryService } from '@appservices/query.service';
import { async, from, finalize, forkJoin, of, catchError } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';
import { Router } from '@angular/router';
import { StateService } from '@appservices/state.service';
import { SyncStatusComponent } from './sync-status.component';

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
  imports: [CommonModule, FormsModule, RouterModule, SyncStatusComponent],
  providers: [BsModalService, AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
        <div class="sub-header dash-header">
          <div class="tt">
            <h2 class="cs-mn-tt">Dashboard</h2>
            <p class="dash-sub">{{greeting}} · {{today | date:'EEEE, d MMMM'}}</p>
          </div>
        </div>
        <div class="cnt">
          <app-sync-status [compact]="true"></app-sync-status>

          <!-- today at a glance (same figures as the Sales Report; cancelled bills excluded) -->
          <section class="dash-kpis">
            <a class="dash-kpi k1" routerLink="/sales-report">
              <span class="dash-kpi-lbl">Today's sales</span>
              <span class="dash-kpi-val">{{ stats ? (stats.todayTotal | currency:'INR':'symbol':'1.2-2') : '—' }}</span>
              <span class="dash-kpi-sub">{{ stats ? stats.todayBills + ' bill(s)' : 'Loading…' }}</span>
              <i class="pi pi-wallet dash-kpi-ic"></i>
            </a>
            <a class="dash-kpi k2" routerLink="/sales-report">
              <span class="dash-kpi-lbl">This month</span>
              <span class="dash-kpi-val">{{ stats ? (stats.monthTotal | currency:'INR':'symbol':'1.2-2') : '—' }}</span>
              <span class="dash-kpi-sub">{{ stats ? stats.monthBills + ' bill(s) since ' + (monthStart | date:'d MMM') : 'Loading…' }}</span>
              <i class="pi pi-calendar dash-kpi-ic"></i>
            </a>
            <a class="dash-kpi k3" routerLink="/sales-report">
              <span class="dash-kpi-lbl">Average bill today</span>
              <span class="dash-kpi-val">{{ stats ? (stats.avgBill | currency:'INR':'symbol':'1.2-2') : '—' }}</span>
              <span class="dash-kpi-sub">per bill</span>
              <i class="pi pi-chart-line dash-kpi-ic"></i>
            </a>
            <a class="dash-kpi k4" routerLink="/sales-report">
              <span class="dash-kpi-lbl">Top channel today</span>
              <span class="dash-kpi-val">{{ stats?.topType || '—' }}</span>
              <span class="dash-kpi-sub">{{ stats?.topType ? (stats!.topTypeAmount | currency:'INR':'symbol':'1.2-2') : 'No sales yet' }}</span>
              <i class="pi pi-star dash-kpi-ic"></i>
            </a>
          </section>
          @if (!readOnly) {
            <section class="dash-section">
              <div class="dash-head"><h3>Quick actions</h3><span>{{quickLinks.length}}</span></div>
              <div class="dash-grid">
                @for (l of quickLinks; track l.url) {
                  <a class="dash-tile" [routerLink]="[l.url]" [style.--tone]="l.tone">
                    <span class="dash-ic"><i [class]="'pi ' + l.icon"></i></span>
                    <span class="dash-txt"><span class="dash-lbl">{{l.label}}</span><span class="dash-hint">{{l.hint}}</span></span>
                    <i class="pi pi-arrow-up-right dash-go"></i>
                  </a>
                }
              </div>
            </section>
          }
          <section class="dash-section">
            <div class="dash-head"><h3>Reports</h3><span>{{reportLinks.length}}</span></div>
            <div class="dash-grid">
              @for (l of reportLinks; track l.url) {
                  <a class="dash-tile" [routerLink]="[l.url]" [style.--tone]="l.tone">
                    <span class="dash-ic"><i [class]="'pi ' + l.icon"></i></span>
                    <span class="dash-txt"><span class="dash-lbl">{{l.label}}</span><span class="dash-hint">{{l.hint}}</span></span>
                    <i class="pi pi-arrow-up-right dash-go"></i>
                  </a>
              }
            </div>
          </section>

              </div>
          </div>
        </div>

          


        
    
  `,
  styles: ``,
})
export class DashboardComponent implements OnInit {
  
  // Online server: no Work Period / KOT / billing shortcuts, only the reports.
  readOnly = false;

  // Dashboard tiles (styles: src/styles/_dashboard.scss). tone = one of the theme's four accent colours.
  today = new Date();
  greeting = this.today.getHours() < 12 ? 'Good morning' : this.today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  quickLinks = [
    { url: '/open-close-day', label: 'Work Period', hint: 'Open or close the business day', icon: 'pi-clock', tone: 'var(--rp-tone-1)' },
    { url: '/kot-list', label: 'KOT Dashboard', hint: 'Kitchen orders in progress', icon: 'pi-list', tone: 'var(--rp-tone-2)' },
    { url: '/kot-list/captain', label: 'Captain Dashboard', hint: 'Ready to serve, by captain', icon: 'pi-users', tone: 'var(--rp-tone-3)' },
    { url: '/dinein', label: 'Dine In', hint: 'Tables and running orders', icon: 'pi-table', tone: 'var(--rp-tone-4)' },
    { url: '/order/0/0/2', label: 'Take away', hint: 'New counter bill', icon: 'pi-shopping-bag', tone: 'var(--rp-tone-1)' },
    { url: '/order/0/0/3', label: 'Home Delivery', hint: 'New delivery order', icon: 'pi-truck', tone: 'var(--rp-tone-2)' }
  ];
  reportLinks = [
    { url: '/sales-report', label: 'Sales Report', hint: 'Bills, totals and payments', icon: 'pi-chart-line', tone: 'var(--rp-tone-1)' },
    { url: '/item-wise-report', label: 'Item Wise Report', hint: 'Quantity and amount per item', icon: 'pi-box', tone: 'var(--rp-tone-2)' },
    { url: '/order-report', label: 'Order Report', hint: 'Orders by type and status', icon: 'pi-receipt', tone: 'var(--rp-tone-3)' },
    { url: '/captain-wise-report', label: 'Captain Wise Report', hint: 'Sales per captain', icon: 'pi-users', tone: 'var(--rp-tone-4)' },
    { url: '/customer-wise-report', label: 'Customer Wise Report', hint: 'Sales per customer', icon: 'pi-user', tone: 'var(--rp-tone-1)' },
    { url: '/payment-mode-wise-report', label: 'Payment Mode Wise Report', hint: 'Cash, card and UPI split', icon: 'pi-credit-card', tone: 'var(--rp-tone-2)' },
    { url: '/tax-wise-report', label: 'Tax Wise Report', hint: 'Tax collected by rate', icon: 'pi-percentage', tone: 'var(--rp-tone-3)' },
    { url: '/complementary-report', label: 'Complementary Report', hint: 'Complimentary bills', icon: 'pi-gift', tone: 'var(--rp-tone-4)' }
  ];

  constructor(
    private router: Router,
    private query: QueryService,
  ) {}

  ngOnInit(): void {
    this.query.getServerMode().subscribe((m) => (this.readOnly = m.readOnly));
   // this.getOrderInit();   
    this.loadStats();
  }

  // KPI cards, from the same API the Sales Report uses (all order types, all statuses).
  stats: { todayTotal: number; todayBills: number; monthTotal: number; monthBills: number; avgBill: number; topType: string; topTypeAmount: number } | null = null;
  monthStart = new Date(this.today.getFullYear(), this.today.getMonth(), 1);

  loadStats() {
    const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const req = (from: Date) => this.query
      .getBillForReport({ fromDate: day(from), toDate: day(this.today), status: 'all', ordertype: 'all' })
      .pipe(catchError(() => of(null)));
    forkJoin([req(this.today), req(this.monthStart)]).subscribe(([t, m]: any[]) => {
      const live = (rows: any[]) => (rows || []).filter((b) => !this.isCancelled(b));
      const todayRows = live(t?.data);
      const todayTotal = Number(t?.totalAmount) || 0;
      const top = [...(t?.orderTypeWiseTotals || [])].sort((a: any, b: any) => (b.totalWithTax || 0) - (a.totalWithTax || 0))[0];
      this.stats = {
        todayTotal,
        todayBills: todayRows.length,
        monthTotal: Number(m?.totalAmount) || 0,
        monthBills: live(m?.data).length,
        avgBill: todayRows.length ? todayTotal / todayRows.length : 0,
        topType: top && top.totalWithTax ? top.ordertype : '',
        topTypeAmount: top?.totalWithTax || 0
      };
    });
  }

  isCancelled(b: any): boolean {
    return (b?.lifecyclestatus || '').toLowerCase() === 'cancelled';
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

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, timeout } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { AuthService } from './auth.service';

const READ_MS = 20000;
const WRITE_MS = 25000;

// Every API call the app makes, matching the web app's QueryService.
// Master lists (menu, taxes, discounts, charges, order types) are cached for the session.
@Injectable({ providedIn: 'root' })
export class QueryService {
  private http = inject(HttpClient);
  private api = inject(ApiConfigService);

  private cache = new Map<string, Observable<any>>();

  /** Last tables screen, shown at once when coming back while fresh data loads. */
  tablesSnapshot: { floors: any[]; tables: any[] } | null = null;

  constructor() {
    inject(AuthService).onLogout(() => this.clearCache());
  }

  clearCache(): void {
    this.cache.clear();
    this.tablesSnapshot = null;
  }

  private get<T = any>(path: string, params?: Record<string, any>): Observable<T> {
    return this.http.get<T>(this.api.url(path), { params: QueryService.params(params) }).pipe(timeout(READ_MS));
  }

  private post<T = any>(path: string, body: any, params?: Record<string, any>): Observable<T> {
    return this.http.post<T>(this.api.url(path), body, { params: QueryService.params(params) }).pipe(timeout(WRITE_MS));
  }

  private cached(key: string, factory: () => Observable<any>): Observable<any> {
    let obs = this.cache.get(key);
    if (!obs) {
      obs = factory().pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.cache.set(key, obs);
      // A failed load is not kept.
      obs.subscribe({ error: () => this.cache.delete(key) });
    }
    return obs;
  }

  private static params(p?: Record<string, any>): HttpParams | undefined {
    if (!p) return undefined;
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(p)) {
      if (v !== undefined && v !== null) hp = hp.set(k, String(v));
    }
    return hp;
  }

  // ---- masters (cached)
  getMenu(): Observable<any> { return this.cached('menu', () => this.get('Restaurant/GetMenu')); }
  getOrderTypes(): Observable<any> { return this.cached('ordertypes', () => this.get('OrderType')); }
  getTax(): Observable<any> { return this.cached('tax', () => this.get('Tax')); }
  getDiscounts(): Observable<any> { return this.cached('discounts', () => this.get('Discounts')); }
  getExtraCharges(): Observable<any> { return this.cached('extra', () => this.get('Extracharge')); }
  getActiveFloors(): Observable<any> { return this.cached('floors', () => this.get('Floors/GetActiveFloors')); }

  // ---- tables
  getActiveTables(): Observable<any> { return this.get('Tables/GetActiveTables'); }
  getTableBoard(): Observable<any> { return this.get('Tables/Board'); }
  setTableState(tableId: number, state: string): Observable<any> { return this.post(`Tables/${tableId}/State`, { state }); }
  getSeatedGuest(tableId: any): Observable<any> { return this.get(`Tables/${tableId}/SeatedGuest`); }

  // ---- waitlist tokens
  getWaitlist(): Observable<any> { return this.get('Waitlist'); }
  getKnownCustomer(mobile: string): Observable<any> { return this.get('Waitlist/KnownCustomer', { mobile }); }
  createToken(input: { customerName: string; mobile: string; email?: string | null; guests: number; notes?: string | null }): Observable<any> {
    return this.post('Waitlist', input);
  }
  assignToken(tokenId: number, tableIds: number[] | null): Observable<any> { return this.post(`Waitlist/${tokenId}/Assign`, { tableIds }); }
  seatToken(tokenId: number, tableIds: number[] | null): Observable<any> { return this.post(`Waitlist/${tokenId}/Seat`, { tableIds }); }
  cancelToken(tokenId: number): Observable<any> { return this.post(`Waitlist/${tokenId}/Cancel`, {}); }
  noShowToken(tokenId: number): Observable<any> { return this.post(`Waitlist/${tokenId}/NoShow`, {}); }

  // ---- orders
  getOrderByTable(tableId: any): Observable<any> { return this.get('Orders/GetOrderByTable', { tableID: tableId }); }
  createOrder(order: any): Observable<any> { return this.post('Orders/CreateOrder', order); }
  updateOrder(order: any): Observable<any> { return this.post('Orders/UpdateOrder', order); }
  cancelOrder(orderId: number, remarks: string): Observable<any> {
    return this.post('Orders/CancelOrder', { orderid: orderId, remarks, complimentaryf: false });
  }
  reprintKot(orderId: number): Observable<any> { return this.post(`Orders/${orderId}/ReprintKOT`, {}); }
  getOrdersForReport(p: { fromDate: string; toDate: string; status: string; ordertypeid: number }): Observable<any> {
    return this.get('Orders/GetOrdersForReport', p);
  }
  getOrdersForKot(p: { fromDate: string; toDate: string; status: string; ordertypeid: number }): Observable<any> {
    return this.get('Orders/GetOrdersForKOTReport', p);
  }
  /** The API takes a list of items. */
  updateKotStatus(items: Array<{ orderDetailId: number; kotStatus: string }>): Observable<any> {
    return this.post('Orders/UpdateKOTItemStatus', items);
  }

  // ---- bills
  calculateBill(input: { orderIds: number[]; discountId: number | null; customDiscount: number | null }): Observable<any> {
    return this.post('Bill/Calculate', input);
  }
  createBill(bill: any): Observable<any> { return this.post('Bill/CreateBill', bill); }
  updateBill(bill: any): Observable<any> { return this.post('Bill/UpdateBill/', bill); }
  getBillReport(p: { fromDate: string; toDate: string; status: string; orderType: string }): Observable<any> {
    return this.get('Bill/GetBillOrderReport', p);
  }

  // ---- customers
  getCustomersByPhone(phone: string): Observable<any> { return this.get('Customers/ByPhone', { phone }); }
  addCustomer(customer: any): Observable<any> { return this.post('Customers', customer); }

  // ---- work period
  getWorkPeriod(): Observable<any> { return this.get('WorkPeriod'); }
}

/** yyyy-MM-dd in local time. */
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

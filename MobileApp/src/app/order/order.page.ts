import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonModal, IonSpinner, IonTitle, IonToolbar, NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, addOutline, arrowBack, cardOutline, cashOutline, checkmarkCircle, chevronForward, closeCircle, closeOutline,
  giftOutline, personOutline, phonePortraitOutline, printOutline, pricetagOutline, receiptOutline, removeOutline, searchOutline,
  sendOutline, trashOutline, chatbubbleOutline, restaurantOutline, refreshOutline,
} from 'ionicons/icons';
import { Subject, catchError, debounceTime, filter, firstValueFrom, forkJoin, merge, of, switchMap } from 'rxjs';
import { QueryService } from '../core/services/query.service';
import { AuthService } from '../core/services/auth.service';
import { UiService } from '../core/services/ui.service';
import { LiveHubService } from '../core/services/live-hub.service';
import { apiError } from '../core/guards/auth-interceptor.service';
import { Totals, discountLabel, previewTotals, rememberTaxMode, samePhone } from './bill-math';

interface DraftLine { itemid: number; name: string; code?: string; price: number; qty: number; }
type PayMode = 'cash' | 'card' | 'upi';

// Dine-in order screen (web: /order/:tableId/:floorId/1/:tableName).
// New items stay on the phone (kept per table if the screen is left) until "Send KOT".
// Sent orders and their amounts come from the API; billing goes through Bill/CreateBill / UpdateBill.
@Component({
  selector: 'app-order',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, DecimalPipe, DatePipe, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonFooter,
    IonIcon, IonModal, IonSpinner,
  ],
  templateUrl: './order.page.html',
  styleUrls: ['./order.page.scss'],
})
export class OrderPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private nav = inject(NavController);
  private query = inject(QueryService);
  private auth = inject(AuthService);
  private ui = inject(UiService);
  private hub = inject(LiveHubService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  readonly discountLabel = discountLabel;

  tableId = 0;
  floorId = 0;
  typeId = 1;
  readonly tableName = signal('');

  // menu
  readonly categories = signal<any[]>([]);
  readonly activeCat = signal<number | null>(null);
  readonly search = signal('');
  readonly menuLoading = signal(true);

  // masters
  private taxes: any[] = [];
  private extras: any[] = [];
  readonly discounts = signal<any[]>([]);

  // orders
  readonly sent = signal<any[]>([]);
  readonly savedTotals = signal<any>(null);
  readonly draft = signal<DraftLine[]>([]);
  comment = '';
  readonly ordersLoading = signal(true);
  updateBillId = -1;
  readonly isPrinted = signal(false);

  // discount
  readonly discountIndex = signal(-1);
  readonly customDiscount = signal(0);
  readonly calcTotals = signal<Totals | null>(null);
  private calc$ = new Subject<void>();

  // customer
  customerId = 0;
  customerName = '';
  customerPhone = '';
  customerAddress = '';
  private lockedPhone = '';
  readonly phoneMatches = signal<any[]>([]);
  readonly nameLocked = signal(false);
  private phone$ = new Subject<string>();

  // ui
  readonly cartOpen = signal(false);
  readonly settleOpen = signal(false);
  readonly sending = signal(false);
  readonly billing = signal(false);
  payMode: PayMode = 'cash';
  cashReceived: number | null = null;
  payRef = '';
  complimentary = false;
  compReason = '';

  // ---- derived
  readonly allItems = computed(() => this.categories().flatMap(c => (c.orderdetail || []).map((i: any) => ({ ...i, cat: c.id }))));
  readonly visibleItems = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (q) {
      return this.allItems().filter(i => String(i.name).toLowerCase().includes(q) || String(i.code ?? '').toLowerCase().includes(q));
    }
    const cat = this.categories().find(c => c.id === this.activeCat());
    return cat?.orderdetail || [];
  });
  readonly qtyById = computed(() => {
    const m = new Map<number, number>();
    for (const l of this.draft()) m.set(l.itemid, l.qty);
    return m;
  });
  readonly draftCount = computed(() => this.draft().reduce((s, l) => s + l.qty, 0));
  readonly draftTotal = computed(() => this.draft().reduce((s, l) => s + l.qty * l.price, 0));
  readonly includedOrders = computed(() => this.sent().filter(o => o.flag));
  readonly sentCount = computed(() => this.sent().reduce((s, o) => s + (o.orderdetail || []).reduce((a: number, d: any) => a + (d.qty || 0), 0), 0));
  readonly hasDraft = computed(() => this.draft().length > 0);
  readonly selectedDiscount = computed(() => this.discounts()[this.discountIndex()] ?? null);

  /** Server amounts for saved orders; a browser estimate while new items are unsent (as on the web). */
  readonly totals = computed<Totals>(() => {
    const saved = this.savedTotals();
    if (this.hasDraft() || !saved) return this.preview();
    if (!this.needsCalc()) return { subtotal: saved.subtotal, tax: saved.tax, discount: 0, extraamount: saved.extraamount, total: saved.total };
    return this.calcTotals() ?? this.preview();
  });
  /** Saved totals cover every open order without discount; anything else is asked from Bill/Calculate. */
  private needsCalc(): boolean {
    return !!this.selectedDiscount() || !this.sent().every(o => o.flag);
  }
  private recalc(): void {
    this.calcTotals.set(null);
    if (!this.hasDraft() && this.includedOrders().length && this.needsCalc()) this.calc$.next();
  }
  readonly discountNote = computed(() => {
    const d = this.selectedDiscount();
    if (!d || d.discountname == 'customize' || !d.discountrangestatus || this.totals().discount > 0) return '';
    return `"${d.discountname}" applies only to bills from ₹${Number(d.discountfrom)} to ₹${Number(d.discountto)}.`;
  });

  constructor() {
    addIcons({
      add, addOutline, arrowBack, cardOutline, cashOutline, checkmarkCircle, chevronForward, closeCircle, closeOutline,
      giftOutline, personOutline, phonePortraitOutline, printOutline, pricetagOutline, receiptOutline, removeOutline, searchOutline,
      sendOutline, trashOutline, chatbubbleOutline, restaurantOutline, refreshOutline,
    });
  }

  ngOnInit(): void {
    const p = this.route.snapshot.paramMap;
    this.tableId = Number(p.get('tableId')) || 0;
    this.floorId = Number(p.get('floorId')) || 0;
    this.typeId = Number(p.get('typeId')) || 1;
    this.tableName.set(p.get('tableName') || 'Table');
    this.restoreDraft();

    // Bill/Calculate for a discount on saved orders; the latest choice wins.
    this.calc$.pipe(
      switchMap(() => this.query.calculateBill(this.calcRequest()).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((res: any) => {
      if (!res?.data) {
        if (this.selectedDiscount()) this.ui.toast('Could not calculate the discount. Choose it again.', 'error');
        return;
      }
      rememberTaxMode(res.data);
      this.calcTotals.set({ subtotal: res.data.subtotal, tax: res.data.tax, discount: res.data.discount, extraamount: res.data.extraamount, total: res.data.total });
    });

    this.phone$.pipe(
      debounceTime(400),
      switchMap(phone => this.query.getCustomersByPhone(phone).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((res: any) => this.onPhoneMatches(res?.data || []));

    // Another device changed this table (new KOT, bill printed / settled): reload its orders.
    merge(this.hub.on<any>('OrderUpdated'), this.hub.on<any>('OrderSettled'), this.hub.on('TableStatus'), this.hub.resync$)
      .pipe(debounceTime(500), filter(() => !this.sending() && !this.billing()), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadOrders(true));

    this.loadMasters();
    this.loadOrders();
  }

  // ---------------- loading
  private loadMasters(): void {
    forkJoin({
      menu: this.query.getMenu().pipe(catchError(() => of(null))),
      tax: this.query.getTax().pipe(catchError(() => of(null))),
      disc: this.query.getDiscounts().pipe(catchError(() => of(null))),
      extra: this.query.getExtraCharges().pipe(catchError(() => of(null))),
      types: this.query.getOrderTypes().pipe(catchError(() => of(null))),
    }).subscribe(({ menu, tax, disc, extra, types }) => {
      // Express Stall categories belong to the stall screen only (web: applyMenuFilter).
      const branchHasStall = !!types?.expressStall;
      const cats = (menu?.menu || []).filter((c: any) => !branchHasStall || !c.expressstall);
      this.categories.set(cats);
      if (cats.length && this.activeCat() == null) this.activeCat.set(cats[0].id);
      this.taxes = tax?.data || [];
      this.extras = extra?.data || [];
      this.discounts.set(disc?.data || []);
      this.menuLoading.set(false);
      if (!menu) this.ui.toast('Could not load the menu. Pull down on Tables and try again.', 'error');
    });
  }

  loadOrders(silent = false): void {
    if (!this.tableId) {
      this.ordersLoading.set(false);
      return;
    }
    this.query.getOrderByTable(this.tableId).subscribe({
      next: (res: any) => {
        const flags = new Map(this.sent().map(o => [o.orderid, o.flag]));
        if (res?.status === 'Success' && Array.isArray(res.data)) {
          let printed = false;
          let billId = -1;
          const orders = res.data.map((o: any) => {
            if (o.status === 'printed') {
              printed = true;
              billId = o.billingid;
            } else if (o.billingid > 0) {
              billId = o.billingid; // a settled bill reopened for editing keeps its number
            }
            return { ...o, flag: flags.get(o.orderid) ?? true };
          });
          this.sent.set(orders);
          this.isPrinted.set(printed);
          this.updateBillId = billId;
          this.savedTotals.set(res.totals ?? null);
          rememberTaxMode(res.totals);
          this.fillCustomerFromOrders(orders, res.billDetails);
          this.recalc();
        } else {
          this.sent.set([]);
          this.savedTotals.set(null);
          this.isPrinted.set(false);
          this.updateBillId = -1;
          if (!silent && !this.customerId && !this.customerName.trim()) this.prefillSeatedGuest();
        }
        this.ordersLoading.set(false);
      },
      error: err => {
        this.ordersLoading.set(false);
        if (!silent) this.ui.toast(apiError(err, 'Could not load the orders of this table'), 'error');
      },
    });
  }

  private fillCustomerFromOrders(orders: any[], bill: any): void {
    if (this.customerId || this.customerName.trim()) return;
    const withCustomer = orders.find(o => o.customerid);
    if (!withCustomer) return;
    this.customerId = withCustomer.customerid;
    this.customerName = withCustomer.customername || bill?.billname || '';
    this.customerPhone = bill?.phone || '';
    this.customerAddress = bill?.address || '';
    this.lockedPhone = this.customerPhone;
    this.nameLocked.set(!!this.customerName);
    this.cdr.markForCheck();
  }

  // A table seated from the waitlist starts with the token's customer.
  private prefillSeatedGuest(): void {
    this.query.getSeatedGuest(this.tableId).subscribe({
      next: (res: any) => {
        const g = res?.data;
        if (!g || this.customerId || this.customerName.trim()) return;
        const matches: any[] = g.customers || [];
        if (matches.length === 1) {
          this.applyCustomer(matches[0]);
        } else {
          this.customerName = g.customername || '';
          this.customerPhone = g.mobile || '';
          this.phoneMatches.set(matches);
        }
        this.cdr.markForCheck();
      },
      error: () => { },
    });
  }

  // ---------------- menu / draft
  pickCategory(id: number): void {
    this.search.set('');
    this.activeCat.set(id);
  }

  add(item: any): void {
    this.ui.tap();
    const lines = [...this.draft()];
    const i = lines.findIndex(l => l.itemid === item.itemid);
    if (i >= 0) lines[i] = { ...lines[i], qty: lines[i].qty + 1 };
    else lines.push({ itemid: item.itemid, name: item.name, code: item.code, price: Number(item.price) || 0, qty: 1 });
    this.setDraft(lines);
  }

  dec(itemid: number): void {
    this.ui.tap();
    const lines = this.draft()
      .map(l => l.itemid === itemid ? { ...l, qty: l.qty - 1 } : l)
      .filter(l => l.qty > 0);
    this.setDraft(lines);
  }

  removeLine(itemid: number): void {
    this.setDraft(this.draft().filter(l => l.itemid !== itemid));
  }

  async clearDraft(): Promise<void> {
    if (!(await this.ui.confirm('Clear new items?', 'The items not sent to the kitchen will be removed.', 'Clear', true))) return;
    this.setDraft([]);
    this.comment = '';
  }

  private setDraft(lines: DraftLine[]): void {
    this.draft.set(lines);
    this.saveDraft();
  }

  private draftKey(): string {
    return `draft:${this.typeId}:${this.tableId}`;
  }

  saveDraft(): void {
    try {
      if (this.draft().length) localStorage.setItem(this.draftKey(), JSON.stringify({ lines: this.draft(), comment: this.comment }));
      else localStorage.removeItem(this.draftKey());
    } catch { }
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(this.draftKey());
      if (!raw) return;
      const d = JSON.parse(raw);
      this.draft.set(Array.isArray(d?.lines) ? d.lines : []);
      this.comment = d?.comment || '';
    } catch { }
  }

  // ---------------- customer
  onPhoneChange(value: string): void {
    if (this.customerId > 0 && !samePhone(this.lockedPhone, value)) {
      this.customerId = 0;
      this.nameLocked.set(false);
    }
    this.phoneMatches.set([]);
    if (String(value ?? '').replace(/\D/g, '').length >= 6 && !(this.customerId > 0)) this.phone$.next(String(value));
  }

  private onPhoneMatches(matches: any[]): void {
    const fresh = matches.filter(c => samePhone(c.contactnumber, this.customerPhone));
    if (this.customerId > 0 || !fresh.length) this.phoneMatches.set([]);
    else if (fresh.length === 1) this.applyCustomer(fresh[0]);
    else this.phoneMatches.set(fresh);
  }

  applyCustomer(c: any): void {
    this.customerId = c.customerid;
    this.customerName = c.name || '';
    this.customerPhone = c.contactnumber || '';
    this.customerAddress = c.address || '';
    this.lockedPhone = this.customerPhone;
    this.nameLocked.set(!!this.customerName);
    this.phoneMatches.set([]);
    this.cdr.markForCheck();
  }

  clearCustomer(): void {
    this.customerId = 0;
    this.customerName = this.customerPhone = this.customerAddress = this.lockedPhone = '';
    this.nameLocked.set(false);
    this.phoneMatches.set([]);
  }

  /** A typed-in customer is saved in the customer master first, so orders and bills carry its id. */
  private async ensureCustomer(): Promise<void> {
    if (this.customerId || !this.customerName.trim()) return;
    const s = this.auth.session();
    const res: any = await firstValueFrom(this.query.addCustomer({
      customerid: 0,
      name: this.customerName.trim(),
      contactnumber: this.customerPhone?.trim() || null,
      email: '',
      address: this.customerAddress?.trim() || '',
      branchid: s?.branchId || null,
      outletid: s?.outletId || null,
    }));
    this.customerId = res?.data?.customerid || 0;
    this.lockedPhone = this.customerPhone;
    this.nameLocked.set(!!this.customerId);
  }

  // ---------------- KOT
  async sendKot(): Promise<void> {
    if (!this.hasDraft() || this.sending()) return;
    this.sending.set(true);
    try {
      await this.ensureCustomer();
      const lines = this.draft();
      const order = {
        orderid: 0,
        waiterid: this.auth.session()?.userId || 0,
        tableid: this.tableId,
        timedate: new Date().toISOString(),
        customerid: this.customerId || 0,
        bookingid: 0,
        ordertypeid: this.typeId,
        orderdetail: lines.map(l => ({ itemid: l.itemid, name: l.name, qty: l.qty, price: l.price, sumofprice: +(l.qty * l.price).toFixed(2) })),
        totalprice: +lines.reduce((s, l) => s + l.qty * l.price, 0).toFixed(2),
        status: '',
        billingid: 0,
        comments: this.comment.trim(),
        guestlabel: null,
      };
      const res: any = await firstValueFrom(this.query.createOrder(order));
      if (res?.status !== 'Success') {
        this.ui.alert('KOT not sent', res?.message || 'Please check and send again.');
        return;
      }
      this.comment = '';
      this.setDraft([]);
      const failed = (res.printResults || []).filter((r: any) => !r.ok);
      if (failed.length) {
        this.ui.alert('KOT saved — printing failed',
          'Not printed in: ' + failed.map((r: any) => `${r.kitchen} (${r.printer || 'default printer'})`).join(', ') +
          '. Check the printer, then use Reprint KOT on the order.');
      } else {
        this.ui.toast('KOT sent to the kitchen', 'success');
      }
      this.loadOrders(true);
    } catch (err: any) {
      this.ui.alert('KOT not sent', apiError(err, 'KOT could not be sent. Please try again.'));
    } finally {
      this.sending.set(false);
    }
  }

  /** Reprint is for Admin / SuperAdmin (the API's rule). */
  readonly canReprint = computed(() => this.auth.isAdmin());

  reprint(o: any): void {
    this.query.reprintKot(o.orderid).subscribe({
      next: (res: any) => this.ui.toast(res?.message || 'KOT printed', res?.status === 'Success' ? 'success' : 'error'),
      error: err => this.ui.toast(apiError(err, 'Could not reprint'), 'error'),
    });
  }

  toggleInclude(o: any): void {
    this.sent.set(this.sent().map(x => x.orderid === o.orderid ? { ...x, flag: !x.flag } : x));
    this.recalc();
  }

  // ---------------- discount
  chooseDiscount(index: number): void {
    this.discountIndex.set(index);
    const d = this.discounts()[index];
    if (d?.discountname == 'customize') {
      this.calcTotals.set(null); // waits for the amount (Apply)
      return;
    }
    this.recalc();
  }

  applyCustom(): void {
    if (!(Number(this.customDiscount()) > 0)) {
      this.ui.toast('Enter the discount amount', 'error');
      return;
    }
    this.recalc();
  }

  private calcRequest() {
    const d = this.selectedDiscount();
    return {
      orderIds: this.includedOrders().map(o => o.orderid),
      discountId: d?.discountid ?? null,
      customDiscount: d?.discountname == 'customize' ? Number(this.customDiscount()) || 0 : null,
    };
  }

  private preview(): Totals {
    const sentTotal = this.includedOrders().reduce((s, o) => s + (Number(o.totalprice) || 0), 0);
    return previewTotals(sentTotal + this.draftTotal(), this.taxes, this.selectedDiscount(), this.customDiscount(), this.extras, this.typeId);
  }

  // ---------------- bill
  get cashChange(): number | null {
    if (this.payMode !== 'cash' || this.cashReceived === null || (this.cashReceived as any) === '') return null;
    return Math.round((Number(this.cashReceived) - this.totals().total) * 100) / 100;
  }

  openSettle(): void {
    if (!this.canBill()) return;
    this.payMode = 'cash';
    this.cashReceived = null;
    this.payRef = '';
    this.complimentary = false;
    this.compReason = '';
    this.settleOpen.set(true);
  }

  canBill(): boolean {
    if (this.hasDraft()) {
      this.ui.toast('Send the new items to the kitchen first', 'error');
      return false;
    }
    if (!this.includedOrders().length) {
      this.ui.toast('Select at least one order for the bill', 'error');
      return false;
    }
    return true;
  }

  printBill(): void {
    if (!this.canBill()) return;
    this.saveBill({ lifecycleStatus: 'printed', status: 'unpaid', paidamount: null, paymentmode: null, notes: null, iscomplementary: false, complementaryreason: '' },
      'Bill printed');
  }

  settle(): void {
    if (this.complimentary) {
      if (!this.compReason.trim()) {
        this.ui.toast('Enter the reason for the complimentary bill', 'error');
        return;
      }
      this.saveBill({ lifecycleStatus: 'complementary', status: 'unpaid', paidamount: 0, paymentmode: null, notes: null, iscomplementary: true, complementaryreason: this.compReason.trim() },
        'Bill closed as complimentary');
      return;
    }
    const change = this.cashChange;
    if (change !== null && change < 0) {
      this.ui.toast('Cash received is less than the bill amount', 'error');
      return;
    }
    const ref = this.payRef.trim();
    const notes = change !== null
      ? `Cash received ${Number(this.cashReceived).toFixed(2)}, change ${change.toFixed(2)}`
      : ref ? `${this.payMode === 'card' ? 'Card' : 'UPI'} ref ${ref}` : '';
    this.saveBill({ lifecycleStatus: 'finalized', status: 'paid', paidamount: this.totals().total, paymentmode: this.payMode, notes, iscomplementary: false, complementaryreason: '' },
      'Bill settled');
  }

  private async saveBill(p: any, okMsg: string): Promise<void> {
    if (this.billing()) return;
    this.billing.set(true);
    try {
      await this.ensureCustomer();
      const t = this.totals();
      const d = this.selectedDiscount();
      const orderids = this.includedOrders().map(o => o.orderid);
      const call = this.updateBillId > 0
        ? this.query.updateBill({ billId: this.updateBillId, orderids, ...p })
        : this.query.createBill({
          billId: 0,
          dateTime: new Date().toISOString(),
          customerid: this.customerId || 0,
          phone: this.customerPhone || '',
          address: this.customerAddress || '',
          billname: this.customerName || '',
          gstin: '',
          comments: '',
          totalamount: t.total,
          billamount: t.total,
          tax: t.tax,
          extraamount: t.extraamount,
          discount: t.discount,
          discountid: d ? [d.discountid] : [],
          orderids,
          taxid: this.taxes.map(x => x.taxid),
          extraid: [],
          subtotal: t.subtotal,
          ...p,
        });
      const res: any = await firstValueFrom(call);
      if (res?.status !== 'Success') {
        this.ui.alert('Bill not saved', res?.message || 'Please try again.');
        return;
      }
      this.settleOpen.set(false);
      this.cartOpen.set(false);
      this.ui.toast(okMsg, 'success');
      this.nav.navigateBack('/tabs/tables');
    } catch (err: any) {
      this.ui.alert('Bill not saved', apiError(err, 'The bill could not be saved. Please try again.'));
    } finally {
      this.billing.set(false);
    }
  }

  back(): void {
    this.saveDraft();
    this.nav.navigateBack('/tabs/tables');
  }

  trackCat = (_: number, c: any) => c.id;
}

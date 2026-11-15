// Browser estimate of the bill while items are not sent yet — the web order screen's previewTotals(),
// itself the same steps as the API's BillCalculator.Compute (taxes -> discount -> extra charges, each on
// the running total; the total rounded to a whole rupee). Saved orders always use the server's amounts.

export interface Totals {
  subtotal: number;
  tax: number;
  discount: number;
  extraamount: number;
  total: number;
}

const TAX_MODE_KEY = 'taxInclusive';

/** The server's BillingSettings:TaxInclusive, learnt from its totals (default: inclusive). */
export function taxInclusive(): boolean {
  try { return localStorage.getItem(TAX_MODE_KEY) !== 'false'; } catch { return true; }
}

export function rememberTaxMode(totals: any): void {
  if (totals && typeof totals.taxinclusive === 'boolean') {
    try { localStorage.setItem(TAX_MODE_KEY, String(totals.taxinclusive)); } catch { }
  }
}

export function previewTotals(
  orderTotal: number, taxList: any[], discount: any | null, customDiscount: number, extraList: any[], typeId: number,
): Totals {
  const inclusive = taxInclusive();
  let running = orderTotal;
  const out: Totals = { subtotal: parseFloat(running.toFixed(2)), tax: 0, discount: 0, extraamount: 0, total: 0 };

  if (taxList.length && running) {
    let taxSum = 0;
    for (const x of taxList) {
      const inRange = x.taxrangestatus ? x.taxfrom <= running && x.taxto >= running : true;
      if (!inRange) continue;
      let t = 0;
      if (x.taxtype === 'percentage') {
        t = inclusive ? running - running / (1 + x.taxrate / 100) : (running * x.taxrate) / 100;
      } else if (x.taxtype === 'flat') {
        t = x.taxrate;
      }
      if (t) {
        if (!inclusive) running += Number(t) || 0;
        taxSum += Number(t) || 0;
      }
    }
    out.tax = parseFloat(taxSum.toFixed(2));
    if (inclusive) out.subtotal = parseFloat((running - taxSum).toFixed(2));
  }

  if (discount) {
    let d = 0;
    if (discount.discountname == 'customize') {
      d = Number(customDiscount) || 0;
    } else {
      const inRange = discount.discountrangestatus ? discount.discountfrom <= running && discount.discountto >= running : true;
      if (inRange) {
        if (discount.discounttype == 'percentage') d = (running * discount.discountrate) / 100;
        else if (discount.discounttype == 'flat') d = discount.discountrate;
      }
    }
    running -= Number(d) || 0;
    out.discount = parseFloat(Number(d).toFixed(2));
  }

  if (extraList.length && running) {
    let extra = 0;
    for (const x of extraList) {
      if (typeId != x.ordertypeid) continue;
      const inRange = x.extrachargestatus ? x.extrachargefrom <= running && x.extrachargeto >= running : true;
      if (!inRange) continue;
      let e = 0;
      if (x.extrachargetype === 'percentage') e = (running * x.extrachargerate) / 100;
      else if (x.extrachargetype === 'flat') e = x.extrachargerate;
      if (e) {
        running += Number(e) || 0;
        extra += Number(e) || 0;
      }
    }
    out.extraamount = parseFloat(extra.toFixed(2));
  }

  out.total = parseFloat(running.toFixed());
  return out;
}

export function discountLabel(d: any): string {
  if (d.discountname == 'customize') return 'Custom amount';
  const value = d.discounttype == 'percentage' ? `${Number(d.discountrate)}%` : `₹${Number(d.discountrate)}`;
  const range = d.discountrangestatus ? ` (bills ₹${Number(d.discountfrom)}–₹${Number(d.discountto)})` : '';
  return `${d.discountname} · ${value}${range}`;
}

/** Customers match on the phone number only (digits; last 10 when both have 10+). */
export function samePhone(a: any, b: any): boolean {
  const x = String(a ?? '').replace(/\D/g, ''), y = String(b ?? '').replace(/\D/g, '');
  if (x.length < 6 || y.length < 6) return false;
  return x.length >= 10 && y.length >= 10 ? x.slice(-10) === y.slice(-10) : x === y;
}

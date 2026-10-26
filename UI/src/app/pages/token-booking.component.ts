import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { QueryService } from '@appservices/query.service';
import { AuthService } from '@appservices/auth.service';
import { BranchSelectComponent } from '../shared/component/branch-select.component';
import { AppSettings } from '../core/constants/Appsettings';

// Walk-in token booking: a full-screen page (no menu) for the entrance desk or a tablet.
// The captain's waitlist screen (/waitlist) picks the tokens up automatically.
@Component({
  selector: 'app-token-booking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, BranchSelectComponent],
  template: `
    <section class="tb-page">
      <header class="tb-top">
        <div>
          <h1>{{ appName }}</h1>
          <span class="tb-branch">{{ branchName }}</span>
        </div>
        <a routerLink="/waitlist" class="btn btn-outline-light btn-sm"><i class="pi pi-arrow-left"></i> Waitlist</a>
      </header>

      <div class="tb-card">
        @if (!issued) {
          <h2>Get your table token</h2>
          <p class="tb-sub">Fill in your details and we will call you when your table is ready.</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <app-branch-select [(branchId)]="branchId"></app-branch-select>

            <label class="tb-label" for="tbName">Name *</label>
            <input id="tbName" class="form-control form-control-lg" formControlName="customerName" maxlength="100" autocomplete="off" />
            @if (invalid('customerName')) { <small class="text-danger">Please enter your name.</small> }

            <label class="tb-label" for="tbMobile">Mobile number *</label>
            <input id="tbMobile" class="form-control form-control-lg" formControlName="mobile" inputmode="tel" maxlength="20" autocomplete="off" />
            @if (invalid('mobile')) { <small class="text-danger">Please enter a valid mobile number.</small> }

            <label class="tb-label" for="tbEmail">Email (to get your token and table-ready alert)</label>
            <input id="tbEmail" class="form-control form-control-lg" formControlName="email" type="email" inputmode="email" maxlength="150" autocomplete="off" />
            @if (invalid('email')) { <small class="text-danger">Please enter a valid email address.</small> }

            <label class="tb-label">Number of guests *</label>
            <div class="tb-guests">
              <button type="button" class="btn btn-light" (click)="changeGuests(-1)" [disabled]="guests <= 1" aria-label="Fewer guests">
                <i class="pi pi-minus"></i>
              </button>
              <span class="tb-guests-value">{{ guests }}</span>
              <button type="button" class="btn btn-light" (click)="changeGuests(1)" [disabled]="guests >= 50" aria-label="More guests">
                <i class="pi pi-plus"></i>
              </button>
            </div>
            <div class="tb-quick">
              @for (n of quickGuests; track n) {
                <button type="button" class="btn btn-sm" [class.btn-primary]="guests === n" [class.btn-outline-secondary]="guests !== n" (click)="setGuests(n)">{{ n }}</button>
              }
            </div>

            <label class="tb-label" for="tbNotes">Special request</label>
            <input id="tbNotes" class="form-control" formControlName="notes" maxlength="200" placeholder="e.g. baby chair, wheelchair access" autocomplete="off" />

            @if (errorMessage) { <div class="alert alert-danger mt-3 mb-0">{{ errorMessage }}</div> }

            <button type="submit" class="btn btn-primary btn-lg w-100 mt-4" [disabled]="saving">
              {{ saving ? 'Please wait...' : 'Get token' }}
            </button>
          </form>
        } @else {
          <div class="tb-issued">
            <p class="tb-sub mb-1">Your token number</p>
            <div class="tb-code">{{ issued.tokencode }}</div>
            <p class="tb-name">{{ issued.customername }} &middot; {{ issued.guests }} guest{{ issued.guests > 1 ? 's' : '' }}</p>

            @if (issued.status === 'Called' && issued.tablename) {
              <div class="alert alert-success tb-msg">Your table <strong>{{ issued.tablename }}</strong> is ready. Please show this token to our captain.</div>
            } @else if (issued.partiesAhead === 0) {
              <div class="alert alert-info tb-msg">You are next in line.</div>
            } @else {
              <div class="alert alert-info tb-msg">
                {{ issued.partiesAhead }} {{ issued.partiesAhead === 1 ? 'party is' : 'parties are' }} ahead of you
                (about {{ issued.estimatedMinutes }} minutes).
              </div>
            }
            @if (issued.emailSent) {
              <p class="tb-sub">We have emailed your token to {{ issued.email }}.</p>
            }

            <button type="button" class="btn btn-primary btn-lg w-100 mt-3" (click)="reset()">New token</button>
            <p class="tb-sub mt-2">This screen resets in {{ countdown }} seconds.</p>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .tb-page { min-height: 100vh; background: linear-gradient(160deg, #1f2937, #374151); padding: 16px; display: flex; flex-direction: column; align-items: center; }
    .tb-top { width: 100%; max-width: 560px; display: flex; justify-content: space-between; align-items: center; color: #fff; margin-bottom: 16px; }
    .tb-top h1 { font-size: 1.4rem; margin: 0; font-weight: 700; }
    .tb-branch { opacity: .8; font-size: .9rem; }
    .tb-card { width: 100%; max-width: 560px; background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
    .tb-card h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
    .tb-sub { color: #6b7280; margin-bottom: 12px; }
    .tb-label { display: block; font-weight: 600; margin: 14px 0 6px; }
    .tb-guests { display: flex; align-items: center; gap: 16px; }
    .tb-guests .btn { width: 56px; height: 56px; font-size: 1.2rem; border: 1px solid #d1d5db; }
    .tb-guests-value { font-size: 2rem; font-weight: 700; min-width: 48px; text-align: center; }
    .tb-quick { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .tb-quick .btn { min-width: 44px; }
    .tb-issued { text-align: center; }
    .tb-code { font-size: 4.5rem; font-weight: 800; letter-spacing: 2px; color: #111827; line-height: 1.1; }
    .tb-name { font-size: 1.1rem; margin: 8px 0 16px; }
    .tb-msg { font-size: 1.05rem; }
  `
})
export class TokenBookingComponent implements OnInit, OnDestroy {

  appName = AppSettings.appName;
  branchName = localStorage.getItem('branchname') || '';
  branchId: number | null = Number(localStorage.getItem('branchid')) || null;
  quickGuests = [1, 2, 3, 4, 5, 6, 8, 10];

  form!: FormGroup;
  guests = 2;
  saving = false;
  errorMessage = '';
  issued: any = null;
  countdown = 0;
  private timer: any;

  constructor(private fb: FormBuilder, private query: QueryService, private auth: AuthService) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      customerName: ['', [Validators.required, Validators.maxLength(100)]],
      mobile: ['', [Validators.required, Validators.pattern(/^[+]?[0-9 -]{6,20}$/)]],
      email: ['', [Validators.email, Validators.maxLength(150)]],
      notes: ['']
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  changeGuests(delta: number): void {
    this.setGuests(this.guests + delta);
  }

  setGuests(n: number): void {
    this.guests = Math.min(50, Math.max(1, n));
  }

  submit(): void {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    this.saving = true;
    this.query.createWaitlistToken({
      customerName: v.customerName.trim(),
      mobile: v.mobile.trim(),
      email: v.email?.trim() || null,
      guests: this.guests,
      notes: v.notes?.trim() || null,
      branchId: this.auth.isOutletOwner() ? this.branchId : null
    }).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.issued = res.data;
        this.startCountdown();
      },
      error: (err: any) => {
        this.saving = false;
        this.errorMessage = err?.error?.message || 'Could not create the token. Please ask our captain.';
      }
    });
  }

  reset(): void {
    clearInterval(this.timer);
    this.issued = null;
    this.guests = 2;
    this.errorMessage = '';
    this.form.reset({ customerName: '', mobile: '', email: '', notes: '' });
  }

  // Return to an empty form on its own, so the next guest never sees the previous guest's details.
  private startCountdown(): void {
    clearInterval(this.timer);
    this.countdown = 20;
    this.timer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.reset();
      }
    }, 1000);
  }
}

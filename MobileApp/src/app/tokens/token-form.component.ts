import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline, removeOutline, ticket } from 'ionicons/icons';
import { Subject, catchError, debounceTime, of, switchMap, takeUntil } from 'rxjs';
import { QueryService } from '../core/services/query.service';
import { UiService } from '../core/services/ui.service';
import { apiError } from '../core/guards/auth-interceptor.service';

// Walk-in token booking (web: /token-booking). A mobile number already in the customer master
// fills in and locks the stored name (the server enforces it too).
@Component({
  selector: 'app-token-form',
  standalone: true,
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonSpinner],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ issued() ? 'Token issued' : 'New token' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()" aria-label="Close"><ion-icon slot="icon-only" name="close-outline"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      @if (!issued()) {
        <label class="field">
          <span>Mobile number *</span>
          <input [(ngModel)]="mobile" (ngModelChange)="lookup$.next($event)" inputmode="tel" maxlength="20" autocomplete="off" [disabled]="saving()" />
          @if (tried && !mobileOk()) { <small class="err">Enter a valid mobile number</small> }
        </label>
        <label class="field">
          <span>Name *</span>
          <input [(ngModel)]="name" maxlength="100" autocomplete="off" [disabled]="saving() || !!knownName()" />
          @if (knownName()) { <small>Returning customer — name from the last visit.</small> }
          @if (tried && !name.trim()) { <small class="err">Enter the customer's name</small> }
        </label>

        <div class="field">
          <span>Guests *</span>
          <div class="guests">
            <div class="stepper">
              <button type="button" (click)="setGuests(guests - 1)" [disabled]="guests <= 1" aria-label="Fewer guests"><ion-icon name="remove-outline"></ion-icon></button>
              <span>{{ guests }}</span>
              <button type="button" (click)="setGuests(guests + 1)" [disabled]="guests >= 50" aria-label="More guests"><ion-icon name="add-outline"></ion-icon></button>
            </div>
            <div class="quick">
              @for (n of quick; track n) {
                <button type="button" class="pill" [class.active]="guests === n" (click)="setGuests(n)">{{ n }}</button>
              }
            </div>
          </div>
        </div>

        <label class="field">
          <span>Email (optional)</span>
          <input [(ngModel)]="email" type="email" inputmode="email" maxlength="150" autocomplete="off" [disabled]="saving()" />
          @if (tried && !emailOk()) { <small class="err">Enter a valid email address</small> }
        </label>
        <label class="field">
          <span>Special request</span>
          <input [(ngModel)]="notes" maxlength="200" placeholder="e.g. baby chair, wheelchair access" autocomplete="off" [disabled]="saving()" />
        </label>

        @if (error()) { <div class="msg">{{ error() }}</div> }

        <button class="btn primary block big" (click)="submit()" [disabled]="saving()">
          @if (saving()) { <ion-spinner name="crescent"></ion-spinner> } Issue token
        </button>
      } @else {
        <div class="issued">
          <ion-icon name="ticket" class="tk-icon"></ion-icon>
          <p class="muted">Token number</p>
          <div class="code">{{ issued().tokencode }}</div>
          <p class="who">{{ issued().customername }} · {{ issued().guests }} guest{{ issued().guests > 1 ? 's' : '' }}</p>
          @if (issued().status === 'Called' && issued().tablename) {
            <div class="note ok">Table <b>{{ issued().tablename }}</b> is ready.</div>
          } @else if (issued().partiesAhead === 0) {
            <div class="note">Next in line.</div>
          } @else {
            <div class="note">{{ issued().partiesAhead }} {{ issued().partiesAhead === 1 ? 'party' : 'parties' }} ahead · about {{ issued().estimatedMinutes }} min</div>
          }
          @if (issued().emailSent) { <p class="muted small">Token emailed to {{ issued().email }}</p> }
          <div class="actions">
            <button class="btn outline" (click)="again()">New token</button>
            <button class="btn primary" (click)="close()">Done</button>
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .guests { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .quick { display: flex; gap: 6px; flex-wrap: wrap; .pill { padding: 8px 12px; } }
    .msg { background: var(--app-danger-soft); color: var(--ion-color-danger); border-radius: 12px; padding: 10px 12px; font-weight: 600; font-size: 13px; margin-bottom: 12px; }
    .big { min-height: 52px; font-size: 16px; margin-top: 6px; ion-spinner { width: 18px; height: 18px; } }
    .issued { text-align: center; padding: 18px 4px; }
    .tk-icon { font-size: 44px; color: var(--ion-color-primary); }
    .code { font-size: 64px; font-weight: 900; letter-spacing: 2px; line-height: 1.05; margin: 2px 0 8px; }
    .who { font-size: 16px; font-weight: 600; margin: 0 0 14px; }
    .note { background: var(--app-primary-soft); color: var(--ion-color-primary); border-radius: 12px; padding: 12px; font-weight: 600; }
    .note.ok { background: var(--app-success-soft); color: var(--ion-color-success); }
    .small { font-size: 12px; margin-top: 10px; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 22px; }
  `],
})
export class TokenFormComponent implements OnDestroy {
  private query = inject(QueryService);
  private modal = inject(ModalController);
  private ui = inject(UiService);

  readonly quick = [1, 2, 3, 4, 5, 6, 8, 10];
  name = '';
  mobile = '';
  email = '';
  notes = '';
  guests = 2;
  tried = false;

  readonly saving = signal(false);
  readonly error = signal('');
  readonly knownName = signal<string | null>(null);
  readonly issued = signal<any>(null);
  private created = false;

  readonly lookup$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor() {
    addIcons({ addOutline, closeOutline, removeOutline, ticket });
    this.lookup$.pipe(
      debounceTime(400),
      switchMap(m => String(m ?? '').replace(/\D/g, '').length < 6
        ? of(null)
        : this.query.getKnownCustomer(String(m).trim()).pipe(catchError(() => of(null)))),
      takeUntil(this.destroy$),
    ).subscribe((res: any) => {
      const known = res?.data?.name || null;
      if (known) this.name = known;
      else if (this.knownName()) this.name = '';
      this.knownName.set(known);
    });
  }

  mobileOk(): boolean {
    return /^[+]?[0-9 -]{6,20}$/.test(this.mobile.trim());
  }

  emailOk(): boolean {
    const e = this.email.trim();
    return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  setGuests(n: number): void {
    this.guests = Math.min(50, Math.max(1, n));
  }

  submit(): void {
    this.tried = true;
    this.error.set('');
    if (!this.mobileOk() || !this.name.trim() || !this.emailOk()) return;
    this.saving.set(true);
    this.query.createToken({
      customerName: this.name.trim(),
      mobile: this.mobile.trim(),
      email: this.email.trim() || null,
      guests: this.guests,
      notes: this.notes.trim() || null,
    }).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        this.created = true;
        this.issued.set(res.data);
        this.ui.toast(res.message || 'Token created', 'success');
      },
      error: err => {
        this.saving.set(false);
        this.error.set(apiError(err, 'Could not create the token'));
      },
    });
  }

  again(): void {
    this.issued.set(null);
    this.name = this.mobile = this.email = this.notes = '';
    this.guests = 2;
    this.tried = false;
    this.knownName.set(null);
  }

  close(): void {
    this.modal.dismiss(this.created, this.created ? 'created' : 'cancel');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { QueryService } from '@appservices/query.service';
import { AuthService } from '@appservices/auth.service';
import { WaitlistSignalrService } from '@appservices/waitlist-signalr.service';
import { BranchSelectComponent } from '../shared/component/branch-select.component';
import { AppSettings } from '../core/constants/Appsettings';

// TV calling display: full screen (no menu). Shows only the Called tokens with their table,
// until the captain seats them (then the table is occupied and the token drops off).
// Live via SignalR (WaitlistChanged from the API): no polling, it reloads only when something changed.
@Component({
  selector: 'app-token-display',
  standalone: true,
  imports: [CommonModule, RouterModule, BranchSelectComponent],
  template: `
    <section class="td-page">
      <header class="td-top">
        <div>
          <h1>{{ appName }}</h1>
          <span class="td-branch">{{ branchName }}</span>
        </div>
        <div class="td-clock">{{ now | date: 'h:mm a' }}</div>
      </header>

      @if (!fullscreen) {
        <div class="td-tools">
          <app-branch-select [branchId]="branchId" (branchIdChange)="onBranchChange($event)"></app-branch-select>
          <div class="td-tool-buttons">
            <a routerLink="/waitlist" class="btn btn-outline-light btn-sm"><i class="pi pi-arrow-left"></i> Waitlist</a>
            <button type="button" class="btn btn-light btn-sm" (click)="enterFullscreen()"><i class="pi pi-window-maximize"></i> Full screen</button>
          </div>
        </div>
      }

      <h2 class="td-title">Now calling</h2>

      @if (tokens.length) {
        <div class="td-grid">
          @for (t of tokens; track t.tokenid) {
            <article class="td-card" [class.td-new]="isNew(t)">
              <div class="td-code">{{ t.tokencode }}</div>
              <div class="td-name">{{ t.customername }}</div>
              <div class="td-table">
                <span class="td-table-label">Table</span>
                <span class="td-table-name">{{ tableText(t) }}</span>
              </div>
              <div class="td-meta">
                @if (t.floorname) { <span>{{ t.floorname }}</span> }
                <span>{{ t.guests }} guest{{ t.guests > 1 ? 's' : '' }}</span>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="td-empty">
          <i class="pi pi-clock"></i>
          <p>Please wait, we will call your token shortly.</p>
        </div>
      }

      <footer class="td-foot">
        <span>{{ waiting }} {{ waiting === 1 ? 'party' : 'parties' }} waiting</span>
        @if (offline) { <span class="td-offline">Reconnecting...</span> }
      </footer>
    </section>
  `,
  styles: `
    :host { display: block; }
    .td-page { min-height: 100vh; background: #0f172a; color: #f8fafc; padding: 2vh 3vw; display: flex; flex-direction: column; }
    .td-top { display: flex; justify-content: space-between; align-items: center; }
    .td-top h1 { font-size: clamp(1.4rem, 2.6vw, 2.6rem); font-weight: 800; margin: 0; color: #fff; }
    .td-branch { font-size: clamp(.9rem, 1.4vw, 1.4rem); color: #cbd5e1; }
    .td-clock { font-size: clamp(1.4rem, 2.6vw, 2.6rem); font-weight: 700; font-variant-numeric: tabular-nums; }
    .td-tools { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; margin-top: 12px;
                background: rgba(255,255,255,.06); border-radius: 10px; padding: 10px 14px 0; }
    .td-tools ::ng-deep .col-form-label { color: #e2e8f0; }
    .td-tool-buttons { display: flex; gap: 8px; margin-bottom: 1rem; }
    .td-title { font-size: clamp(1.2rem, 2.2vw, 2.2rem); font-weight: 700; color: #fbbf24; margin: 2.5vh 0 2vh; letter-spacing: .5px; text-transform: uppercase; }
    .td-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 2vw; align-content: start; flex: 1; }
    .td-card { background: #1e293b; border: 3px solid #334155; border-radius: 18px; padding: 2.4vh 2vw; }
    .td-card.td-new { border-color: #fbbf24; animation: td-pulse 1.2s ease-in-out infinite; }
    @keyframes td-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,.55); } 50% { box-shadow: 0 0 0 14px rgba(251,191,36,0); } }
    .td-code { font-size: clamp(2.6rem, 5.5vw, 5.5rem); font-weight: 800; line-height: 1; color: #fff; letter-spacing: 2px; }
    .td-name { font-size: clamp(1.2rem, 2.2vw, 2.2rem); font-weight: 600; color: #e2e8f0; margin-top: 1vh; overflow-wrap: anywhere; }
    .td-table { display: flex; align-items: baseline; gap: 12px; margin-top: 1.6vh; }
    .td-table-label { font-size: clamp(.9rem, 1.3vw, 1.3rem); color: #94a3b8; text-transform: uppercase; }
    .td-table-name { font-size: clamp(1.8rem, 3.6vw, 3.6rem); font-weight: 800; color: #4ade80; overflow-wrap: anywhere; }
    .td-meta { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 1vh; font-size: clamp(.9rem, 1.4vw, 1.4rem); color: #cbd5e1; }
    .td-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #cbd5e1; }
    .td-empty i { font-size: clamp(3rem, 6vw, 6rem); margin-bottom: 2vh; }
    .td-empty p { font-size: clamp(1.2rem, 2.4vw, 2.4rem); margin: 0; }
    .td-foot { display: flex; justify-content: space-between; margin-top: 2vh; font-size: clamp(.9rem, 1.4vw, 1.4rem); color: #94a3b8; }
    .td-offline { color: #f87171; }
    @media (prefers-reduced-motion: reduce) { .td-card.td-new { animation: none; } }
  `
})
export class TokenDisplayComponent implements OnInit, OnDestroy {

  // A token called within this many seconds pulses on screen.
  private static readonly NEW_SECONDS = 60;
  private static readonly BRANCH_KEY = 'tokenDisplayBranchId';

  appName = AppSettings.appName;
  branchName = localStorage.getItem('branchname') || '';
  branchId: number | null = Number(localStorage.getItem('branchid')) || null;

  tokens: any[] = [];
  waiting = 0;
  offline = false;
  fullscreen = false;
  now = new Date();
  // Server clock minus local clock, so "new" does not depend on the TV's clock being right.
  private clockOffsetMs = 0;
  // Branch the API answered for (an owner's chosen branch, else the user's own).
  private shownBranchId: number | null = null;
  private clockTimer: any;
  private request?: Subscription;
  private hub?: Subscription;
  // A change arrived while a load was running: load once more afterwards.
  private reloadPending = false;

  constructor(private query: QueryService, private auth: AuthService, private waitlistHub: WaitlistSignalrService) {}

  ngOnInit(): void {
    if (this.auth.isOutletOwner()) {
      try {
        const saved = Number(localStorage.getItem(TokenDisplayComponent.BRANCH_KEY));
        if (saved) this.branchId = saved;
      } catch { }
    }
    this.load();
    this.hub = this.waitlistHub.events$.subscribe(e => {
      if (e.kind === 'status') {
        this.offline = e.status !== 'connected';
      } else if (e.branchId == null || e.branchId === this.shownBranchId) {
        this.load();
      }
    });
    // Local only (clock and the "new call" highlight), no server calls.
    this.clockTimer = setInterval(() => this.now = new Date(), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
    this.hub?.unsubscribe();
    this.request?.unsubscribe();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.fullscreen = !!document.fullscreenElement;
  }

  enterFullscreen(): void {
    document.documentElement.requestFullscreen?.().catch(() => { });
  }

  onBranchChange(id: number | null): void {
    this.branchId = id;
    try { localStorage.setItem(TokenDisplayComponent.BRANCH_KEY, String(id ?? '')); } catch { }
    this.tokens = [];
    this.load();
  }

  load(): void {
    // Several changes in a row (e.g. seat + auto-assign) end in one extra load, not one each.
    if (this.request && !this.request.closed) {
      this.reloadPending = true;
      return;
    }
    const done = () => {
      if (this.reloadPending) {
        this.reloadPending = false;
        this.load();
      }
    };
    this.request = this.query.getWaitlistDisplay(this.auth.isOutletOwner() ? this.branchId : null).subscribe({
      next: (res: any) => {
        this.tokens = res?.data || [];
        const s = res?.summary || {};
        this.waiting = s.waiting || 0;
        this.shownBranchId = s.branchId ?? null;
        if (s.branchName) this.branchName = s.branchName;
        if (s.serverTime) this.clockOffsetMs = new Date(s.serverTime).getTime() - Date.now();
        setTimeout(done);
      },
      error: () => setTimeout(done)
    });
  }

  isNew(t: any): boolean {
    if (!t.calledat) return false;
    const age = Date.now() + this.clockOffsetMs - new Date(t.calledat).getTime();
    return age < TokenDisplayComponent.NEW_SECONDS * 1000;
  }

  tableText(t: any): string {
    const extra: string[] = t.combinedtables || [];
    return [t.tablename, ...extra].filter(Boolean).join(' + ') || '-';
  }
}

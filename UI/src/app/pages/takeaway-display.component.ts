import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, Subscription, debounceTime, merge } from 'rxjs';
import { QueryService } from '@appservices/query.service';
import { AuthService } from '@appservices/auth.service';
import { LiveHubService } from '@appservices/live-hub.service';
import { BranchSelectComponent } from '../shared/component/branch-select.component';
import { AppSettings } from '../core/constants/Appsettings';

// Take-away customer TV (read only): tokens being prepared and tokens ready to collect.
// The token is the "Token No#" on the customer's bill. Live via SignalR (order / KOT / bill events
// on the shared hub connection): no polling, it reloads only when something changed.
@Component({
  selector: 'app-takeaway-display',
  standalone: true,
  imports: [CommonModule, RouterModule, BranchSelectComponent],
  template: `
    <section class="tv-page">
      <header class="tv-top">
        <div>
          <h1>{{ appName }}</h1>
          <span class="tv-branch">{{ branchName }} &middot; Take-away orders</span>
        </div>
        <div class="tv-clock">{{ now | date: 'h:mm a' }}</div>
      </header>

      @if (!fullscreen) {
        <div class="tv-tools">
          <app-branch-select [branchId]="branchId" (branchIdChange)="onBranchChange($event)"></app-branch-select>
          <div class="tv-tool-buttons">
            <a routerLink="/take-away" class="btn btn-outline-light btn-sm"><i class="pi pi-arrow-left"></i> Take away</a>
            <button type="button" class="btn btn-light btn-sm" (click)="enterFullscreen()"><i class="pi pi-window-maximize"></i> Full screen</button>
          </div>
        </div>
      }

      <div class="tv-cols">
        <section class="tv-col tv-preparing" aria-label="Preparing">
          <h2><i class="pi pi-hourglass"></i> Preparing</h2>
          @if (preparing.length) {
            <div class="tv-grid">
              @for (t of preparing; track t.token) {
                <article class="tv-card">
                  <div class="tv-token">{{ t.token }}</div>
                  @if (t.customer) { <div class="tv-name">{{ t.customer }}</div> }
                </article>
              }
            </div>
          } @else {
            <p class="tv-empty">No orders in the kitchen</p>
          }
        </section>

        <section class="tv-col tv-ready" aria-label="Ready to collect">
          <h2><i class="pi pi-check-circle"></i> Ready to collect</h2>
          @if (visibleReady.length) {
            <div class="tv-grid">
              @for (t of visibleReady; track t.token) {
                <article class="tv-card" [class.tv-new]="isNew(t)">
                  <div class="tv-token">{{ t.token }}</div>
                  @if (t.customer) { <div class="tv-name">{{ t.customer }}</div> }
                </article>
              }
            </div>
          } @else {
            <p class="tv-empty">Please wait, your token will appear here when the order is ready</p>
          }
        </section>
      </div>

      <footer class="tv-foot">
        <span>Your token number is printed on your bill</span>
        @if (offline) { <span class="tv-offline">Reconnecting...</span> }
      </footer>
    </section>
  `,
  styles: `
    :host { display: block; }
    .tv-page { min-height: 100vh; background: #0f172a; color: #f8fafc; padding: 2vh 3vw; display: flex; flex-direction: column; }
    .tv-top { display: flex; justify-content: space-between; align-items: center; }
    .tv-top h1 { font-size: clamp(1.4rem, 2.6vw, 2.6rem); font-weight: 800; margin: 0; color: #fff; }
    .tv-branch { font-size: clamp(.9rem, 1.4vw, 1.4rem); color: #cbd5e1; }
    .tv-clock { font-size: clamp(1.4rem, 2.6vw, 2.6rem); font-weight: 700; font-variant-numeric: tabular-nums; }
    .tv-tools { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; margin-top: 12px;
                background: rgba(255,255,255,.06); border-radius: 10px; padding: 10px 14px 0; }
    .tv-tools ::ng-deep .col-form-label { color: #e2e8f0; }
    .tv-tool-buttons { display: flex; gap: 8px; margin-bottom: 1rem; }
    .tv-cols { flex: 1; display: grid; grid-template-columns: 2fr 3fr; gap: 2.5vw; margin-top: 2.5vh; min-height: 0; }
    .tv-col { border-radius: 18px; padding: 2vh 1.6vw; display: flex; flex-direction: column; min-width: 0; }
    .tv-col h2 { font-size: clamp(1.2rem, 2.2vw, 2.4rem); font-weight: 800; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 2vh; display: flex; align-items: center; gap: .6em; }
    .tv-preparing { background: #1e293b; }
    .tv-preparing h2 { color: #fbbf24; }
    .tv-ready { background: #052e1c; border: 3px solid #16a34a; }
    .tv-ready h2 { color: #4ade80; }
    .tv-grid { display: grid; gap: 1.4vw; align-content: start; }
    .tv-preparing .tv-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr)); }
    .tv-ready .tv-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); }
    .tv-card { border-radius: 14px; padding: 1.4vh 1vw; text-align: center; }
    .tv-preparing .tv-card { background: #334155; }
    .tv-ready .tv-card { background: #14532d; border: 3px solid #22c55e; }
    .tv-card.tv-new { border-color: #fde047; animation: tv-pulse 1.2s ease-in-out infinite; }
    @keyframes tv-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(253,224,71,.6); } 50% { box-shadow: 0 0 0 14px rgba(253,224,71,0); } }
    .tv-token { font-weight: 800; line-height: 1.05; color: #fff; font-variant-numeric: tabular-nums; letter-spacing: 1px; }
    .tv-preparing .tv-token { font-size: clamp(1.8rem, 3.4vw, 3.6rem); color: #e2e8f0; }
    .tv-ready .tv-token { font-size: clamp(2.6rem, 5.5vw, 6rem); }
    .tv-name { font-size: clamp(.9rem, 1.5vw, 1.6rem); color: #cbd5e1; margin-top: .6vh; overflow-wrap: anywhere; }
    .tv-ready .tv-name { color: #bbf7d0; }
    .tv-empty { margin: auto 0; text-align: center; font-size: clamp(1rem, 1.8vw, 2rem); color: #94a3b8; }
    .tv-foot { display: flex; justify-content: space-between; margin-top: 2vh; font-size: clamp(.9rem, 1.4vw, 1.4rem); color: #94a3b8; }
    .tv-offline { color: #f87171; }
    @media (max-width: 767.98px) { .tv-cols { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .tv-card.tv-new { animation: none; } }
  `
})
export class TakeawayDisplayComponent implements OnInit, OnDestroy {

  // A token that became ready within this many seconds pulses on screen.
  private static readonly NEW_SECONDS = 60;
  private static readonly BRANCH_KEY = 'takeawayDisplayBranchId';
  // Order / KOT / bill events that can change what the screen shows.
  private static readonly EVENTS = ['OrderUpdated', 'OrderSettled'];

  appName = AppSettings.appName;
  branchName = localStorage.getItem('branchname') || '';
  branchId: number | null = Number(localStorage.getItem('branchid')) || null;

  preparing: any[] = [];
  ready: any[] = [];
  offline = false;
  fullscreen = false;
  now = new Date();
  // Server clock minus local clock, so "new" / "expired" do not depend on the TV's clock being right.
  private clockOffsetMs = 0;
  private readyMinutes = 5;
  private clockTimer: any;
  private request?: Subscription;
  private subs = new Subscription();
  private changed$ = new Subject<void>();
  private reloadPending = false;

  constructor(private query: QueryService, private auth: AuthService, private hub: LiveHubService) {}

  ngOnInit(): void {
    if (this.auth.isOutletOwner()) {
      try {
        const saved = Number(localStorage.getItem(TakeawayDisplayComponent.BRANCH_KEY));
        if (saved) this.branchId = saved;
      } catch { }
    }
    this.load();
    // A burst of events (KOT + bill + alerts for one order) ends in one reload.
    this.subs.add(this.changed$.pipe(debounceTime(400)).subscribe(() => this.load()));
    this.subs.add(merge(...TakeawayDisplayComponent.EVENTS.map(e => this.hub.on(e)), this.hub.resync$).subscribe(() => this.changed$.next()));
    this.subs.add(this.hub.status$.subscribe(s => this.offline = s !== 'connected'));
    // Local only (clock, "new" highlight, ready tokens timing out), no server calls.
    this.clockTimer = setInterval(() => this.now = new Date(), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.clockTimer);
    this.subs.unsubscribe();
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
    try { localStorage.setItem(TakeawayDisplayComponent.BRANCH_KEY, String(id ?? '')); } catch { }
    this.preparing = [];
    this.ready = [];
    this.load();
  }

  load(): void {
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
    this.request = this.query.getTakeawayDisplay(this.auth.isOutletOwner() ? this.branchId : null).subscribe({
      next: (res: any) => {
        this.preparing = res?.preparing || [];
        this.ready = res?.ready || [];
        const s = res?.summary || {};
        if (s.branchName) this.branchName = s.branchName;
        if (s.readyMinutes) this.readyMinutes = s.readyMinutes;
        if (s.serverTime) this.clockOffsetMs = new Date(s.serverTime).getTime() - Date.now();
        setTimeout(done);
      },
      error: () => setTimeout(done)
    });
  }

  // Ready tokens leave the screen after readyMinutes even when nobody marks them picked up.
  get visibleReady(): any[] {
    const limit = this.readyMinutes * 60000;
    return this.ready.filter(t => !t.readyat || this.ageMs(t.readyat) < limit);
  }

  isNew(t: any): boolean {
    return !!t.readyat && this.ageMs(t.readyat) < TakeawayDisplayComponent.NEW_SECONDS * 1000;
  }

  private ageMs(at: string): number {
    return this.now.getTime() + this.clockOffsetMs - new Date(at).getTime();
  }
}

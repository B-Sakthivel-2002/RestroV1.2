import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';

// Settings > Sync Status, and a compact card on the dashboard.
//   Branch server: when this branch last uploaded to the online server, and why it is waiting if it is.
//   Online server: when each branch last uploaded (late = more than 30 minutes ago).
// Refreshes every minute while open (the upload itself runs about once a minute).
@Component({
  selector: 'app-sync-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (status && status.mode !== 'Standalone') {
      <div [class.cnt]="!compact">
        @if (!compact) {
          <div class="sub-header">
            <h2>Sync Status</h2>
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="load()" [disabled]="loading">
              <i class="pi pi-refresh"></i> Refresh
            </button>
          </div>
        }

        <div class="ss-card" [class.ss-compact]="compact">
          @if (status.mode === 'Cloud') {
            <div class="ss-head">
              <span class="ss-badge"><i class="pi pi-globe"></i> Online view · read only</span>
              <span class="ss-muted">Bills are made on each branch server and appear here after its next upload.</span>
            </div>
            <div class="ss-list">
              @for (b of status.branches; track b.branchId) {
                <div class="ss-row">
                  <span class="ss-dot" [class.ok]="!isLate(b.lastUploadAt)" [class.late]="isLate(b.lastUploadAt)"></span>
                  <span class="ss-name">{{ b.branchName }}</span>
                  <span class="ss-when" [class.late-text]="isLate(b.lastUploadAt)">
                    {{ b.lastUploadAt ? 'Last upload ' + ago(b.lastUploadAt) : 'Never uploaded' }}
                  </span>
                </div>
              } @empty {
                <span class="ss-muted">No branches.</span>
              }
            </div>
          } @else {
            <div class="ss-row">
              <span class="ss-dot" [class.ok]="!problem" [class.late]="problem"></span>
              <span class="ss-name">Upload to online server</span>
              <span class="ss-when" [class.late-text]="problem">
                @if (!status.configured) {
                  Not set up (Sync:ServerUrl / Sync:Key) - this branch works offline only
                } @else if (status.state?.lastError) {
                  Waiting: {{ status.state.lastError }}
                } @else if (status.state?.lastSentAt) {
                  Up to date · last upload {{ ago(status.state.lastSentAt) }}
                } @else {
                  Not uploaded yet
                }
              </span>
            </div>
            @if (!compact && status.configured) {
              <p class="ss-muted ss-note">
                Online server: <code>{{ status.serverUrl }}</code> · branch id {{ status.branchId }} ·
                {{ status.state?.sentRows || 0 }} change(s) sent so far.
                Billing never waits for this; without internet the changes are sent when it is back.
              </p>
            }
          }
        </div>
      </div>
    } @else if (!compact && status) {
      <div class="cnt"><p class="ss-muted">This server is not connected to an online server (Sync:Mode is Standalone).</p></div>
    } @else if (!compact && error) {
      <div class="cnt"><p class="ss-error">{{ error }}</p></div>
    }
  `,
  styles: `
    .ss-card { background: var(--rp-surface); border: 1px solid var(--rp-border); border-radius: 12px; padding: 16px 18px;
               margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }
    .ss-compact { margin: 0 0 16px; }
    .ss-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
    .ss-badge { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--rp-primary);
                background: var(--rp-primary-soft); border-radius: 999px; padding: 4px 12px; }
    .ss-list { display: flex; flex-direction: column; gap: 8px; }
    .ss-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .ss-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--rp-text-muted); flex: none; }
    .ss-dot.ok { background: var(--rp-success); }
    .ss-dot.late { background: var(--rp-danger); }
    .ss-name { font-weight: 600; min-width: 160px; }
    .ss-when { color: var(--rp-text-muted); overflow-wrap: anywhere; min-width: 0; }
    .late-text { color: var(--rp-danger); }
    .ss-muted { color: var(--rp-text-muted); margin: 0; }
    .ss-note { font-size: var(--rp-fs-xs); }
    .ss-note code { overflow-wrap: anywhere; }
    .ss-error { color: var(--rp-danger); margin: 0; }
  `
})
export class SyncStatusComponent implements OnInit, OnDestroy {
  // Dashboard card: no title / refresh button, short text.
  @Input() compact = false;

  status: any = null;
  loading = false;
  error = '';
  private timer: any;

  constructor(private query: QueryService) {}

  ngOnInit(): void {
    this.query.getServerMode().subscribe((m) => {
      if (m.mode === 'Standalone') {
        this.status = { mode: 'Standalone' };
        return;
      }
      this.load();
      this.timer = setInterval(() => this.load(), 60_000);
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  get problem(): boolean {
    return !this.status?.configured || !!this.status?.state?.lastError;
  }

  load(): void {
    this.loading = true;
    this.query.getSyncStatus().subscribe({
      next: (data) => {
        this.status = data;
        this.error = '';
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not read the sync status.';
        this.loading = false;
      }
    });
  }

  isLate(at: string | null): boolean {
    return !at || Date.now() - new Date(at).getTime() > 30 * 60_000;
  }

  ago(at: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60_000));
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} h ${min % 60} min ago`;
    return new Date(at).toLocaleString();
  }
}

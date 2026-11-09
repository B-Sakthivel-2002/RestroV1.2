import { Injectable } from '@angular/core';
import { Observable, map, merge } from 'rxjs';
import { HubStatus, LiveHubService } from './live-hub.service';

export type { HubStatus } from './live-hub.service';

// The API sends this on the branch's hub group whenever a token or table changes
// (token created / called / seated / cancelled / no-show, table state, transfer, merge, release after bill).
const WAITLIST_CHANGED = 'WaitlistChanged';

export interface WaitlistHubEvent {
  // 'changed': the given branch changed. 'status': the connection state changed.
  kind: 'changed' | 'status';
  branchId?: number | null;
  status?: HubStatus;
}

// Waitlist / table events on the shared hub connection.
@Injectable({ providedIn: 'root' })
export class WaitlistSignalrService {

  readonly events$: Observable<WaitlistHubEvent>;

  constructor(hub: LiveHubService) {
    this.events$ = merge(
      hub.on<any>(WAITLIST_CHANGED).pipe(map(p => ({ kind: 'changed', branchId: p?.branchId ?? null } as WaitlistHubEvent))),
      hub.status$.pipe(map(status => ({ kind: 'status', status } as WaitlistHubEvent)))
    );
  }
}

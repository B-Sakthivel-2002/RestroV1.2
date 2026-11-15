import { TestBed } from '@angular/core/testing';

import { KotSignalrService } from './kot-signalr.service';

describe('KotSignalrService', () => {
  let service: KotSignalrService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KotSignalrService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

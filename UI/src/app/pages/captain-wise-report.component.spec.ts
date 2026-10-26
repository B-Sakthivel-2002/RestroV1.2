import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CaptainWiseReportComponent } from './captain-wise-report.component';

describe('CaptainWiseReportComponent', () => {
  let component: CaptainWiseReportComponent;
  let fixture: ComponentFixture<CaptainWiseReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaptainWiseReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CaptainWiseReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

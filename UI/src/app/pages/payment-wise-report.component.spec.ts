import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentWiseReportComponent } from './payment-wise-report.component';

describe('PaymentWiseReportComponent', () => {
  let component: PaymentWiseReportComponent;
  let fixture: ComponentFixture<PaymentWiseReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentWiseReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentWiseReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerWiseReportComponent } from './customer-wise-report.component';

describe('CustomerWiseReportComponent', () => {
  let component: CustomerWiseReportComponent;
  let fixture: ComponentFixture<CustomerWiseReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerWiseReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerWiseReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

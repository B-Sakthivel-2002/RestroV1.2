import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaxWiseReportComponent } from './tax-wise-report.component';

describe('TaxWiseReportComponent', () => {
  let component: TaxWiseReportComponent;
  let fixture: ComponentFixture<TaxWiseReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxWiseReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaxWiseReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComplementaryReportComponent } from './complementary-report.component';

describe('ComplementaryReportComponent', () => {
  let component: ComplementaryReportComponent;
  let fixture: ComponentFixture<ComplementaryReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplementaryReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComplementaryReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

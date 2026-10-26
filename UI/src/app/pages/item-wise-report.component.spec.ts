import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemWiseReportComponent } from './item-wise-report.component';

describe('ItemWiseReportComponent', () => {
  let component: ItemWiseReportComponent;
  let fixture: ComponentFixture<ItemWiseReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemWiseReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItemWiseReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

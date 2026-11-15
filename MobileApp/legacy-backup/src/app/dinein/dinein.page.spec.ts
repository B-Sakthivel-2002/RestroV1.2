import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DineinPage } from './dinein.page';

describe('DineinPage', () => {
  let component: DineinPage;
  let fixture: ComponentFixture<DineinPage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(DineinPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

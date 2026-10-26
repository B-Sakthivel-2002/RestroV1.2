import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderHistroyComponent } from './order-histroy.component';

describe('OrderHistroyComponent', () => {
  let component: OrderHistroyComponent;
  let fixture: ComponentFixture<OrderHistroyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderHistroyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderHistroyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

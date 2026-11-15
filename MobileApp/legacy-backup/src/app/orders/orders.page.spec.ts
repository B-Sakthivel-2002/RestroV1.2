import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { OrdersPage } from './orders.page';

describe('OrdersPage', () => {
  let component: OrdersPage;
  let fixture: ComponentFixture<OrdersPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return correct order type name from getOrderTypeName', () => {
    component.orderTypeList = [
      { ordertypeid: 0, ordertypename: 'All Order Type' },
      { ordertypeid: 1, ordertypename: 'Dine-in' },
      { ordertypeid: 2, ordertypename: 'Takeaway' }
    ];

    expect(component.getOrderTypeName(0)).toBe('All Order Type');
    expect(component.getOrderTypeName(1)).toBe('Dine-in');
    expect(component.getOrderTypeName(2)).toBe('Takeaway');
    expect(component.getOrderTypeName(99)).toBe('All Order Type');
  });

  it('should update selectedOrderTypeName when onOrderTypeChange is called', () => {
    component.orderTypeList = [
      { ordertypeid: 0, ordertypename: 'All Order Type' },
      { ordertypeid: 1, ordertypename: 'Dine-in' },
      { ordertypeid: 2, ordertypename: 'Takeaway' }
    ];

    component.onOrderTypeChange(2);
    expect(component.inputType).toBe(2);
    expect(component.selectedOrderTypeName).toBe('Takeaway');
  });
});

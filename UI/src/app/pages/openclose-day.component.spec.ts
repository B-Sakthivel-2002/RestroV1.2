import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpencloseDayComponent } from './openclose-day.component';

describe('OpencloseDayComponent', () => {
  let component: OpencloseDayComponent;
  let fixture: ComponentFixture<OpencloseDayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpencloseDayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OpencloseDayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

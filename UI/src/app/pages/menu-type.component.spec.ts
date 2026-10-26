import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuTypeComponent } from './menu-type.component';

describe('MenuTypeComponent', () => {
  let component: MenuTypeComponent;
  let fixture: ComponentFixture<MenuTypeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuTypeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuTypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

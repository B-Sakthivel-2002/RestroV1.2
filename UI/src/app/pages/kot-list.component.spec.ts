import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KotListComponent } from './kot-list.component';

describe('KotListComponent', () => {
  let component: KotListComponent;
  let fixture: ComponentFixture<KotListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KotListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KotListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

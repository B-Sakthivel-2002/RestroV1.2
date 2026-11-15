import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { KotPage } from './kot.page';

describe('KotPage', () => {
  let component: KotPage;
  let fixture: ComponentFixture<KotPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [KotPage],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(KotPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

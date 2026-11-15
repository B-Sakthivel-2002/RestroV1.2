import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';

describe('roleGuard', () => {
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
  });

  function createRouteSnapshot(dataRoles: string[]): ActivatedRouteSnapshot {
    return {
      data: { dataRoles }
    } as unknown as ActivatedRouteSnapshot;
  }

  it('should redirect unauthenticated users to login ("/")', () => {
    const route = createRouteSnapshot(['admin', 'cashier']);
    const result = TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));

    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('should allow Admin to access any protected tab', () => {
    localStorage.setItem('authToken', 'test-token');
    authService.setRoles(['Admin']);

    const route = createRouteSnapshot(['admin', 'cashier']);
    const result = TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));

    expect(result).toBeTrue();
  });

  it('should allow Cashier to access protected tabs', () => {
    localStorage.setItem('authToken', 'test-token');
    authService.setRoles(['Cashier']);

    const route = createRouteSnapshot(['admin', 'cashier']);
    const result = TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));

    expect(result).toBeTrue();
  });

  it('should redirect Captain when accessing restricted KOT tab to /tabs/captain', () => {
    localStorage.setItem('authToken', 'test-token');
    authService.setRoles(['Captain']);

    // Route only allowed for admin, cashier, chef
    const route = createRouteSnapshot(['admin', 'cashier', 'chef']);
    const result = TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));

    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toBe('/tabs/captain');
  });

  it('should redirect Chef when accessing restricted DineIn tab to /tabs/kot', () => {
    localStorage.setItem('authToken', 'test-token');
    authService.setRoles(['Chef']);

    // Route only allowed for admin, cashier, captain
    const route = createRouteSnapshot(['admin', 'cashier', 'captain']);
    const result = TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));

    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toBe('/tabs/kot');
  });
});

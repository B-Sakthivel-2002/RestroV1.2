import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { normalizeRole } from '../constants/role-permissions';

describe('Role-Based Tab Access (AuthService & Permissions)', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('normalizeRole', () => {
    it('should normalize uppercase, lowercase, and mixed-case roles', () => {
      expect(normalizeRole('ADMIN')).toBe('admin');
      expect(normalizeRole('Admin')).toBe('admin');
      expect(normalizeRole('cashier')).toBe('cashier');
      expect(normalizeRole('CASHIER')).toBe('cashier');
      expect(normalizeRole('Captain')).toBe('captain');
      expect(normalizeRole('CAPTAIN')).toBe('captain');
      expect(normalizeRole('captian')).toBe('captain'); // typo support
      expect(normalizeRole('Chef')).toBe('chef');
      expect(normalizeRole('CHEF')).toBe('chef');
      expect(normalizeRole('invalid_role')).toBeNull();
    });
  });

  describe('Admin Role', () => {
    beforeEach(() => {
      service.setRoles(['Admin']);
    });

    it('should grant access to all tabs', () => {
      expect(service.canAccessTab('kot')).toBeTrue();
      expect(service.canAccessTab('dinein')).toBeTrue();
      expect(service.canAccessTab('captain')).toBeTrue();
      expect(service.canAccessTab('orders')).toBeTrue();
      expect(service.canAccessTab('profile')).toBeTrue();
      expect(service.canAccessTab('logout')).toBeTrue();
    });

    it('should redirect Admin to /tabs/profile (Admin Dashboard)', () => {
      expect(service.getDefaultRouteForUser()).toBe('/tabs/profile');
    });
  });

  describe('Cashier Role', () => {
    beforeEach(() => {
      service.setRoles(['Cashier']);
    });

    it('should grant access to all tabs just like Admin', () => {
      expect(service.canAccessTab('kot')).toBeTrue();
      expect(service.canAccessTab('dinein')).toBeTrue();
      expect(service.canAccessTab('captain')).toBeTrue();
      expect(service.canAccessTab('orders')).toBeTrue();
      expect(service.canAccessTab('profile')).toBeTrue();
      expect(service.canAccessTab('logout')).toBeTrue();
    });

    it('should redirect Cashier to /tabs/dinein (Existing default page)', () => {
      expect(service.getDefaultRouteForUser()).toBe('/tabs/dinein');
    });
  });

  describe('Captain Role', () => {
    beforeEach(() => {
      service.setRoles(['Captain']);
    });

    it('should allow only DineIn, Captain, Orders, and Logout', () => {
      expect(service.canAccessTab('dinein')).toBeTrue();
      expect(service.canAccessTab('captain')).toBeTrue();
      expect(service.canAccessTab('orders')).toBeTrue();
      expect(service.canAccessTab('logout')).toBeTrue();
    });

    it('should hide KOT and Profile tabs', () => {
      expect(service.canAccessTab('kot')).toBeFalse();
      expect(service.canAccessTab('profile')).toBeFalse();
    });

    it('should redirect Captain to /tabs/captain', () => {
      expect(service.getDefaultRouteForUser()).toBe('/tabs/captain');
    });

    it('should support "Captian" spelling variation', () => {
      service.setRoles(['Captian']);
      expect(service.getPrimaryRole()).toBe('captain');
      expect(service.canAccessTab('captain')).toBeTrue();
      expect(service.canAccessTab('kot')).toBeFalse();
    });
  });

  describe('Chef Role', () => {
    beforeEach(() => {
      service.setRoles(['Chef']);
    });

    it('should allow only KOT, Orders, and Logout', () => {
      expect(service.canAccessTab('kot')).toBeTrue();
      expect(service.canAccessTab('orders')).toBeTrue();
      expect(service.canAccessTab('logout')).toBeTrue();
    });

    it('should hide DineIn, Captain, and Profile tabs', () => {
      expect(service.canAccessTab('dinein')).toBeFalse();
      expect(service.canAccessTab('captain')).toBeFalse();
      expect(service.canAccessTab('profile')).toBeFalse();
    });

    it('should redirect Chef to /tabs/kot', () => {
      expect(service.getDefaultRouteForUser()).toBe('/tabs/kot');
    });
  });
});

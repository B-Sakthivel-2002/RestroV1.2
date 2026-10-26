import { Injectable } from '@angular/core';
import { of, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private roles: string[] = [];

  constructor() {
    this.loadRoles(); // Load from LocalStorage on app start
  }

  loadRoles() {
    try{

        const storedRoles = localStorage.getItem('authRole');
        

        if (storedRoles) {
            const parsed = JSON.parse(storedRoles);
            if (Array.isArray(parsed)){
              this.roles = parsed;
              
            }else {
            
            this.roles = [];       // fallback
            }
        }

    } catch(error){
      this.roles =[];
      localStorage.removeItem('authRole');
      console.log(error,'<--error--->')
    }
  
        

      // try{
       
      // }catch(error){
      //    console.error('Invalid JSON in localStorage:', error);
      //    this.roles = [];
      // }     

      // this.roles = JSON.parse(storedRoles); // ✅ Convert back to array
      // console.log(' this.roles', this.roles);
   // }
  }

  setRoles(roles: string[]) {
    //this.roles = roles;
    if (Array.isArray(roles)) {
      this.roles = roles;
      // console.log('this.roles1',this.roles);
    } else {
      this.roles.push(roles);
      // console.log('this.roles2',this.roles);
    }
    localStorage.setItem('authRole', JSON.stringify(this.roles)); // ✅ Save in LocalStorage
  }

  setRolesToken(roles: string[], token: string, loginData?: any) {
    this.roles = [];
    if (Array.isArray(roles)) {
      this.roles = roles;
    } else {
      this.roles.push(roles);
    }
    localStorage.setItem('authRole', JSON.stringify(this.roles));
    localStorage.setItem('authToken', token);
    // Branch/outlet come from the login response (the API also scopes every request by the token).
    localStorage.setItem('branchid', String(loginData?.branchid || 1));
    localStorage.setItem('outletid', String(loginData?.outletid || 1));
    localStorage.setItem('branchname', loginData?.branchname || '');
    localStorage.setItem('outletname', loginData?.outletname || '');


    localStorage.removeItem('orderHistroy');
  }

  clearRolesToken(): Observable<boolean> {
    this.roles = [];

    localStorage.clear();
    // localStorage.removeItem('orderHistory');
    // localStorage.removeItem('authRole');
    // localStorage.removeItem('authToken');
    return of(true);
  }

  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.some((r) => this.roles.includes(r));
  }

  clearRoles() {
    this.roles = [];
    localStorage.removeItem('user_roles'); // ✅ Clear on logout
  }

  getRoles(): string[] {
    return this.roles;
  }

  getUserRole(): string {
       return this.roles[0] || '';
  }

  // SuperAdmin = outlet owner (all branches of the outlet); Admin = head of one branch.
  isOutletOwner(): boolean {
    return this.hasRole('SuperAdmin');
  }
}

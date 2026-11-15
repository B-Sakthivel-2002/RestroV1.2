import { Injectable, inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from "@angular/router";
import { StorageService } from "../services/storage.service";
import { Router } from "@angular/router";

@Injectable({
  providedIn:'root'
})
class UserToken {
    constructor(private storageService:StorageService){}

    getToken():boolean{
        const token = this.storageService.getItem('auth_token');
        if(token){
            return true;
        }else{
            return false;
        }
    }
}

@Injectable({
  providedIn:'root'
})
class PermissionsService {

  canActivate(currentUser: UserToken, _route: any): boolean {
    let validToken  = currentUser.getToken();
    return validToken;   
  }

  canMatch(currentUser: UserToken): boolean {
    return true;
  }
}
export const canActivateTeam: CanActivateFn = (  route: ActivatedRouteSnapshot,  state: RouterStateSnapshot,) => {
  return inject(PermissionsService).canActivate(inject(UserToken), route) ? true : inject(Router).navigate(['/']);
};
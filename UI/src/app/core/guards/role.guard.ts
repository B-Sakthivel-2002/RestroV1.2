import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, GuardResult, MaybeAsync, RouterStateSnapshot,Router } from "@angular/router";
import { AuthService } from "@appservices/auth.service";


@Injectable({providedIn:'root'})

export class RoleGuard implements CanActivate{


    constructor(private auth: AuthService, private router: Router) {}

     canActivate(route: ActivatedRouteSnapshot): boolean{

        const expectRoles = route.data['dataRoles'] as Array<string>;

        

        if(this.auth.hasAnyRole(expectRoles)){
            return true;
        }

        this.auth.clearRolesToken();

        this.router.navigate(['/']);
        return false;
        
    }
}
 


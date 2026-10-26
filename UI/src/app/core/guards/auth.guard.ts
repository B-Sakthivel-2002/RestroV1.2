import { Injectable,inject } from "@angular/core";
import { Router, CanActivateFn } from "@angular/router";
import { StorageService } from "@appservices/storage.service";



export const authGuard: CanActivateFn = () => {

  const storage = inject(StorageService);
  const router = inject(Router);
  const token = storage.getItem('authToken');

  //console.log(token,'---token--auth');

  if(!token){
    return true;
  }
  return router.createUrlTree(['/dashboard']);
  // return false;

}

export const afterLogged: CanActivateFn = () => {
  const storage = inject(StorageService);
  const router = inject(Router);

  const token = storage.getItem('authToken');

  if (token) {
    return true; // allow access
  }

  return router.createUrlTree(['/']); // redirect to main page
};


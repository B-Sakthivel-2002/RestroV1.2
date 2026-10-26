import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor() { }

  // Set a key-value pair in localStorage
  setItem(key: string, value: string): boolean {
    localStorage.setItem(key, value);
    return true;
  }

  // Get a value by key from localStorage
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  // Remove a key-value pair from localStorage
  removeItem(key: string): boolean {
    localStorage.removeItem(key);
    return true;
  }

  // Clear all localStorage
  clear(): boolean  {
    localStorage.clear();
    return true;
  }

  setOrderDetail(orderObject:any,flag:boolean):Observable<any>{

    let ordersArray: any[] = [];
    // Check if there's already an array in localStorage
    const stored = localStorage.getItem('orderHistroy');
    if (stored) {
      ordersArray = JSON.parse(stored);
    }

    let orderIndex = ordersArray.findIndex((x: any) => {
      return (
        x.typeId === orderObject.typeId &&
        x.tableId === orderObject.tableId &&
        x.floorId === orderObject.floorId
      );
    });

     if(orderIndex !=-1){
        if(flag){
          ordersArray[orderIndex] = orderObject;
        }else{
          //ordersArray[orderIndex] = orderObject;
          ordersArray.splice(orderIndex,1);
        }
     }else{
        ordersArray.push(orderObject);
     }
    // Add new object

    localStorage.setItem('orderHistroy',JSON.stringify(ordersArray));
    
    return of(true);
    //return true;
  }

  
 

  getOrderDetail(orderObject: any) : Observable<any> {

     let ordersArray: any[] = [];
     const stored = localStorage.getItem('orderHistroy');
     if (stored) {
      ordersArray = JSON.parse(stored);
     }

     let orderIndex = ordersArray.findIndex((x:any)=>{
      return(
          x.typeId === orderObject.typeId &&
          x.tableId === orderObject.tableId &&
          x.floorId === orderObject.floorId
      )
     })

      const result = orderIndex !== -1 ? ordersArray[orderIndex] : [];
      return of(result); // ✅ Return as observable
     //return ( orderIndex !=-1 ?   ordersArray[orderIndex] :[]);
    
  }

   

}


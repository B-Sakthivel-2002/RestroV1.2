import { Injectable, input } from '@angular/core';
import { catchError, from, Observable, of, tap,map, shareReplay } from 'rxjs';
import { captainMenuList, chefMenuList, menuList } from '../constants/Appsettings';
// import { AppSettings.apiUrl } from '../constants/Appsettings';

import {AppSettings} from '../constants/Appsettings';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ExtraChargeType,TableType } from '../constants/interface';

@Injectable({
  providedIn: 'root'
})
export class QueryService {

  constructor(private http:HttpClient,private auth:AuthService) { }

  private getCustomer$:any;
  private getFoodMenuList$:any;
private getDiscountsList$:any;
private getExtraChargesList$:any;
private getTaxList$:any;
private getOrderTypeList$:any;

private getFloorsList$:any ;
private activeFloorsList$:any ;
private branchDirectory$:any;

  // Cached lists belong to the logged-in user's branch; drop them whenever a (different) user logs in.
  clearCache(): void {
    this.getCustomer$ = undefined;
    this.getFoodMenuList$ = undefined;
    this.getDiscountsList$ = undefined;
    this.getExtraChargesList$ = undefined;
    this.getTaxList$ = undefined;
    this.getOrderTypeList$ = undefined;
    this.getFloorsList$ = undefined;
    this.activeFloorsList$ = undefined;
    this.branchDirectory$ = undefined;
  }

  // Branches the user may see (all branches of the outlet for an owner), cached for the session.
  getBranchDirectory(): Observable<any[]> {
    if (!this.branchDirectory$) {
      this.branchDirectory$ = this.http.get(AppSettings.apiUrl + 'Branches').pipe(
        map((res: any) => res?.data ?? []),
        catchError(() => of([])),
        shareReplay(1)
      );
    }
    return this.branchDirectory$;
  }

  // Master screens pass allBranches=true: an outlet owner then sees every branch of the outlet.
  // Without it the API returns only the user's own branch (what the order screen needs).
  private withScope(path: string, allBranches: boolean): string {
    return AppSettings.apiUrl + path + (allBranches ? '?allBranches=true' : '');
  }

  customHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
    });


  postCheckLogin(params:any):Observable<any>{

     console.log('postCHeckloign');

    let request ={
      username :  params.username,
      password: params.password
    }

    return this.http.post(AppSettings.apiUrl + 'auth/Login',request,{
           headers:this.customHeaders
    },).pipe(
      map((response :any)=> {
        // Handle the successful login response
        // Assume the token is part of the response object
        if (response.status=='Success') {

          this.clearCache();
          this.auth.setRolesToken(response.data.role,response.data.token,response.data)
          //localStorage.setItem('authToken', response.data.token);
        //  localStorage.setItem('authRole',response.data.role);
          //this.auth.setRoles(response.data.role);
        }
        return response;
      }),
      // Catch any errors during the request
      catchError((err:any)=>{
        throw err;
      })
    );
   // let response = checkLogin;
    //console.log(response);
   // return of(response);
  }

  getCategories(allBranches: boolean = false):Observable<any>{
   return this.http.get(this.withScope('Categories', allBranches)).pipe(
      tap((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err
      })
    )
   // return of(categoryList);
  }

  getOpenCloseDay():Observable<any>{
    return this.http.get(AppSettings.apiUrl+'WorkPeriod').pipe();
  }

  postOpenDay():Observable<any>{
    return this.http.post(AppSettings.apiUrl+'WorkPeriod/Open',{}).pipe();
  }
  
  postCloseDay(inputId:any):Observable<any>{
    return this.http.post(AppSettings.apiUrl+'WorkPeriod/Close/'+inputId,{}).pipe();
  }

    getSummary(businessDate: string): Observable<any> {
    return this.http.get(AppSettings.apiUrl+`/api/closing/summary?businessDate=${businessDate}`);
    }


    closeDay(payload: any): Observable<any> {
    return this.http.post(AppSettings.apiUrl+'/api/closing/close', payload);
    }

  getUserList():Observable<any>{
    return this.http.get(AppSettings.apiUrl+'user').pipe(
      tap((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err
      })
    )
  }


  getBranches():Observable<any>{
     return this.http.get(AppSettings.apiUrl+'Branches').pipe(
      map((res:any)=>{
        console.log(res,'Branch');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);       
      })
     )
  }

  createUsers(outputParams:any):Observable<any>{
    
    return this.http.post(AppSettings.apiUrl+'User',outputParams,{
           headers:this.customHeaders
    },
      ).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )

  }

  updateUsers(outputParams:any):Observable<any>{
    
    return this.http.post(AppSettings.apiUrl+'User/UpdateUser',outputParams,{
           headers:this.customHeaders
    },
      ).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )

  }

  updateRoles(outputParams:any):Observable<any>{
     return this.http.post(AppSettings.apiUrl+'User/AssignRole',outputParams,{
           headers:this.customHeaders
    },
      ).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
  }

  

  getCustomers(allBranches: boolean = false):Observable<any>{
    if (allBranches) {
      return this.http.get(this.withScope('Customers', true));
    }
    console.log(this.getCustomer$,'this.getCustomer$');
    if(!this.getCustomer$) {
      this.getCustomer$ = this.http.get(AppSettings.apiUrl+'Customers').pipe(
        shareReplay(1)
      );
    }
    return this.getCustomer$;

    //   return this.http.get(AppSettings.apiUrl+'Customers').pipe(
    //   tap((res:any)=>{
    //     return res;
    //   }),
    //   catchError((err:any)=>{
    //       throw err;
    //   })
    // )

  }

  getMenus(allBranches: boolean = false):Observable<any>{
    return this.http.get(this.withScope('Items', allBranches)).pipe(
      tap((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
          throw err;
      })
    )
  }

  getFoodMenuList():Observable<any>{

    if(!this.getFoodMenuList$){
      this.getFoodMenuList$ = this.http.get(AppSettings.apiUrl+'Restaurant/GetMenu').pipe(
        shareReplay(1)
      );
    }

    return this.getFoodMenuList$;

    // return this.http.get(AppSettings.apiUrl+'Restaurant/GetMenu').pipe(
    //   tap((res:any)=>{
    //     return res;
    //   }),
    //   catchError((err:any)=>{
    //     throw err;
    //   })
    // )

   // return of(restaurants);
  }


  getWaiters():Observable<any>{
   return this.http.get(AppSettings.apiUrl+'Waiter').pipe(
      tap((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;
      })
    )
    //return of(waiterList);
  }



  

  getDineIn():Observable<any>{
    console.log('dinein',AppSettings.apiUrl);   
    return this.http.get(AppSettings.apiUrl+'Floors').pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
   // return of(dinein);
  }


  getFloors():Observable<any>{
    console.log('dinein',AppSettings.apiUrl); 
    if(!this.getFloorsList$){
      this.getFloorsList$ = this.http.get(AppSettings.apiUrl+'Floors');
    }
    return  this.getFloorsList$;
  }

    getActiveFloors():Observable<any>{ 
      if(!this.activeFloorsList$){
        this.activeFloorsList$ = this.http.get(AppSettings.apiUrl+'Floors/GetActiveFloors').pipe(
          shareReplay(1)
        )
      }
      return this.activeFloorsList$;
    }

    clearTableCache(): void {
      this.getFloorsList$ = undefined;
      this.activeFloorsList$ = undefined;
    }

  getBranchList():Observable<any>{
    console.log('dinein',AppSettings.apiUrl);   
    return this.http.get(AppSettings.apiUrl+'Branches').pipe(
      map((res:any)=>{
        console.log(res,'Branch');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);       
      })
    )
   // return of(dinein);
  }

    getRoleList():Observable<any>{  
    return this.http.get(AppSettings.apiUrl+'Roles').pipe(
      map((res:any)=>{
        
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);       
      })
    )
   // return of(dinein);
  }

  getOrderForReport(paramObj:any):Observable<any>{

      
      return this.http.get(AppSettings.apiUrl+'Orders/GetOrdersForReport',{params:{
        fromDate: paramObj.fromDate.toString(),
        toDate: paramObj.toDate.toString(),
        status:paramObj.status,
        ordertypeid:paramObj.ordertypeid
      }}).pipe(
        map((res:any)=>{
          return  res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }

  getBillForReport(paramObj:any):Observable<any>{     
      return this.http.get(AppSettings.apiUrl+'Bill/GetBillOrderReport',{params:{
        fromDate: paramObj.fromDate.toString(),
        toDate: paramObj.toDate.toString(),
        orderType:paramObj.ordertype ? paramObj.ordertype :'',
        status:paramObj.status
      }}).pipe(
        map((res:any)=>{
          return  res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }


  getCaptainWiseReport(paramObj:any):Observable<any>{     
      return this.http.get(AppSettings.apiUrl+'Bill/GetCaptainWiseSalesReport',{params:{
        fromDate: paramObj.fromDate.toString(),
        toDate: paramObj.toDate.toString()
      }}).pipe(
        map((res:any)=>{
          return  res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }


    getCustomerWiseReport(paramObj:any):Observable<any>{     
      return this.http.get(AppSettings.apiUrl+'Bill/GetCustomerWiseReport',{params:{
        fromDate: paramObj.fromDate.toString(),
        toDate: paramObj.toDate.toString()
      }}).pipe(
        map((res:any)=>{
          return  res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }


      getPaymentWiseReport(paramObj:any):Observable<any>{     
      return this.http.get(AppSettings.apiUrl+'Bill/GetPaymentWiseReport',{params:{
        fromDate: paramObj.fromDate.toString(),
        toDate: paramObj.toDate.toString()
      }}).pipe(
        map((res:any)=>{
          return  res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }

        getComplementaryReport(paramObj:any):Observable<any>{     
      return this.http.get(AppSettings.apiUrl+'Bill/GetComplementaryReport',{params:{
        fromDate: paramObj.fromDate.toString(),
        toDate: paramObj.toDate.toString()
      }}).pipe(
        map((res:any)=>{
          return  res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }

  getShortBillForReport(paramObj:any):Observable<any>{

      
      return this.http.get(AppSettings.apiUrl+'Bill/GetBillOrderIdsReport',{params:{
        fromDate: paramObj.fromDate.toString(),
        toDate: paramObj.toDate.toString(),
        orderType:paramObj.ordertype ? paramObj.ordertype :'',
        status:paramObj.status
      }}).pipe(
        map((res:any)=>{
          return  res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }

  getOrderByType(id:any):Observable<any>{
    return this.http.get(AppSettings.apiUrl+'Orders/GetOrderByType',{ params:{
      ordertypeid:id
      }}).pipe(
        map((res:any)=>{
          return res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }

  // guest: undefined = every order of the table; '' or null = the first guest; a name = that guest (split bill).
  getOrderByTableId(id: any, guest?: string | null):Observable<any>{
    const params: any = { tableID: id };
    if (guest !== undefined) {
      params.byGuest = true;
      params.guest = guest ?? '';
    }
    return this.http.get(AppSettings.apiUrl+'Orders/GetOrderByTable',{params}).pipe(
      map((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;
      })
    )


  }


  addFloor(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Floors',outputParams,{
           headers:this.customHeaders
    },
      ).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
  }

  updateFloor(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Floors/UpdateFloor',outputParams,{
           headers:this.customHeaders
    },
      ).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
  }

  setOrderList(outputParams:any):Observable<any>{

    console.log(outputParams);
    return this.http.post(AppSettings.apiUrl+'Orders/CreateOrder',outputParams).pipe(
      map((res)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;
      })
    )
  }

  updateOrderList(outputParams:any):Observable<any>{

    console.log(outputParams);
    return this.http.post(AppSettings.apiUrl+'Orders/UpdateOrder',outputParams,{
      headers:this.customHeaders
    }).pipe(
      map((res)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;
      })
    )
  }

  setBillList(outputParams:any):Observable<any>{

    console.log(outputParams);
    return this.http.post(AppSettings.apiUrl+'Bill/CreateBill',outputParams).pipe(
      map((res)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;
      })
    )
  }

  

    updateBillList(outputParams:any):Observable<any>{

    console.log(outputParams);
    // return this.http.patch(`Bill/PatchBill/${billUpdate.billId}`, billUpdate);

    //  return this.http.post(AppSettings.apiUrl+'Bill/UpdateBill',outputParams).pipe(
    return this.http.post(AppSettings.apiUrl+'Bill/UpdateBill/',outputParams).pipe(
      map((res)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;
      })
    )
  }



  updateCategory(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Categories/UpdateCategory',outputParams,{      
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
  }

  addCategory(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Categories',outputParams,{      
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
  }


  addCustomer(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Customers',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
  }

  updateCustomer(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Customers/UpdateCustomer',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
  }

  addWaiter(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Waiter',outputParams,{
        headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }


  updateWaiter(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Waiter/UpdateWaiter',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }


  addMenu(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Items',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  updateMenu(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Items/UpdateItem',outputParams,{
     headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }
  

  addMenuType(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'MealType',outputParams,{
     headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }


  updateMenuType(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'MealType/UpdateMealType',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  
  
  
  addOrderType(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'OrderType',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  updateOrderType(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'OrderType/UpdateOrderType',outputParams,{
       headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }



  addTax(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Tax',outputParams,{      
      headers:this.customHeaders
    }).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  addExtraCharge(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Extracharge',outputParams,{      
      headers:this.customHeaders
    }).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

///taxid=${outputParams.taxid}
  updateTax(outputParams:any):Observable<any>{
    return this.http.post(AppSettings.apiUrl+'Tax/UpdateTax',outputParams,{      
      headers:this.customHeaders
    }).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }


  updateExtraCharge(outputParams:any):Observable<any>{
    return this.http.post(AppSettings.apiUrl+'Extracharge/UpdateExtracharge',outputParams,{      
      headers:this.customHeaders
    }).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  addTable(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Tables',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  updateTable(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Tables/UpdateTable',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  updateDiscount(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Discounts/UpdateDiscount',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  addDiscount(outputParams:any):Observable<any>{

    return this.http.post(AppSettings.apiUrl+'Discounts',outputParams,{
      headers:this.customHeaders
    }
      ).pipe(
      map((res:any)=>{
        //console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
       // return of(null);
       
      })
    )
  }

  getTax(useCache: boolean = true, allBranches: boolean = false):Observable<any>{
    if (allBranches) {
      return this.http.get(this.withScope('Tax', true));
    }
    if (useCache) {
      if(!this.getTaxList$){
        this.getTaxList$ = this.http.get(AppSettings.apiUrl+'Tax').pipe(
         shareReplay(1)
        );
      }
      return this.getTaxList$;   
    }

    return this.http.get(AppSettings.apiUrl+'Tax');
     
  }


  getExtraCharges(useCache: boolean = true, allBranches: boolean = false):Observable<ExtraChargeType[]>{
      if (allBranches) {
          return this.http.get<ExtraChargeType[]>(this.withScope('Extracharge', true));
      }
      if (useCache) {
          if(!this.getExtraChargesList$){
            this.getExtraChargesList$ = this.http.get<ExtraChargeType[]>(AppSettings.apiUrl+'Extracharge').pipe(
              shareReplay(1)
            );
          }

          return this.getExtraChargesList$;
      }
      return this.http.get<ExtraChargeType[]>(AppSettings.apiUrl+'Extracharge');   
  }

  getTable():Observable<any>{
    return this.http.get(AppSettings.apiUrl+'Tables').pipe(
      map((res:any)=>{
        return res;
      }),catchError((err:any)=>{
        throw err;
      })
    )
  }

  getDiscounts(useCache: boolean = true, allBranches: boolean = false):Observable<any>{
     if (allBranches) {
      return this.http.get(this.withScope('Discounts', true));
     }
     if (useCache) {
      if(!this.getDiscountsList$){
        this.getDiscountsList$ = this.http.get(AppSettings.apiUrl+'Discounts').pipe(
          shareReplay(1)
        );
      }
      return this.getDiscountsList$;
    }
    
    // Always fetch fresh data
    return this.http.get(AppSettings.apiUrl + 'Discounts');
  }


  

  getTables():Observable<TableType[]>{
    return(this.http.get<TableType[]>(AppSettings.apiUrl+'Tables'));   
  }

  getActiveTables():Observable<TableType[]>{
    return(this.http.get<TableType[]>(AppSettings.apiUrl+'Tables/GetActiveTables'));
  }

  // ---- Walk-in waitlist and table board (branchId: outlet owner only, others always get their own branch)

  private branchQuery(branchId?: number | null): string {
    return branchId ? '?branchId=' + branchId : '';
  }

  getWaitlist(branchId?: number | null): Observable<any> {
    return this.http.get(AppSettings.apiUrl + 'Waitlist' + this.branchQuery(branchId));
  }

  createWaitlistToken(input: { customerName: string, mobile: string, email?: string | null, guests: number, notes?: string | null, branchId?: number | null }): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Waitlist', input);
  }

  suggestWaitlistTable(tokenId: number): Observable<any> {
    return this.http.get(AppSettings.apiUrl + 'Waitlist/' + tokenId + '/Suggest');
  }

  // tableId null = the system picks the smallest free table that fits.
  assignWaitlistToken(tokenId: number, tableId: number | null): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Waitlist/' + tokenId + '/Assign', { tableId });
  }

  seatWaitlistToken(tokenId: number, tableId: number | null = null): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Waitlist/' + tokenId + '/Seat', { tableId });
  }

  cancelWaitlistToken(tokenId: number): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Waitlist/' + tokenId + '/Cancel', {});
  }

  noShowWaitlistToken(tokenId: number): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Waitlist/' + tokenId + '/NoShow', {});
  }

  getTableBoard(branchId?: number | null): Observable<any> {
    return this.http.get(AppSettings.apiUrl + 'Tables/Board' + this.branchQuery(branchId));
  }

  // state: Available | Cleaning | Blocked | Reserved
  setTableState(tableId: number, state: string, notes?: string): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Tables/' + tableId + '/State', { state, notes });
  }

  getTableHistory(tableId: number): Observable<any> {
    return this.http.get(AppSettings.apiUrl + 'Tables/' + tableId + '/History');
  }

  // ---- Kitchens (each with its own KOT printer)

  getKitchens(allBranches: boolean = false): Observable<any> {
    return this.http.get(this.withScope('Kitchens', allBranches));
  }

  addKitchen(input: any): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Kitchens', input);
  }

  updateKitchen(input: any): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Kitchens/UpdateKitchen', input);
  }

  deleteKitchen(id: number): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Kitchens/DeleteKitchen/' + id, {});
  }

  // Printers installed on the API computer.
  getInstalledPrinters(): Observable<any> {
    return this.http.get(AppSettings.apiUrl + 'Kitchens/Printers');
  }

  testKitchenPrinter(id: number): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Kitchens/' + id + '/TestPrint', {});
  }

  // kitchenId: undefined = every kitchen of the order.
  reprintKot(orderId: number, kitchenId?: number): Observable<any> {
    const params: any = kitchenId !== undefined ? { kitchenId } : {};
    return this.http.post(AppSettings.apiUrl + 'Orders/' + orderId + '/ReprintKOT', {}, { params });
  }

  // ---- Table transfer / merge and split bill

  // orderIds empty = every open order of the table.
  transferTable(fromTableId: number, toTableId: number, orderIds: number[] = []): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Tables/Transfer', { fromTableId, toTableId, orderIds });
  }

  mergeTables(targetTableId: number, sourceTableIds: number[]): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Tables/Merge', { targetTableId, sourceTableIds });
  }

  unmergeTable(tableId: number): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Tables/' + tableId + '/Unmerge', {});
  }

  // Guests with open orders on a table: [{ guestlabel (null = first guest), orders, total, printed }].
  getTableGuests(tableId: any): Observable<any> {
    return this.http.get(AppSettings.apiUrl + 'Orders/TableGuests', { params: { tableId } });
  }

  // guestLabel '' = the first guest.
  splitOrderItems(tableId: number, guestLabel: string, items: { orderDetailId: number, qty: number }[]): Observable<any> {
    return this.http.post(AppSettings.apiUrl + 'Orders/Split', { tableId, guestLabel, items });
  }

  getMenuTypes(allBranches: boolean = false):Observable<any>{
    return this.http.get(this.withScope('MealType', allBranches)).pipe(
      map((res:any)=>{
        return res;
      }),catchError((err:any)=>{
        throw err;
      })
    )
  }

  getOrderTypes():Observable<any>{

    if(!this.getOrderTypeList$){
      this.getOrderTypeList$ = this.http.get(AppSettings.apiUrl+'OrderType').pipe(
        shareReplay(1)
      );
    }
    return this.getOrderTypeList$;   
  }

  deleteFloor(floorId:Number):Observable<any>{
    console.log('dinein',AppSettings.apiUrl);   
    return this.http.post(AppSettings.apiUrl+'Floors/DeleteFloor/'+floorId,null).pipe(
      map((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;       
      })
    )
  }


    deleteUser(userId:Number):Observable<any>{
   // console.log('dinein',AppSettings.apiUrl);   
    return this.http.post(AppSettings.apiUrl+'User/DeleteUser/'+userId,null).pipe(
      map((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;       
      })
    )
  }


 deleteRole(userId:Number):Observable<any>{
   // console.log('dinein',AppSettings.apiUrl);   
    return this.http.post(AppSettings.apiUrl+'User/DeleteAssingedRole/'+userId,null).pipe(
      map((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;       
      })
    )
  }


  // deleteOrder(inputPost:any):Observable<any>{
  //   console.log(inputPost,'inputPost');
  //   return this.http.post(AppSettings.apiUrl+'Orders/DeleteOrderById/'+inputPost.id,{
  //        orderId: inputPost.id,
  //     comments: inputPost.comments,
  //     complementary:  inputPost.complementary
  //   });

  // }

  deleteOrder(inputPost: any): Observable<any> {
  return this.http.post(AppSettings.apiUrl + 'Orders/CancelOrder',
    {
      orderId: inputPost.id,
      comments: inputPost.comments,
      complementary: inputPost.complementary
    }
  );
}


  deleteTable(tableId:Number):Observable<any>{
    console.log('dinein',AppSettings.apiUrl);   
    return this.http.post(AppSettings.apiUrl+'Tables/DeleteTable/'+tableId,null).pipe(
      map((res:any)=>{
        return res;
      }),
      catchError((err:any)=>{
        throw err;       
      })
    )
  }

  deleteTax(id:Number):Observable<any>{
    console.log('dinein',AppSettings.apiUrl);   
    return this.http.post(AppSettings.apiUrl+'Tax/DeleteTax/'+id,null).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
   // return of(dinein);
  }


    deleteExtraCharge(id:Number):Observable<any>{
    console.log('dinein',AppSettings.apiUrl);   
    return this.http.post(AppSettings.apiUrl+'Extracharge/DeleteExtracharges/'+id,null).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
   // return of(dinein);
  }

  deleteDiscount(id:Number):Observable<any>{
    console.log('dinein',AppSettings.apiUrl);   
    return this.http.post(AppSettings.apiUrl+'Discounts/DeleteDiscount/'+id,null).pipe(
      map((res:any)=>{
        console.log(res,'dinein');    
        //return of(res.data);
        return res;
      }),
      catchError((err:any)=>{
        throw err;
        return of(null);
       
      })
    )
   // return of(dinein);
  }
  

  deletecategory(id:Number):Observable<any>{ 
    return this.http.post(AppSettings.apiUrl+'Categories/DeleteCategory/'+id,null).pipe(
      map((res:any)=>{
        console.log(res,'categories');    
        return res;
      }),
      catchError((err:any)=>{
        throw err;  
      })
    )
  }

  deletMenuType(id:Number):Observable<any>{ 
    return this.http.post(AppSettings.apiUrl+'MealType/DeleteMealType/'+id,null).pipe(
      map((res:any)=>{
        console.log(res,'categories');    
        return res;
      }),
      catchError((err:any)=>{
        throw err;  
      })
    )
  }

  deletOrderType(id:Number):Observable<any>{ 
    return this.http.post(AppSettings.apiUrl+'OrderType/DeleteOrderType/'+id,null).pipe(
      map((res:any)=>{        
        return res;
      }),
      catchError((err:any)=>{
        throw err;  
      })
    )
  }

  

  deleteWaiter(id:Number):Observable<any>{ 
    return this.http.post(AppSettings.apiUrl+'Waiter/DeleteWaiter/'+id,null).pipe(
      map((res:any)=>{
        //console.log(res,'categories');    
        return res;
      }),
      catchError((err:any)=>{
        throw err;  
      })
    )
  }


  deleteMenu(id:Number):Observable<any>{ 
    return this.http.post(AppSettings.apiUrl+'Items/DeleteItem/'+id,null).pipe(
      map((res:any)=>{
        //console.log(res,'categories');    
        return res;
      }),
      catchError((err:any)=>{
        throw err;  
      })
    )
  }
  

  

  deleteCustomer(id:Number):Observable<any>{ 
    return this.http.post(AppSettings.apiUrl+'Customers/DeleteCustomer/'+id,null).pipe(
      map((res:any)=>{
        console.log(res,'categories');    
        return res;
      }),
      catchError((err:any)=>{
        throw err;  
      })
    )
  }
  
  getMenuList(type:string):Observable<any>{
    switch(type){
      case 'Admin':
      case 'SuperAdmin':
        return of(menuList);
      case 'Chef':
        return of(chefMenuList); 
      case 'Captain':
        return of( captainMenuList);
      default:
        return of(chefMenuList);
    }
    // this.http.get(AppSettings.apiUrl+'/').pipe(
    //   map((res:any)=>{

    //   }),
    //   catchError((err:any)=>{
    //     throw err;
    //   })
    // )
    return of(menuList);
  }

  


  postCategoryList(inputParams:{CategoryName:string,IsActive:boolean}):Observable<any>{
    this.http.post(AppSettings.apiUrl+'/',inputParams).pipe(
      tap((res:any)=>{

      }),
      catchError((err:any)=>{
        throw err
      })
    )

    let data ={
      status:"success",
      message:"successfully submitted"
    }

    return of(data);
  }

  // getProductList():Observable<any>{
  //   this.http.get(AppSettings.apiUrl+'/').pipe(
  //     tap((res:any)=>{

  //     }),
  //     catchError((err:any)=>{
  //       throw err
  //     })
  //   )
  //   return of(productList);
  // }
  
  postProductList(inputParams:{CategoryName:string,IsActive:boolean}):Observable<any>{
    this.http.post(AppSettings.apiUrl+'/',inputParams).pipe(
      tap((res:any)=>{

      }),
      catchError((err:any)=>{
        throw err
      })
    )

    let data ={
      status:"success",
      message:"successfully submitted"
    }

    return of(data);
  }
updateKOTItemStatus(payload: {
  orderDetailId: number;
  kotStatus: string;
}): Observable<any> {

  // the API takes a list of items (List<UpdateKOTItemStatusModel>), so send a one-item array
  this.http.post(AppSettings.apiUrl + 'Orders/UpdateKOTItemStatus', [payload]).pipe(
    tap((res: any) => {
      // optional
    }),
    catchError((err: any) => {
      throw err;
    })
  ).subscribe();

  let data = {
    status: "success",
    message: "Item marked as Ready to Serve"
  };

  return of(data);
}
  GetOrdersForKOTReport(paramObj:any):Observable<any>{

      
      return this.http.get(AppSettings.apiUrl+'Orders/GetOrdersForKOTReport',{params:{
        fromDate: paramObj.fromDate.toString(),
        toDate: paramObj.toDate.toString(),
        status:paramObj.status,
        ordertypeid:paramObj.ordertypeid
      }}).pipe(
        map((res:any)=>{
          return  res;
        }),
        catchError((err:any)=>{
          throw err;
        })
      )
  }

}

import { ChangeDetectorRef, Component, Input, input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { FormsModule } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { debounceTime, finalize, Observable } from 'rxjs';
import { AlertService } from '@appservices/alert.service';
import { StateService } from '@appservices/state.service';
import { ActivatedRoute, Router } from '@angular/router';
import { KotSignalrService } from '@appservices/kot-signalr.service';
import { TooltipModule } from 'ngx-bootstrap/tooltip';

@Component({
  selector: 'app-kot-list',
  standalone: true,
  imports: [CommonModule,FormsModule,TooltipModule],  
   providers:[BsModalService,AlertService],
   template: `
     <div class="wrapper">
       <div class="right-side">
          <div class="wrapper">
             <div class="right-side">
               <div class="sub-header al-sub-header">
                   <div class="tt">
                     <h2 class="mn-tt">Orders</h2>
                   </div>  
                   <div class="btn-bg spl-bg">
                      <div class="fl-col">
                          <div class="form-bg">
                            <label></label>                         
                          </div>
                      </div>

                       <div class="fl-col" style="display:none">
                         <div class="form-bg">
                           <label>From Date:</label>
                           <input type="date"  class="form-ctrl" [(ngModel)]="inputFromDate"  required (ngModelChange)="onInputDateValid()"  [attr.max]="todayStr" [ngClass]="dateInvalid ? 'valid-error' :''" />
                         </div>
                         <div class="form-bg">
                           <label>To Date:</label>
                           <input type="date" class="form-ctrl" [(ngModel)]="inputToDate" required (ngModelChange)="onInputDateValid()" [attr.max]="todayStr" [ngClass]="dateInvalid ? 'valid-error' :''" />
                         </div>
                         <div class="form-bg" >
                           <label>Type</label>
                           <select class="form-ctrl" [(ngModel)]="inputType" (ngModelChange)="onOrderTypeChange(inputType)">
                                 @for(ot of orderTypeList; track ot.ordertypeid ){                               
                                     <option [value]="ot.ordertypeid">{{ot.ordertypename}}</option>                             
                                 }
                           </select>
                         </div>
                         <div class="form-bg" >
                           <label>Status</label>
                           <select class="form-ctrl" (ngModelChange)="onStatusChange(inputStatus)" [(ngModel)]="inputStatus">
                               <option value="approved">Closed</option>
                               <option value="submitted">Submitted</option>
                               <option value="canceled">Cancelled</option>
                           </select>
                         </div>         
                         
                        
 
                         <button type="button" class="btn btn-primary" (click)="getOrderReport()" [disabled]="dateInvalid">Submit</button> 
                       </div>     
                       <div class="fl-col">
                         <div *ngIf="dateInvalid" class="error-txt">
                           From date should be before or equal to To date
                         </div>  
                       </div>   
                   </div>  
                    <br>       
               </div>
               <div class="cnt">
                 <div class="kot-tab-bg">
                  <ul  id="pills-tab" role="tablist" class="nav nav-pills">
                    <li role="presentation" class="nav-item">
                      <button (click)="getAllReport('submitted')" data-bs-toggle="pill" type="button" role="tab" aria-selected="true" class="active nav-link" id="floors-1-tab" data-bs-target="#floors-1" aria-controls="floors-1">In Progress</button>
                    </li>
                    <li role="presentation" class="nav-item">
                      <button (click)="getAllReport('approved')" data-bs-toggle="pill" type="button" role="tab" aria-selected="false" class="nav-link" id="floors-2-tab" data-bs-target="#floors-2" aria-controls="floors-2" tabindex="0">Completed</button>
                    </li>
                    <li role="presentation" class="nav-item">
                      <button (click)="getAllReport('cancelled')" data-bs-toggle="pill" type="button" role="tab" aria-selected="false" class="nav-link" id="floors-3-tab" data-bs-target="#floors-3" aria-controls="floors-3" tabindex="1">Cancelled</button></li></ul>
                </div>                
                <div class="kot-cnt-bg1 kot-container"> 
                  <!-- {{orderList | json}} -->
                  
                   @for(bl of orderList; track bl.orderid; let bindex = $index){

                    <!-- {{bl | json}} -->
                    <div class="kot-ls-bg1 kot-card ">
                      <div class="sb-tt kot-hd-txt">
                        <span>Captain : {{bl.waiter}}</span>
                        <span class="sb-badge">Id : {{bl.orderid}} </span>
                      </div>
                    
                        <div class="sb-tt"> 
                           
                            <div class="sb-cnt">
                              <div>
                                 <span class="spl-tt">Date: {{bl.businessdate | date :'dd-MM-YYYY'}} </span>
                                 <span class="spl-tt">Duration: <span class="bl-hgt">{{getTimeAgo(bl.businessdate)}}</span> </span>
                                
                              </div>
                              <div>
                                  <span class="spl-tt"> Status : {{getStatus(bl.status)}}</span>
                                   <span class="spl-tt"> Type : {{bl.orderTypeName}}</span>
                                   @if(bl.comments){
                                    <button
                                      type="button"
                                      class="btn btn-secondary kot-comments"
                                      [tooltip]="bl.comments"
                                       [adaptivePosition]="true"
                                      placement="right">
                                      Comments  <i class="pi pi-arrow-down"></i>
                                    </button>
                                    <!-- <button type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-placement="top" [attr.data-bs-title]="bl.comments">Comments</button> -->
                                   }
                                    
                                  <!-- <span class="spl-tt">Status: {{bl.status =='submitted' ? 'In Progress':bl.status =='approved' ? 'Closed' :'Cancelled'}}</span> -->
                              </div>
                              
                              
                            </div>
                        </div>
                        <!-- <div class="dt-bg">   
                        </div> -->
                        <div>
                          <div class="sb-tt-bg">
                            <div class="cs-tb-gd">
                              <div class="cs-tb-hd">
                                  <div class="lft">Id</div>
                                  <div class="ct">Name</div>
                                  <div class="rgt">Quantity</div>
                              </div>
                              <!-- .slice(0, bl.visiblecount) -->
                              @for (ls of bl.orderdetails; track ls.orderdetailid; let localInd = $index) {
                                 <!-- {{ls | json}} -->
                                 <!-- (click)="onSelectItem(bl, ls, $event)" -->  
                                   <!-- statusClass[ls.kotStatus] || '';(ls) -->
                          <div class="cs-tb-body" [ngClass]="bl.status==='submitted' ? statusClass[ls.kotStatus] || '' :''" >
                            <div class="lft">                             
                              {{ ls.orderdetailid }}
                            </div>
                            <div class="ct">{{ ls.itemName }}</div>
                            <div class="rgt">
                                {{ ls.qty }}
                               @if (ls.kotStatus === 'readytoserve' && isCaptain) {
                                  <button
                                    class="btn btn-warning btn-sm" title="Picked up"
                                    (click)="onClickServe(bindex, localInd, 'pickup')">
                                    <i class="pi pi-crown"></i>
                                  </button>
                                }
                                @else if (!ls.kotStatus  &&  !isCaptain) {
                                  <button
                                    class="btn btn-primary btn-sm"
                                    (click)="onClickServe(bindex, localInd, 'serve')">
                                    <i class="pi pi-verified"></i>
                                  </button>
                                }

                            </div>
                          </div>

                  }

                   
                            </div>
                              
                          </div>
                         
                        </div>

                        
                                                    
                    </div>
                   }@empty {
                      <div class="no-data">
                        No data found 😕
                      </div>
                    }

                 </div>
                
                
               </div>              
             </div>
         </div>
       </div>
     </div> 
          <!-- <ng-template #orderFloorTemplate>
        <div class="modal-header">
          <h4 class="modal-title custom-modal-title pull-left">Order Id: {{orderLocalDetail.orderid}}  <span>Date : {{orderLocalDetail.businessdate | date :'dd-MM-yyyy'}}</span></h4>
          <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="orderFloorModalRef?.hide();">
            <span aria-hidden="true" class="visually-hidden">&times;</span>
          </button>
        </div>
        <div class="modal-body">
 
                <div class="cnt-scrl">
                
                 @if(orderLocalDetail){
                   <table class="table custom-table table-bordered spl-table">
                       <thead>
                         <tr>
                           <th>Menu Name</th>
                           <th>Price</th>
                           <th>Qty</th>
                           <th></th>
                            <th>Total Price</th>
                         </tr>
                       </thead>
                       <tbody>                
                          @for(bl of orderLocalDetail?.orderdetail; track bl.orderdetailid; let ind= $index){
                           <tr>
                             <td>{{bl.name}}</td>
                             <td>({{bl.price}})</td>
                             <td>{{bl.qty}}</td>
                             <td>
                             <input
                              type="number"
                              min="1"
                              max="100"
                              step="1"
                              class="form-control"
                              inputmode="numeric"
                              (keydown)="blockTyping($event)"
                              (wheel)="$event.preventDefault()"
                              [(ngModel)]="orderLocalDetail.orderdetail[ind].qty"
                              (ngModelChange)="onQtyChange(ind)"
                            >
                             </td>
                             <td>{{bl.sumofprice}}</td>
                             <td><button (click)="onPartialDelete(ind)" class="btn btn-primary">x</button></td>
                           </tr> 
                           }    
                           <tr>                            
                             <td colspan="3" class="text-right"><b>Total :</b></td>
                             <td>{{orderLocalDetail.totalprice}}</td>
                           </tr> 
                          
                           @if(orderDetailStatus!='edit'){
                           <tr>
                             <td colspan="4">
                               <h4 class="sb-tt">Comments</h4>
                               <textarea class="form-control" [(ngModel)]="inputComments"></textarea>
                             </td>
                           </tr>
                           }
                       </tbody>
                     </table>
                 }@else{
                   No data found
                 }
                      
               </div>
         
        </div>
        <div class="modal-footer"  >
 
            @if(orderDetailStatus=='cancel'){
                <button type="submit" class="btn btn-danger" (click)="onDeleteOrder(orderLocalDetail.orderid)" [disabled]="!inputComments ? true : false">Cancel</button>   
            } @else if(orderDetailStatus=='edit'){
             <button type="submit"  class="btn btn-primary" (click)="onEditOrder(orderLocalDetail.orderid)">Edit</button>    
            }
           <button type="reset" class="btn btn-primary" (click)="onResetOrder()"> Reset</button>
           <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="orderFloorModalRef?.hide()">Close</button>
         </div>
      </ng-template> -->
   `,
   styles: ``
})
export class KotListComponent {
orderList:Array<any>=[];

  inputFromDate: string ='';
  inputToDate: string='';
  orderFloorForm:any=[];
  orderDetail:any='';
  orderDetailStatus:any='';
  orderLocalDetail:any='';
  orderTypeList:Array<any>=[];
  todayStr: string = ''; // formatted yyyy-MM-dd
  inputComments:string ='';
  inputComplementary:boolean = false;
  visibleCount:number = 3;

  orderFloorModalRef?:BsModalRef;

  inputStatus:any ='submitted';
  inputType:any =0;
  dateInvalid:boolean = false;
  isCaptain :boolean = false;

  // @Input('inputIsCaptain') inputIsCaptain:boolean = false;

  inputIsCaptain = input<boolean>(false);

  ngOnInit(): void {
      const today = new Date();
      this.todayStr = today.toISOString().split('T')[0]; // 'yyyy-MM-dd'
      this.inputFromDate = this.formatDate(today);
      this.inputToDate = this.formatDate(today);
  //  this.getorderTypeList();
    this.getOrderInit();  

    this.route.params.subscribe((params:any)=>{
       
        this.isCaptain = params['type']==='captain'  ? true : false;
    })

    if(this.inputIsCaptain()){
      this.isCaptain = true;
    }

    //     this.signalR.startConnection();
    // this.signalR.onOrderUpdated((orderId:number) => {
    // //  this.getOrderReport();  
    // });
  }

  constructor(private route:ActivatedRoute,private stateService: StateService ,private changeDetectRef: ChangeDetectorRef,private alertService:AlertService,private query:QueryService,private modalService:BsModalService, private signalR: KotSignalrService){}

  formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}
debounceTimer: any;

blockTyping(event: KeyboardEvent) {
  const allowedKeys = [
    'ArrowUp',
    'ArrowDown',
    'Tab',
    'Shift',
    'Control'
  ];

  if (!allowedKeys.includes(event.key)) {
    event.preventDefault();
  }
}

// onLoadMore(blIndex:number,blLength:number){


//   this.orderList[blIndex].visiblecount = blLength;
//   this.changeDetectRef.detectChanges();

// }

onLoadMore(index: number) {
  const bl = this.orderList[index];

  bl.visiblecount =
    bl.visiblecount < bl.orderdetail.length
      ? bl.orderdetail.length
      : this.visibleCount;
}



getStatus(status:string){
  return status =='submitted' ? 'In Progress' : status ==='approved' ? 'Closed' : status ==='cancelled' ? 'Cancelled':''
}

onClickServe(baseIndex:number,subIndex:number,type:string='serve'){

  let status = type==='serve' ? 'readytoserve' : 'submitted';



  //return ;
  if(type=='serve'){
    this.orderList[baseIndex].orderdetails[subIndex].kotStatus = 'readytoserve';
  }else if(type=='pickup'){
  
    
    this.orderList[baseIndex].orderdetails[subIndex].kotStatus = 'submitted';
  }
  
  this.onReadyToServe(this.orderList[baseIndex].orderdetails[subIndex].orderdetailid,status);
  

  // this.orderList?.orderdetail[localIndex]

  // })
  

}

onQtyChange(index: number) {
  let qty = Number(this.orderLocalDetail.orderdetail[index].qty);

  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > 100) qty = 100;

  this.orderLocalDetail.orderdetail[index].qty = qty;
  this.updateOrderDetail();
}

onInputDateValid(){
    if (new Date(this.inputFromDate) > new Date(this.inputToDate)) {
      this.dateInvalid = true;
      this.changeDetectRef.detectChanges();
    } else {
      this.dateInvalid = false;    
    }
}


updateOrderDetail(){
  let total = 0;
  let orderdetail = [];
  //this.orderLocalDetail.totalprice = 0;
  orderdetail = this.orderLocalDetail.orderdetail.filter((x:any)=>{   
        x.sumofprice = (x.price * x.qty);
        total += x.sumofprice;
        return x;
  })

  this.orderLocalDetail = {
    ...this.orderLocalDetail,
   orderdetail,
    totalprice:total.toFixed(2)
  };
  this.changeDetectRef.detectChanges();
  // this.orderLocalDetail.totalprice = this.orderLocalDetail.totalprice.toFixed(2);

}

onResetOrder(){
  this.orderLocalDetail = structuredClone(this.orderDetail);
}

  openModal(template: TemplateRef<void>,inputOrderDetail:any,status:string) {
    this.orderDetail ='';
    this.orderLocalDetail ='';
    this.orderDetailStatus =  status;
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.orderFloorModalRef = this.modalService.show(template);
    
   this.orderDetail = inputOrderDetail;
    this.orderLocalDetail = structuredClone(this.orderDetail);
  //  this.orderLocalDetail = {...inputOrderDetail};
  }

  onStatusChange(newValue: string) {
    this.inputStatus = newValue;
    

    //  clearTimeout(this.debounceTimer);

    //  this.debounceTimer = setTimeout(()=>{
    //   this.getOrderReport();
    //  },200);    
    
    // Handle logic here based on selected value
  }

  onPartialDelete(inputIndex:number){
  
    if(this.orderLocalDetail.orderdetail.length !=1){
      this.orderLocalDetail.totalprice =  (this.orderLocalDetail.totalprice  - this.orderLocalDetail.orderdetail[inputIndex].price).toFixed(2); 
      this.orderLocalDetail.orderdetail.splice(inputIndex,1);
      this.changeDetectRef.detectChanges();
    }   
    // inputOrderDetail;
  }


  onOrderTypeChange(newValue:string){
    this.inputType = newValue;
  }

  getOrderInit(){
    this.getOrderReport();
  }


  getTimeAgo(dateString: string): string {
    const inputDate = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - inputDate.getTime(); // in milliseconds

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `Just now`;
}


getAllReport(status:string){  
  this.inputStatus = status;
  this.getOrderReport();
  
}

  getOrderReport(){
    
   this.stateService.setLoadingState(true);

    
    let convertFromDate = this.inputFromDate;
    let convertToDate = this.inputToDate;
    
    let getObject = {
      fromDate:convertFromDate,
      toDate:convertToDate,
      status : this.inputStatus,
      ordertypeid:this.inputType
    }

 this.query.GetOrdersForKOTReport(getObject).subscribe({
  next: (res: any) => {



    this.orderList =[{}];

    this.orderList = res.data?.map((item: any) => ({
           
      ...item,
      visiblecount: 3,      
      // Normalize API response to match your existing template
      orderdetail: (item.orderdetails || []).map((d: any) => (
        {
        orderdetailid: d.orderdetailid,
        qty: d.qty,
        price: d.price,
        kotStatus: d.kotStatus,
        name: d.itemName,  // map itemName to name
        sumofprice: d.sumofprice
        })
      )

    })) || [];


    //added by Sakthivel Starts
//  if (this.inputStatus === 'submitted') {
//     // Show Pending Orders
//     this.orderList = this.orderList.filter(
//       o => o.orderStatus === 'Pending'
//     );
//   }
//   else if (this.inputStatus === 'approved') {
//     // Show Completed Orders
//     this.orderList = this.orderList.filter(
//       o => o.orderStatus === 'Completed'
//     );
//   }
//   else if (this.inputStatus === 'cancelled') {
//     this.orderList = this.orderList.filter(
//       o => o.status?.toLowerCase() === 'cancelled'
//     );
//   }
    //added by Sakthivel Ends
  
    
    this.changeDetectRef.detectChanges();
    this.stateService.setLoadingState(false);
  },
  error: (err: any) => {
    this.stateService.setLoadingState(false);
  }
});

  }


  onEditOrder(inputOrder:any){

    this.stateService.setLoadingState(true);
    this.query.updateOrderList(this.orderLocalDetail).pipe(
      finalize(()=>{
         this.stateService.setLoadingState(false);
           this.changeDetectRef.detectChanges();
      })
    )
    .subscribe({
      next:((res:any)=>{  
        this.alertService.showAlert('Updated !','Order has been updated');
        this.getOrderReport();
         this.orderFloorModalRef?.hide();
      }),
      error:((err:any)=>{        
          this.alertService.showAlert('Error !',err?.error || 'Something went wrong');
      })
    })
  }

  // ---------- ITEM SELECTION ----------
onSelectItem(order: any, item: any, event: any) {

  
  return;
  if (event instanceof MouseEvent && event.ctrlKey) {
    item.isSelected = !item.isSelected;
  } else if (event.target && event.target.type === 'checkbox') {
    item.isSelected = event.target.checked;
  } else {
    order.orderdetail.forEach((x: any) => x.isSelected = false);
    item.isSelected = true;
  }

  this.changeDetectRef.detectChanges();
}

toggleItemSelection(order: any, item: any) {
  // Toggle selection
  item.isSelected = !item.isSelected;
  // If single selection mode, deselect others
  order.orderdetails.forEach((x: any) => {
    if (x !== item) x.isSelected = false;
  });
  this.changeDetectRef.detectChanges();
}


// ---------- CHECK IF ITEM SELECTED ----------
hasSelectedItem(order: any): boolean {
  
  return order.orderdetails.some((x: any) => x.isSelected);
}

statusClass:{[key:string]:string} = {
  readytoserve: 'kot-row-read',
  submitted: 'kot-row-pickedup'
};

// ---------- ROW COLOR ----------
getItemRowClass(item: any) {
 
  if (item.kotStatus === 'readytoserve') return 'kot-row-ready';
   if (item.kotStatus === 'submitted') return 'kot-row-pickedup';
  if (item.isSelected) return 'kot-row-selected';
  return 'kot-row-pending';
}

getKOTColor(kotStatus: string | null): string {
  switch(kotStatus) {
    case 'readytoserve': return 'green';
    case 'inprogress': return 'orange';
    case 'cancelled': return 'red';
    default: return 'grey'; // for null or unknown
  }
}




onReadyToServe(inputOrderDetailId: number,inputStatus:string) {

  // const selectedItem = order.orderdetails.find(
  //   (x: any) => x.isSelected
  // );
  // if (!selectedItem) return;

  const payload = {
    orderDetailId: inputOrderDetailId,
    kotStatus: inputStatus
  };

  this.stateService.setLoadingState(true);
//  debounceTime(300),
  this.query.updateKOTItemStatus(payload).subscribe({
    next: () => {
      //    selectedItem.kotStatus = 'readytoserve';
      // selectedItem.isSelected = false;
    //  this.alertService.showAlert('Success', 'Item marked Ready to Serve');

      // Optional: refresh the order list from server to keep data in sync
      
     // this.getOrderReport();
       this.changeDetectRef.detectChanges();
       this.stateService.setLoadingState(false);

    },
    error: () => {
      this.alertService.showAlert('Error', 'Failed to update item');
    }
  });
}

}

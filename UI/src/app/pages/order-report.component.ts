import { ChangeDetectorRef, Component, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { FormsModule } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { debounceTime, finalize } from 'rxjs';
import { AlertService } from '@appservices/alert.service';
import { StateService } from '@appservices/state.service';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-order-report',
  standalone: true,
  imports: [CommonModule,FormsModule],  
  providers:[BsModalService,AlertService],
  template: `
    <div class="wrapper">
      <div class="right-side">
         <div class="wrapper">
            <div class="right-side">
              <div class="sub-header al-sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Order Report</h2>
                  </div>  
                  <div class="btn-bg spl-bg">
                      <div class="fl-col">
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
                                <option value="all">All</option>  
                              <option value="approved">Closed</option>
                              <option value="submitted">Submitted</option>
                              <option value="printed">Printed</option>                            
                              <option value="cancelled">Cancelled</option>
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
               
                <table class="table custom-table">
                    <thead>
                      <tr>          
                        <th scope="col">Order Id</th>
                        <th scope="col">Bill Id</th>
                        <th scope="col">Order Number</th>                
                        <th scope="col">Total Price</th>
                        <th scope="col">Order Type</th>                
                        <th scope="col">Date & Time </th>
                        <th>Duration</th>
                        <th scope="col" >Status</th>     
                              
                        <th scope="col" style="width:200px"  >Action</th>
                       
                      </tr>
                    </thead>
                    <tbody>

                      @for(bl of orderList; track bl.orderid){
                      <tr>
                        <td>{{bl.orderid}}</td>
                        <td>{{bl.billingid}}</td>
                        <td>{{bl.ordernumber}}</td>                    
                        <td>{{bl.totalprice}}</td>
                        <td>{{bl.ordertype}}</td>
                        <td>{{bl.businessdate | date: 'dd-MM-yyyy'}}</td>
                        <td><span class="bl-hgt">{{getTimeAgo(bl.timedate)}}</span> </td>
                        <td>
                          <span [ngClass]="bl.status=='submitted' ? 'bl-hgt' : bl.status=='approved' ? 'gr-hgt' : 'rd-hgt'">
                             {{bl.status=='submitted' ? 'Submitted' : bl.status=='approved' ? 'Closed' : bl.status=='cancelled' ? 'Cancelled' : bl.status}}
                          </span>
                        </td>                           
                        <td class="custom-btn">      
                          @if(bl.status=='submitted'){                      	
                            <button type="button" class="btn btn-danger" (click)="openModal(orderFloorTemplate,bl,'cancel')">
                                <i class="pi pi-trash " ></i>
                                <!-- <span>Cancel</span> -->
                            </button>
                            <button type="button" class="btn btn-primary" (click)="openModal(orderFloorTemplate,bl,'edit')">
                                <i class="pi pi-pencil " ></i>
                                <!-- <span>Edit</span> -->
                            </button>
                          }
                        </td>
                      </tr>
                     }     
                     @empty {
                        <tr><td colspan="9" class="text-center">No data found</td></tr>
                      }
                 
                    </tbody>
                  </table>
              </div>              
            </div>
        </div>
      </div>
    </div> 
         <ng-template #orderFloorTemplate>
       <div class="modal-header">
         <h4 class="modal-title custom-modal-title pull-left">Order Id: {{orderLocalDetail.orderid}}  <span>Date : {{orderLocalDetail.businessdate | date :'dd-MM-yyyy'}}</span></h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="orderFloorModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">

               <div class="cnt-scrl">
                 <!-- {{orderDetail | json}}
                 {{orderLocalDetail | json}} -->
                @if(orderLocalDetail){
                  <table class="table custom-table table-bordered spl-table">
                      <thead>
                        <tr>
                          <th>Menu Name</th>
                          <th>Price</th>
                          <th>Qty</th>
                          <th style="width: 100px;"></th>
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
                          <!-- <tr>
                            <td colspan="4">
                              <h4 class="sb-tt">
                                 <input type="checkbox" name="inputComplementary" [(ngModel)]="inputComplementary" />
                                <span>Complementary</span>
                               
                              </h4>
                              
                            </td>
                          </tr> -->
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
     </ng-template>
  `,
  styles: ``
})
export class OrderReportComponent {
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

  orderFloorModalRef?:BsModalRef;

  inputStatus:any ='submitted';
  inputType:any =0;
  dateInvalid:boolean = false;

  ngOnInit(): void {
      const today = new Date();
    this.inputFromDate = this.formatDate(today);
    this.inputToDate = this.formatDate(today);
   this.getorderTypeList();
  //  this.getOrderInit();  

  this.route.queryParams.subscribe((params:any)=>{

    const status = params['status'];
    const paramDate = params['date'];

    if(status && paramDate){

     const formattedDate = paramDate.includes('T') ? paramDate.split('T')[0] : paramDate;
     this.inputFromDate = formattedDate;
     this.inputToDate = formattedDate;
     this.inputStatus = status;
     console.log( this.inputFromDate);
    }


  })

  this.getOrderReport();
       
  }

  constructor(private route:ActivatedRoute,private stateService: StateService ,private changeDetectRef: ChangeDetectorRef,private alertService:AlertService,private query:QueryService,private modalService:BsModalService){
    
  }

  formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  console.log(`${year}-${month}-${day}`,'gor');
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
      
      // Proceed with form submission logic
      console.log('Valid date range:', this.inputFromDate, this.inputToDate);
    }
}


updateOrderDetail(){
  console.log(this.orderLocalDetail,'this.orderLocalDetail');
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
  console.log(this.orderLocalDetail);
}

// onHandleTypeSubmit(eve:Event){
//   //console.log(eve.target.value,'ind');
//   return false;
//   this.orderTypeList = this.orderTypeList.map((x: any, i: number) => ({
//   ...x,
//   flag: i === inputIndex
//   }));
//   this.orderTypeList[inputIndex].flag = true;
//   this.inputType = this.orderTypeList[inputIndex].ordertypeid;
//   this.getOrderReport();
// }

// onHandleSubmit(){

// }

async getorderTypeList() {    
  // this.stateService.setLoadingState(true);

  this.query.getOrderTypes().subscribe({
    next: (res: any) => {

      this.orderTypeList = res.data.map((x: any) => {
        x.flag = false;
        return x;
      });

      this.orderTypeList.unshift({
      ordertypeid:0,
      ordertypename:'All',
      flag : false
     })

      this.orderTypeList[0].flag = true;
      this.inputType = this.orderTypeList[0].ordertypeid;


     

      console.log(res, 'this.orderTypeList', this.orderTypeList);
    },
    error: (err: any) => {
      console.error('Error fetching order types', err);
    },
    // complete: () => this.stateService.setLoadingState(false)
  });
}



onResetOrder(){
  this.orderLocalDetail = structuredClone(this.orderDetail);
}


onDeleteOrder(inputId:any){

  let inputPost:any ={
    id: inputId,
    comments:this.inputComments,
    complementary:this.inputComplementary
  }

  this.query.deleteOrder(inputPost).subscribe({

    next:((res:any)=>{
      this.changeDetectRef.detectChanges();  
      this.getOrderReport();
      this.orderFloorModalRef?.hide();
      this.alertService.showAlert('Success','Order has been cancelled');
      console.log(res,'delete-order-res');
    }),
    error:((err:any)=>{
       this.changeDetectRef.detectChanges();  
       this.orderFloorModalRef?.hide();
       this.alertService.showAlert('Error','Order has not been cancelled');
       console.log(err,'delete-order-res');
    })

  })

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
    console.log(inputOrderDetail,'inputOrderDetail');
   this.orderDetail = inputOrderDetail;
    this.orderLocalDetail = structuredClone(this.orderDetail);
  //  this.orderLocalDetail = {...inputOrderDetail};
  }

  onStatusChange(newValue: string) {
    this.inputStatus = newValue;
    console.log('Status changed to:', newValue);

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
    // clearTimeout(this.debounceTimer);
    // this.debounceTimer = setTimeout(()=>{
    //   this.getOrderReport();
    // },200)
  }

  getOrderInit(){
    //let addMonth = new Date().setMonth(new Date().getMonth() -1); 
    //this.getOrderReport();
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

  getOrderReport(){
    
   // let addMonth = new Date().setMonth(new Date().getMonth() - 1); 
    //console.log(new Date(addMonth),'add-month',new Date());
   // return;

   this.stateService.setLoadingState(true);

   console.log('chcking',this.inputFromDate)
    let convertFromDate = this.inputFromDate;
    let convertToDate = this.inputToDate;
    
    let getObject = {
      fromDate:convertFromDate,
      toDate:convertToDate,
      status : this.inputStatus,
      ordertypeid:this.inputType
    }

    this.query.getOrderForReport(getObject).subscribe({
      
      next:((res:any)=>{
        console.log('get-order-report', this.inputType,this.inputStatus);
        this.orderList = res.data ? res.data : [];
        this.changeDetectRef.detectChanges();
        this.stateService.setLoadingState(false);
       // this.getBarChart();
      }),
      error:((err:any)=>{
        this.stateService.setLoadingState(false);
      })      
    })
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

  
}



import { ChangeDetectorRef, Component, OnInit ,TemplateRef, ViewChild} from '@angular/core';
import { QueryService } from '@appservices/query.service';
import { async, finalize, from } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';
import { StateService } from '@appservices/state.service';

interface PostBillType {
status: string,
paymentmode:string,
paidamount?:number | null,
notes:string,
iscomplementary:boolean,
complementaryreason :string,
  lifecycleStatus?: string
}

export interface Order {
  orderid: number | string;
};

@Component({
  selector: 'app-take-away',
  standalone: true,
  imports: [CommonModule,FormsModule,RouterModule],
   providers:[BsModalService,AlertService],
  template: `
      <div class="wrapper">
        <div class="right-side">
          <div class="sub-header">
              <div class="tt">
                <h2 class="cs-mn-tt">Take away : Date ({{ post.fromDate | date:'dd-MM-YYYY'}})</h2>
                <!-- <h3 class="cs-spl-tt">Report Date : ({{ post.fromDate | date:'dd-MM-YYYY'}} - {{ post.toDate | date:'dd-MM-YYYY'}})</h3> -->
              </div>
              <div class="btn-bg spl-bg">
                <div class="fl-spl-bg">     
                  <div class="dt-bg">     
                    <label class="ssb-tt">Bill Id</label>      
                    <input type="text" value="" class="form-control" [(ngModel)]="billFilter.billId" (ngModelChange)="billFilterList()" />
                  </div>
                  <div class="dt-bg">     
                    <label class="ssb-tt">Total Amount</label>      
                    <input type="text" value="" class="form-control"  [(ngModel)]="billFilter.totalAmount" (ngModelChange)="billFilterList()" />
                  </div>
                  <div class="dt-bg">     
                    <label class="ssb-tt">Bill Status</label>      
                    <select class="form-select" 
                          (ngModelChange)="billFilterList()" 
                          [(ngModel)]="billFilter.status" (change)="onChangeFilter($event)" >

                      <option value="">All</option>
                      <option value="printed">Printed</option>
                      <option value="finalized">Finalized</option>
                      <option value="complementary">Complementary</option>
                  </select>
                  </div>
                 
                  <div class="dt-bg">
                    <button (click)="onHandleTakeAway()" class="btn btn-primary">+ Create</button>
                  </div>
                </div>
              </div>

            </div>
        
          <div class="cnt">

            <div class="row">
              <div class="col-12 cs-tab">

                    <div class="tab-content " id="summary-content">
                      <div class="tab-pane fade show active" id="bill-summary" role="tabpanel" aria-labelledby="bill-summary-tab">
                       <div class="custom-table-bg">
                          
                         
                          <table class="table custom-table">
                            <thead>
                              <tr>
                                  <th>Bill Id</th>
                                  <th>Bill Number</th>                                
                                  <th>Business Date</th>
                                  <th>Sub Total Amount</th>                                  
                                  <th>Tax</th>                
                                  <th>Discount</th>
                                   <th>Extra Charges</th>
                                    <th>Total Amount</th>   
                                    <th>Bill Status</th>
                                     <th>Payment Status</th>
                                     <th>Order Type</th>
                                      <th>Order Ids</th>
                                     <th>Branch</th>   
                                     <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>                  
                             
                                @for(bl of pagedOrderList; track bl.billid; let blIndex = $index){
                                  
                                    <tr>
                                      <td>{{bl.billid}}</td>
                                      <td>{{bl.billnumber}}</td>
                                      <!-- <td>{{bl.datetime	 | date: 'dd-MM-yyyy'}}</td> -->
                                      <td>{{bl.businessdate | date:'dd-MM-yyyy'}}</td>                                                     
                                      <td>{{bl.subtotal}}</td>                                     
                                      <td>{{bl.tax}}</td>                       
                                      <td>{{bl.discount}}</td>
                                      <td>{{bl.extraamount}}</td>
                                       <td>{{bl.totalamount}}</td>   
                                      <td class="txt-camel">{{bl.lifecyclestatus }}</td>
                                       <td>{{bl.status}}</td>
                                       <td>{{bl.orders[0].orderType}}</td>
                                       <td>{{getOrderIds(bl.orders)}}</td>
                                       <td>{{bl.branch}}</td>


                                       
                                       <td>
                                        <button class="btn btn-primary" title="Update settlement" (click)="openModal(settleTemplate,blIndex,'updateBill')" *ngIf="bl.lifecyclestatus=='printed'">
                                        <i class="pi pi-pencil"></i>
                                       </button>
                                        
                                       <button class="btn btn-primary" (click)="openModal(orderFloorTemplate,blIndex,'orderView')">
                                        <i class="pi pi-list-check"></i>
                                       </button></td>
                                      <!-- <td>
                                        <button class="btn btn-primary">
                                          <i class="pi pi-file-o"></i>
                                      </button></td> -->
                                    </tr>
                                }@empty {
                                  <tr>
                                      <td colspan="12" class="text-center">No data found </td>
                                  </tr>
                                }
                            </tbody>
                          </table>

                          <div class="d-flex justify-content-between align-items-center mt-3">

                            <!-- Rows per page -->
                            <div>
                              <label>Rows per page</label>
                              <select class="form-select d-inline w-auto ms-2"
                                      [(ngModel)]="pageSize"
                                      (change)="onPageSizeChange()">
                                @for(opt of pageSizeOptions; track opt){
                                  <option [value]="opt">{{ opt }}</option>
                                }
                              </select>
                            </div>

                          


                          </div>

                          </div>
                      </div>
                      

                        
                    </div>
                        
                       </div>

              

                
            </div>

           

            
        </div>
       
          
        </div>
    <ng-template #orderFloorTemplate>
       <div class="modal-header">
         <h4 class="modal-title custom-modal-title pull-left">Bill Id: {{pagedOrderList[selectedOrderId].billid}}  <span>Date : {{pagedOrderList[selectedOrderId].businessdate | date :'dd-MM-yyyy'}}</span></h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="orderFloorModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
               <div class="cnt-scrl">           
                 <!-- {{pagedOrderList[selectedOrderId]?.orders | json}}      -->
               @for(bl of pagedOrderList[selectedOrderId]?.orders; track bl.orderid; let ind= $index){
                 
                  <table class="table custom-table table-bordered spl-table">
                      <thead>
                        <tr>
                          <th colspan="4">
                            Order No: {{bl.orderid}}
                          </th>
                         </tr>
                        <tr>
                          <th>Menu Name</th>
                          <th>Price</th>
                          <th>Qty</th>                      
                           <th>Sum of Price</th>
                        </tr>
                      </thead>
                      <tbody> 
                         @for(tl of bl?.orderDetails; track tl.orderdetailid; let tlind= $index){
                          <tr>
                            <td>{{tl.name}}</td>
                            <td>({{tl.price}})</td>
                            <td>{{tl.qty}}</td>                            
                            <td>{{tl.sumofprice}}</td>                            
                          </tr> 
                          }
                      </tbody>
                    </table>

                    
                }@empty{
                  No data found
                }   
                
                
                <table class="table custom-table table-bordered spl-table">
                      <thead>
                         <tr>
                          <th >Sub Total</th>
                          <th>Tax</th>
                           <th >Extra Amount</th>
                          <th>Discount</th>
                          <th>Total</th>
                         </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{{pagedOrderList[selectedOrderId].subtotal}}</td>
                          <td>{{pagedOrderList[selectedOrderId].tax}}</td>
                          <td >{{pagedOrderList[selectedOrderId].extraamount}}</td>
                          <td>{{pagedOrderList[selectedOrderId].discount}}</td>   
                              <td>{{pagedOrderList[selectedOrderId].totalamount}}</td>                      
                        </tr>
                      </tbody>
                    </table>

                    <table class="table custom-table table-bordered spl-table">
                      <thead>
                         <tr>                         
                          <th>Paid Amount</th>                          
                          
                         </tr>
                      </thead>
                      <tbody>
                        <tr>
                         
                          <td>{{pagedOrderList[selectedOrderId].paidamount}}</td>
                       
                        </tr>
                      </tbody>
                    </table>
              </div>
       </div>
       <div class="modal-footer"></div>
     </ng-template>

     <ng-template #settleTemplate *ngIf="postBill">
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{ postBill.status ? 'Update Settle' : 'Settle'}}</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="settleModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
			<div class="row mb3">		 
			  <div class="col-md-6">
				<label class="col-form-label">Payment Status</label>   
				<select class="form-select" [(ngModel)]="postBill.status"  (ngModelChange)="onStatusChange($event)">
          <option value="" default>Select status</option>
					<option value="paid">Paid</option>
					<option value="unpaid">Unpaid</option>					
				</select>
				</div>
				<div class="col-md-6">
					<label class="col-form-label">Payment Mode</label>   
					<select  class="form-select" [(ngModel)]="postBill.paymentmode" [disabled]="postBill.status!=='paid' ? true : false ">
            <option value='' default>Select payment</option>
						<option value="cash">Cash</option>
						<option value="upi">UPI</option>					
						<option value="card">Card</option>					
						<option value="split">Split</option>					
					</select>		
				</div>
		    </div>
			<div class="row mb3">		 
			  <div class="col-md-6">
			  	<label class="col-form-label">Paid Amount</label>             
				  <input type="text"  class="form-control"  [(ngModel)]="postBill.paidamount" [disabled]="postBill.status=='unpaid'" >
				</div>
				<div class="col-md-6">
					<label class="col-form-label">Notes </label>   
					<textarea class="form-control"  class="form-control" [(ngModel)]="postBill.notes" [disabled]="postBill.status == 'unpaid'" 	>
					</textarea>
				</div>
		    </div>
			<div class="row mb3">		 
			  <div class="col-md-6">
					<label class="col-form-label">Is It Complementary ?</label>   
					<div>
					  <label>
						<input type="radio" name="iscomplementary" [value]="true" [(ngModel)]="postBill.iscomplementary" [disabled]="postBill.status == 'paid'" (click)="postBill.status='unpaid';postBill.paymentmode='';postBill.paidamount=0"> Yes
					  </label>
					  <label style="margin-left: 10px;">
						<input type="radio" name="iscomplementary" [value]="false"  [(ngModel)]="postBill.iscomplementary" [disabled]="postBill.status == 'paid'" > No
					  </label>
					</div>
				</div>
				<div class="col-md-6">
					<label class="col-form-label">Complementary Reason</label>   
					<textarea class="form-control"  class="form-control" [(ngModel)]="postBill.complementaryreason" [disabled]="!postBill.iscomplementary"	>
					</textarea>
				</div>
		    </div>
       </div>

       
       <div class="modal-footer" >
         <button
            type="submit"
            class="btn btn-primary"
            [disabled]="
              (postBill.status == 'paid' && !(postBill.paidamount && postBill.paymentmode)) ||
              (postBill.status == 'unpaid' && !(postBill.iscomplementary)) || (postBill.status == '')
            "
            (click)="updateNewBill(pagedOrderList[selectedOrderId].billid,pagedOrderList[selectedOrderId].orders,pagedOrderList[selectedOrderId].lifecyclestatus)">
            Save
          </button>           
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="settleModalRef?.hide()">Close</button> 
        
          </div>
     </ng-template>  


  `,
  styles: ``
})
export class TakeAwayComponent implements OnInit {

    orderlist:any;
  orderListSource:Array<any>=[];
  orderTypeWise:Array<any>=[];
  totalEarnings:any={
    totalAmount:'',
    billAmount:''
  }
  selectedOrderId:number =0;
// pagination
currentPage = 1;
pageSize = 10;
pageSizeOptions = [2, 5, 10];
totalPages = 0;
pagedOrderList: any[] = [];

 settleModalRef?:BsModalRef;

  @ViewChild('settleTemplate') settleTemplate!: TemplateRef<any>;

 post: any = {
  fromDate: this.formatDate(new Date()),
  toDate: this.formatDate(new Date()),
  status: 'all'
};

 initialPostBill:PostBillType ={
 status: '',
  paymentmode: '',
  paidamount: null,
  notes: '',
  iscomplementary: false,
  complementaryreason: '',
  lifecycleStatus: ''
 }

 postBill:PostBillType ={...this.initialPostBill};

  orderFloorModalRef?:BsModalRef;

 

billFilter:any={
  billId:'',
  totalAmount:'',
  status:'',
  orderType: ''
}

onChangeFilter(evt:any){
  console.log(evt.target.value,'evet');
  this.billFilter.status = evt.target.value;
  this.billFilterList();
}

billFilterList(){

  let localOrderList = this.orderListSource;
    if(this.billFilter.billId ){
    console.log('checking')
    localOrderList = localOrderList.filter((x:any)=>{
       return x.billid &&
             x.billid.toString().includes(this.billFilter.billId.toString());
    })

    this.orderlist = localOrderList;
  }

  if(this.billFilter.totalAmount){
    console.log('total',this.billFilter.totalAmount)
    localOrderList = localOrderList.filter((x:any)=>{
      return  x.totalamount.toString().includes(this.billFilter.totalAmount.toString()) ;
       console.log(x.totalamount.toString().includes(this.billFilter.totalAmount.toString()) );
    })
    this.orderlist = localOrderList;
  }  


  if(this.billFilter.status){
    console.log('status',this.billFilter.status);
    localOrderList = localOrderList.filter((x:any)=>{
      console.log(x.lifecyclestatus.toString() == this.billFilter.status.toString());
      return  (x.lifecyclestatus.toString() == this.billFilter.status.toString());
    })
    this.orderlist = localOrderList;
  }  
  // NEW: filter by order type
  if (this.billFilter.orderType) {
    localOrderList = localOrderList.filter(x =>
      x.orders && x.orders.some((o:any)=> o.orderType === this.billFilter.orderType)
    );
  }

  if (!this.billFilter.billId && !this.billFilter.totalAmount && !this.billFilter.status && !this.billFilter.orderType) {
    this.orderlist = this.orderListSource;
  } else {
    this.orderlist = localOrderList;
  }

  // if(!this.billFilter.billId  && !this.billFilter.totalAmount && !this.billFilter.status){ 
  //   this.orderlist = this.orderListSource;
  // }
this.currentPage = 1;
this.updatePagination();

}
get pages(): number[] {
  return Array.from({ length: this.totalPages }, (_, i) => i + 1);
}

updatePagination() {
  const source = this.orderlist || [];
  this.totalPages = Math.ceil(source.length / this.pageSize);

  const start = (this.currentPage - 1) * this.pageSize;
  const end = start + this.pageSize;


  // console.log(this.pagedOrderList,'this.pagedOrderList');

  this.pagedOrderList = source.slice(start, end);
}

changePage(page: number) {
  if (page < 1 || page > this.totalPages) return;
  this.currentPage = page;
  this.updatePagination();
}

onPageSizeChange() {
  this.currentPage = 1;
  this.updatePagination();
}

formatDate(date: Date) {
  return date.toISOString().substring(0, 10); // YYYY-MM-DD
}


TodayDate(){
  console.log('1');
  this.post.fromDate = this.formatDate(new Date());
  this.post.toDate = this.formatDate(new Date());
  this.changeDef.detectChanges();
   this.getOrderByDate();
  //this.getOrderReport(this.post.formDate,this.post.toDate);
}

getOrderIds(inputList:Order[]){
  let result = inputList
  .filter((x => x.orderid !=null))
  .map((x:any)=>x.orderid)
  .join(',') ;
  return result.toString();
}

  constructor(private stateService:StateService,private alertService:AlertService,private router:Router,private query:QueryService,private changeDef:ChangeDetectorRef,private modalService:BsModalService){

  }

  ngOnInit(): void {
    this.getOrderInit();  
  }

    openModal(template: TemplateRef<void>,blIndex:number,templateType: 'orderView' | 'updateBill'):void {   
      this.selectedOrderId =  blIndex;

      switch(templateType){

        case 'orderView' :
        this.orderFloorModalRef = this.modalService.show(template);  
        break;

        case 'updateBill' :
        this.settleModalRef = this.modalService.show(template);    
        break;

      }
    
    }

  getOrderByDate(){
    let fromDate = this.post.fromDate;
    let toDate =  this.post.toDate;
    let status = this.post.status;
    console.log(fromDate,toDate,'--fromDate,--toDate');
    this.getOrderReport(new Date(fromDate),new Date(toDate),status);
  }


  getOrderInit(){
    // let addMonth = new Date().setMonth(new Date().getMonth() -1); 
    this.getOrderReport(new Date(),new Date() , 'all');
  }

  getOrderReport(fromDate:Date,toDate:Date,status:any){
    
    this.stateService.setLoadingState(true);

    let convertFromDate = fromDate.toISOString().split('T')[0];
    let convertToDate = toDate.toISOString().split('T')[0];

    // console.log(convertFromDate,convertToDate,'--convert From date');
    
    let getObject = {
      fromDate:convertFromDate,
      toDate:convertToDate,
      ordertype:'Takeaway',
      status : status
    }

    this.query.getBillForReport(getObject).pipe(
      finalize(()=>{
         this.stateService.setLoadingState(false); 
      })
    ).subscribe({
      next:((res:any)=>{
        this.totalEarnings.totalAmount = res.totalAmount;
        this.totalEarnings.subTotal = res.subtotal;
        this.orderlist = res.data;
        console.log(res.data,'---order-detail--->');
        // this.orderDetail =
        this.orderListSource = res.data;
        this.orderTypeWise =  res.orderTypeWiseTotals;

        this.updatePagination();
       // this.getBarChart();
      }),
      error:((err:any)=>{
      })      
    })
  }


 getTotalSubTotal() {
  return (this.orderTypeWise ?? []).reduce((acc, x) => acc + (x.subTotalAmount || 0), 0);
}

getTotalTax() {
  return (this.orderTypeWise ?? []).reduce((acc, x) => acc + (x.totalTax || 0), 0);
}

getTotalWithTax() {
  return (this.orderTypeWise ?? [] ).reduce((acc, x) => acc + (x.totalWithTax || 0), 0);
}

getPaidTotal() {
  return (this.orderTypeWise ?? []).reduce((acc, x) => acc + (x.paidAmount || 0), 0);
}

getUnpaidTotal() {
  return (this.orderTypeWise ?? []).reduce((acc, x) => acc + (x.unpaidAmount || 0), 0);
}

getComplementaryTotal() {
  return (this.orderTypeWise ?? []).reduce((acc, x) => acc + (x.complementaryAmount || 0), 0);
}

  onHandleTakeAway(){
    this.router.navigate(['/order/0/0/'+2+'/'+'']);
  }

  onStatusChange(newStatus: string) {
    console.log('Status changed:', newStatus);

    if (newStatus === 'paid') {
      this.postBill.lifecycleStatus = 'finalized';
      this.postBill.iscomplementary =  false;
      this.postBill.complementaryreason= '';
    //  this.postBill.paidamount = this.postBill.billAmount; // auto set full payment
    }

    if (newStatus === 'unpaid') {
      this.postBill.lifecycleStatus = 'complementary';
      this.postBill.iscomplementary =  true;
      this.postBill.complementaryreason= '';
      this.postBill.paidamount = 0;
    }

  }
  
async updateNewBill(inputBillId: any,orders:[],billStatus:string){

  if(billStatus=='finalized'){
    this.settleModalRef?.hide();
    this.alertService.showAlert('Notice', 'This bill is already finalized and cannot be updated.');
    return ;
  }
 
    let updateBillObj = {
      billId: inputBillId,
      lifecycleStatus: this.postBill.lifecycleStatus,
      paidamount:this.postBill.paidamount ? this.postBill.paidamount : null,
      paymentmode:this.postBill.paymentmode ? this.postBill.paymentmode : null,
      status:this.postBill.status,
	    notes:this.postBill.notes,
      iscomplementary:this.postBill.iscomplementary,
      complementaryreason:this.postBill.complementaryreason	,
      orderids:orders   
    }   
   
    this.query.updateBillList(updateBillObj).subscribe({      
      next:(async(res:any)=>{
        this.settleModalRef?.hide();
        this.handleUpdatePost();
        if(res.status=='Success'){             
          this.alertService.showAlert('Success','Bill has been updated successfully');
        }else{
          this.alertService.showAlert('Error','Bill has not updated Please try again.');
        }
      }),
      error:((err:any)=>{    
        this.settleModalRef?.hide();
        this.handleUpdatePost();
        this.alertService.showAlert('Error',err.error.message);
      })
    })
  }


  handleUpdatePost(){
      this.getOrderByDate();
    this.postBill = {...this.initialPostBill};
  }

}

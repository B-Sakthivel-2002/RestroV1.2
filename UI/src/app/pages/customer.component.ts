import { Component,OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Form, Validators } from '@angular/forms';
import { StateService } from '@appservices/state.service';
import { ChangeDetectorRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';
import { inject } from '@angular/core';
import { AuthService } from '@appservices/auth.service';
import { BranchSelectComponent } from '../shared/component/branch-select.component';
import { BranchNamePipe } from '../shared/pipes/branch-name.pipe';


@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,BranchSelectComponent,BranchNamePipe],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Customer</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(customerTemplate);setCustomerList('create',0);">+ Create customer</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">Customer Id</th>
                        <th scope="col">Name</th> 
						<th scope="col">Contact Number</th>     
					    <th scope="col">Email Id</th>     
					    <th scope="col">Address</th>      
                        @if(isOutletOwner){<th scope="col">Branch</th>}
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of customerList; track fs.customerid){
                      <tr>
                       
                          <td>{{fs.customerid}}</td>
                          <td>{{fs.name}}</td>
                          <td>{{fs.contactnumber}}</td>
                          <td>{{fs.email}}</td>
                          <td>{{fs.address}}</td>
                          @if(isOutletOwner){<td>{{fs.branchid | branchName | async}}</td>}
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="setCustomerList('edit',fs.customerid);openModal(customerTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.customerid)">
                                <i class="pi pi-trash " ></i>
                            </button>
                          </td>
                      </tr>
                    }
                      
                      
                    </tbody>
                  </table>
              </div>              
            </div>


    </div>

    
     
     <ng-template #customerTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{customerFormTitle}} customer</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="customerModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="customerForm"  *ngIf="customerForm">
            @if(!branchLocked){<app-branch-select [(branchId)]="saveBranchId"></app-branch-select>} 

            <div class="row mb-3">

              <div class="col-md-12">
                <label for="name" name="name" class="col-form-label">Customer Name</label>
                <input type="text" value="" class="form-control" formControlName="name" />
                <div *ngIf="customerForm.get('name')?.invalid && customerForm.get('name')?.touched">
                  <small class="text-danger">Customer name is required.</small>
                </div>
              </div>
            </div>
            <div class="row mb-3">
              <div class="col-md-6">
                <label for="contactnumber" name="contactnumber" class="col-form-label">Contact Number</label>
                <input type="text" value="" class="form-control" formControlName="contactnumber" />
                <div *ngIf="customerForm.get('contactnumber')?.invalid && customerForm.get('contactnumber')?.touched">
                  <small class="text-danger">Contact Number is required.</small>
                </div>
              </div>


              <div class="col-md-6">
                <label for="email" name="email" class="col-form-label">Email Id</label>
                <input type="text" value="" class="form-control" formControlName="email" />
                <div *ngIf="customerForm.get('email')?.invalid && customerForm.get('email')?.touched">
                  <small class="text-danger">Email id is required.</small>
                </div>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-12">
                <label for="address" name="address" class="col-form-label">Address</label>
                <input type="text" value="" class="form-control" formControlName="address" />
                <div *ngIf="customerForm.get('address')?.invalid && customerForm.get('address')?.touched">
                  <small class="text-danger">Address is required.</small>
                </div>
              </div>
            </div>
             
            </form>
       </div>
       <div class="modal-footer"  *ngIf="customerForm">
            <button type="submit" [disabled]="customerForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="customerModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class CustomerComponent {
  // An outlet owner (SuperAdmin) sees every branch's records and picks the branch a new one is saved to;
  // everyone else only works with their own branch (the API enforces this).
  isOutletOwner = inject(AuthService).isOutletOwner();
  saveBranchId = Number(localStorage.getItem('branchid') || 1);
  branchLocked = false;
  customerList:any=[];  
  customerForm!:FormGroup;
  customerFormTitle:String ='Create';
  customerModalRef?: BsModalRef;

  initialCustomerForm ={
    customerid:0,
    name:'',
    contactnumber: '',
    email: '',
    address:'',
  }
  constructor(private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getCustomerList();

    this.customerForm = this.fb.group({
      customerid:[this.initialCustomerForm.customerid],
      name:[this.initialCustomerForm.name,Validators.required],
      contactnumber: [this.initialCustomerForm.contactnumber, [Validators.required, Validators.pattern(/^\d+$/)]],
      email: [this.initialCustomerForm.email, [Validators.required, Validators.email]],
      address:[this.initialCustomerForm.address,Validators.required],
    })
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.customerModalRef = this.modalService.show(template);
  }
  

  getCustomerList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getCustomers(true).subscribe({
      next:((res:any)=>{
        this.customerList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the customer',()=>{
      console.log('confirmed');
      this.deleteCustomerList(id);
    });
  }


  deleteCustomerList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deleteCustomer(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getCustomerList();
        this.stateService.setLoadingState(false);
        this.alertService.showAlert('Alert !','customer has been deleted');
      }),
      error:((err:any)=>{
        console.log(err,'err');
        this.stateService.setLoadingState(false);
        this.alertService.showAlert('Error !',err.message);
      }),
      complete: (() => {
        this.stateService.setLoadingState(false);
      })
    })

  }


  setCustomerList(flag: string, inputId: number) {

    this.customerFormTitle = flag;
  
    if (flag === 'create') {
  
      this.saveBranchId = Number(localStorage.getItem('branchid') || 1);
  
      this.branchLocked = false;
      this.customerForm.reset(this.initialCustomerForm);
      console.log(this.customerForm);
    } else if (flag === 'edit') {
      this.branchLocked = true;
      const localcustomerForm = this.customerList.filter((x: any) => x.customerid === inputId);
  
      if (localcustomerForm && localcustomerForm.length > 0) {
        this.customerForm.patchValue({
          customerid: localcustomerForm[0].customerid,
          name: localcustomerForm[0].name,
          contactnumber: localcustomerForm[0].contactnumber,
          email: localcustomerForm[0].email,
          address: localcustomerForm[0].address,
        });
      } else {
        console.error('customer data not found for id:', inputId);
      }
    }
    //this.openModal(customerTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.customerForm.valid) {      
     const branchid = this.saveBranchId;
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.customerForm.value,
      branchid: branchid,
      outletid: outletid
    };

    console.log(outputParams,'---customer-outputParams');
    
      const request$ = outputParams.customerid && outputParams.customerid !==0 ? this.query.updateCustomer(outputParams) : this.query.addCustomer(outputParams);
      console.log(outputParams, 'outputParams');
      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.customerModalRef?.hide();
          this.getCustomerList(); // Refresh list
            this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','Customer List has been updated successfully');  
        },
        error: (err: any) => {
          this.customerModalRef?.hide();
            this.stateService.setLoadingState(false);
          this.alertService.showAlert('Error!',err.message);
          console.error(err, '--err-categories');
        },
        complete: () => {this.stateService.setLoadingState(false);}
      });
      
    }

  

  }
  
  
}

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
import { debounceTime } from 'rxjs';

interface OrderType  {
ordertypeid:number,
ordertypename:string,
status:boolean
}

@Component({
  selector: 'app-extra-charge',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,BranchSelectComponent,BranchNamePipe],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Extra Charge</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(extraChargeTemplate);setextraChargeList('create',0);">+ Create Extra Charge</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">Id</th>                       
                        <th scope="col">Extra Charge Name</th>   
						            <th scope="col">Extra Charge Rate</th> 
                        <th>Extra Charge Type</th>
                        <th>Order Type</th>
                        <th>Range status</th>
                        <th scope="col">Range From</th> 
                        <th scope="col">Range To</th> 
                        @if(isOutletOwner){<th scope="col">Branch</th>}
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of extraChargeList; track fs.extrachargeid){
                      <tr>
                       
                          <td>{{fs.extrachargeid}}</td>
                          <td>{{fs.extrachargename}}</td>     
						              <td>{{fs.extrachargerate}}</td>     		
                         <td>{{fs.extrachargetype}}</td> 
                         <td>{{fs.ordertypename}}</td>
                           <td>{{fs.extrachargestatus}}</td> 
                          <td>{{fs.extrachargefrom ? fs.extrachargefrom :'-'}}</td> 
                          <td>{{fs.extrachargeto ? fs.extrachargeto :'-'}}</td> 
                          @if(isOutletOwner){<td>{{fs.branchid | branchName | async}}</td>}
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="setextraChargeList('edit',fs.extrachargeid);openModal(extraChargeTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.extrachargeid)">
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

    
     
     <ng-template #extraChargeTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{extraChargeFormTitle}} Extra Charge</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="extraChargeModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="extraChargeForm"  *ngIf="extraChargeForm">
            @if(!branchLocked){<app-branch-select [(branchId)]="saveBranchId"></app-branch-select>} 
            
            <div class="row mb-3">

              <div class="col-md-4">
                <label for="extrachargename" name="extrahargename" class="col-form-label">Extra Charge Name</label>
                <input type="text" value="" class="form-control" formControlName="extrachargename" />
                <div *ngIf="extraChargeForm.get('extrachargename')?.invalid && extraChargeForm.get('extrachargename')?.touched">
                  <small class="text-danger">Extra Charge name is required.</small>
                </div>
              </div>
              <div class="col-md-4">
                <label for="extrachargerate" name="extrachargerate" class="col-form-label">Extra Charge rate</label>
                <input type="text" value="" class="form-control" formControlName="extrachargerate" />
                <div *ngIf="extraChargeForm.get('extrachargerate')?.invalid && extraChargeForm.get('extrachargerate')?.touched">
                  <small class="text-danger">Extra Charge rate is required.</small>
                </div>
              </div>

              <div class="col-md-4">
                <!-- {{extraChargeForm.get('extrachargerate')}} -->
                <label for="extrachargestatus" name="extrachargestatus" class="col-form-label" >
                   <input type="checkbox" value ="" formControlName="extrachargestatus" />
                  Enable Extra Charge Range</label>
                  
              </div>

            </div>
			
            <div class="row mb-3">


                 <div class="col-md-4">
                 
                <label for="extrachargetype" name="extrachargetype" class="col-form-label" >Extra Charge Type</label>
                <select id="extrachargetype" formControlName="extrachargetype" class="form-control">
                   <option value="percentage" >Percentage (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
                <div *ngIf="extraChargeForm.get('extrachargetype')?.invalid && extraChargeForm.get('extrachargetype')?.touched">
                  <small class="text-danger">Extra Charge type is required.</small>
                </div>
              </div>

              <div class="col-md-4">
                <label for="extrachargefrom" name="extrachargefrom" class="col-form-label" >From</label>
                <input type="number" formControlName="extrachargefrom" class="form-control"  />
                <div *ngIf="extraChargeForm.get('extrachargefrom')?.invalid && extraChargeForm.get('extrachargefrom')?.touched ">
                  <small class="text-danger">range from is required.</small>
                </div>
              </div>

              <div class="col-md-4">
                <label for="extrachargeto" name="extrachargeto" class="col-form-label" >To</label>
                <input type="number" formControlName="extrachargeto"  class="form-control" />
                <div *ngIf="extraChargeForm.get('extrachargeto')?.invalid && extraChargeForm.get('extrachargeto')?.touched ">
                  <small class="text-danger">range to is required.</small>
                </div>
              </div>   
            </div>

            <div class="row mb-3">
                <div class="col-md-12">
                  <label for="ordertypeid" name="ordertypeid" class="col-form-label" >Order Type</label>
                  <select id="ordertypeid" formControlName="ordertypeid" class="form-control">
                    @for(list of orderTypeList; track  list.ordertypeid){
                      <option [value]="list.ordertypeid" >{{list.ordertypename}}</option>
                    }
                    @empty {
                      <div>No data found</div>
                    }                  
                  </select>
                </div>
            </div>

            <div class="row mb-3">              
              <div *ngIf="extraChargeForm.errors">                   
                  <small *ngIf="extraChargeForm.errors?.['extraChargeRangeInvalid']">Extra Charge From must be less than Extra Charge To</small>
                </div>
                <div class="col-md-12">
                  <div class="alert alert-info">  
                  <small>Note: If the extra charge range is enabled, the extra charge will be applied only when the order amount falls within the specified range. <br><br>
                  Examples:
Order Amount: ₹1000, Tax Type: Flat (₹2) → Final Amount = ₹1002
Order Amount: ₹1000, Tax Type: 2% → Tax = ₹2, Final Amount = ₹1020<br><br>
                    Please confirm the Extra Charge Rate and Extra Charge Type (Percentage / Flat).</small>
                  </div>				  
                </div>
            </div>
			
            </form>
       </div>
       <div class="modal-footer"  *ngIf="extraChargeForm">
            <button type="submit" [disabled]="extraChargeForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="extraChargeModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class ExtraChargeComponent {
  // An outlet owner (SuperAdmin) sees every branch's records and picks the branch a new one is saved to;
  // everyone else only works with their own branch (the API enforces this).
  isOutletOwner = inject(AuthService).isOutletOwner();
  saveBranchId = Number(localStorage.getItem('branchid') || 1);
  branchLocked = false;

  extraChargeList:any=[];  
  extraChargeForm!:FormGroup;
  extraChargeFormTitle:String ='Create';
  extraChargeModalRef?: BsModalRef;
  // orderList:Array<OrderType> =[];
  orderTypeList:OrderType[] =[];

  initialextraChargeValues ={
      extrachargeid:0,
      extrachargename:'',
		  extrachargerate:0,
      extrachargetype: 'percentage',
      extrachargestatus:false,
      extrachargefrom: '',
      extrachargeto: '',
      ordertypeid:-1
  }
  constructor(private changeDetectRef:ChangeDetectorRef,private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getextraChargeList();
    this.getordertypeList();

    this.extraChargeForm = this.fb.group({   
      extrachargeid:[this.initialextraChargeValues.extrachargeid],
        extrachargename:[this.initialextraChargeValues.extrachargename,Validators.required],
		    extrachargerate:[this.initialextraChargeValues.extrachargerate,[Validators.required,
          Validators.pattern(/^\d+(\.\d{1,2})?$/)  // Accepts numbers like 10.00
        ]],
        extrachargetype:[this.initialextraChargeValues.extrachargetype,Validators.required],
        extrachargestatus:[this.initialextraChargeValues.extrachargestatus,Validators.required],
        extrachargefrom:[this.initialextraChargeValues.extrachargefrom],
        extrachargeto:[this.initialextraChargeValues.extrachargeto],
        ordertypeid:[this.initialextraChargeValues.ordertypeid,Validators.required]
    })

   this.validateRangeStatus();

  }


  validateRangeStatus(){

    this.extraChargeForm.get('extrachargestatus')?.valueChanges.subscribe((status: boolean) => {

        const extrachargefrom = this.extraChargeForm.get('extrachargefrom');
        const extrachargeto = this.extraChargeForm.get('extrachargeto');

        if(status){
          extrachargefrom?.setValidators([Validators.required]);
          extrachargeto?.setValidators([Validators.required]);
          extrachargefrom?.enable();
          extrachargeto?.enable();
        }else{
          extrachargefrom?.clearValidators();
          extrachargeto?.clearValidators();
          extrachargefrom?.setValue(this.initialextraChargeValues.extrachargefrom);
          extrachargeto?.setValue(this.initialextraChargeValues.extrachargeto);
          extrachargefrom?.disable();
          extrachargeto?.disable();
        }

        extrachargefrom?.updateValueAndValidity();
        extrachargeto?.updateValueAndValidity();
      
    });

    this.extraChargeForm.get('extrachargefrom')?.valueChanges.pipe(debounceTime(100)).subscribe(()=>{
      this.checkextraChargeRangeValidity();
    })

    this.extraChargeForm.get('extrachargeto')?.valueChanges.pipe(debounceTime(100)).subscribe(()=>{
      this.checkextraChargeRangeValidity();
    })

  }

  checkextraChargeRangeValidity() {
    const status = this.extraChargeForm.get('extrachargestatus')?.value;
    const from = parseFloat(this.extraChargeForm.get('extrachargefrom')?.value);
    const to = parseFloat(this.extraChargeForm.get('extrachargeto')?.value);

    console.log(status,from,to,!isNaN(from),!isNaN(to),'--->status --from -- to')

    const currentErrors = this.extraChargeForm.errors || {};

      if (from >= to && status) {
        this.extraChargeForm.setErrors({ ...currentErrors, extraChargeRangeInvalid: true });
      } else {
        const { extraChargeRangeInvalid, ...others } = currentErrors;
        const newErrors = Object.keys(others).length > 0 ? others : null;
        this.extraChargeForm.setErrors(newErrors);
      }
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.extraChargeModalRef = this.modalService.show(template);
  }
  
  // orderList

    getordertypeList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getOrderTypes().subscribe({
      next:((res:any)=>{
        this.orderTypeList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }


  getextraChargeList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getExtraCharges(false, true).subscribe({
      next:((res:any)=>{
        this.extraChargeList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the extraCharge',()=>{
      console.log('confirmed');
      this.deleteextraChargeList(id);
    });
  }


  deleteextraChargeList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deleteExtraCharge(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getextraChargeList();
        this.changeDetectRef.detectChanges();
        this.alertService.showAlert('Alert !','extraCharge has been deleted');
      }),
      error:((err:any)=>{
        console.log(err,'err');
        this.stateService.setLoadingState(false);
        this.alertService.showAlert('Error !',err.message);
      }),
      complete: (() => {
        console.log('completed');        
      })
    })
    this.stateService.setLoadingState(false);
  }


  setextraChargeList(flag: string, inputId: number) {

    this.extraChargeFormTitle = flag;
  
    if (flag === 'create') {
  
      this.saveBranchId = Number(localStorage.getItem('branchid') || 1);
  
      this.branchLocked = false;
     //  this.taxForm.reset(this.initialTaxFormValues);
      this.extraChargeForm.reset(this.initialextraChargeValues);
      console.log(this.extraChargeForm);
    } else if (flag === 'edit') {
      this.branchLocked = true;
      console.log(this.extraChargeList,'this.extraChargeList');
      const data = this.extraChargeList.filter((x: any) => x.extrachargeid === inputId);
      console.log(data,'localextraChargeForm',inputId);
  
      if (data && data.length > 0) {
        this.extraChargeForm.patchValue(data[0]);
      } else {
        console.error('extraCharge data not found for id:', inputId);
      }
    }
    //this.openModal(extraChargeTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.extraChargeForm.valid) {      
      // const outputParams = this.extraChargeForm.value;
        const branchid = this.saveBranchId;
        const outletid = Number(localStorage.getItem('outletid') || 1);

        const outputParams = {
          ...this.extraChargeForm.value,
          branchid: branchid,
          outletid: outletid
        };
      console.log(outputParams, 'outputParams');

      const request$ =  outputParams.extrachargeid && outputParams.extrachargeid !== 0 ? this.query.updateExtraCharge(outputParams) :this.query.addExtraCharge(outputParams)

      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.extraChargeModalRef?.hide();
          this.getextraChargeList(); // Refresh list
          this.changeDetectRef.detectChanges();
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','tax has been updated successfully');  
        },
        error: (err: any) => {
           this.extraChargeModalRef?.hide();
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Error!',err.message);
          console.error(err, '--err-categories');
        },
        complete: () => {
          this.stateService.setLoadingState(false);
        }
      });

    }

  

  }
  
  
}

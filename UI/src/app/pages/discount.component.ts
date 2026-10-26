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
import { debounceTime, finalize } from 'rxjs';



@Component({
  selector: 'app-discount',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,BranchSelectComponent,BranchNamePipe],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Discount</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(discountTemplate);setdiscountList('create',0);">+ Create discount</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">Id</th>                       
                        <th scope="col">Discount Name</th>   
						            <th scope="col">Discount Rate</th> 
                        <th>Discount Type</th>
                        <th>Range status</th>
                        <th scope="col">Range From</th> 
                        <th scope="col">Range To</th> 
                        @if(isOutletOwner){<th scope="col">Branch</th>}
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of discountList; track fs.discountid){
                      <tr>
                       
                          <td>{{fs.discountid}}</td>
                          <td>{{fs.discountname}}</td>     
						              <td>{{fs.discountrate}}</td>     		
                         <td>{{fs.discounttype}}</td> 
                           <td>{{fs.discountrangestatus}}</td> 
                          <td>{{fs.discountfrom ? fs.discountfrom :'-'}}</td> 
                          <td>{{fs.discountto ? fs.discountto :'-'}}</td> 
                          @if(isOutletOwner){<td>{{fs.branchid | branchName | async}}</td>}
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="setdiscountList('edit',fs.discountid);openModal(discountTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.discountid)">
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

    
     
     <ng-template #discountTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{discountFormTitle}} discount</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="discountModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="discountForm"  *ngIf="discountForm">
            @if(!branchLocked){<app-branch-select [(branchId)]="saveBranchId"></app-branch-select>} 
            
            <div class="row mb-3">

              <div class="col-md-4">
                <label for="discountname" name="discountname" class="col-form-label">Discount Name</label>
                <input type="text" value="" class="form-control" formControlName="discountname" />
                <div *ngIf="discountForm.get('discountname')?.invalid && discountForm.get('discountname')?.touched">
                  <small class="text-danger">discount name is required.</small>
                </div>
              </div>
              <div class="col-md-4">
                <label for="discountrate" name="discountrate" class="col-form-label">Discount rate</label>
                <input type="text" value="" class="form-control" formControlName="discountrate" />
                <div *ngIf="discountForm.get('discountrate')?.invalid && discountForm.get('discountrate')?.touched">
                  <small class="text-danger">discount rate is required.</small>
                </div>
              </div>

              <div class="col-md-4">
                <label for="discountrangestatus" name="discountrangestatus" class="col-form-label" >
                   <input type="checkbox" value ="" formControlName="discountrangestatus" />
                  Enable Discount Range</label>
                  
              </div>

            </div>
			
            <div class="row mb-3">


                 <div class="col-md-4">
                 
                <label for="discounttype" name="discounttype" class="col-form-label" >Discount Type</label>
                <select id="discounttype" formControlName="discounttype" class="form-control">
                   <option value="percentage" >Percentage (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
                <div *ngIf="discountForm.get('discounttype')?.invalid && discountForm.get('discounttype')?.touched">
                  <small class="text-danger">discount type is required.</small>
                </div>
              </div>

              <div class="col-md-4">
                <label for="discountfrom" name="discountfrom" class="col-form-label" >From</label>
                <input type="number" formControlName="discountfrom" class="form-control"  />
                <div *ngIf="discountForm.get('discountfrom')?.invalid && discountForm.get('discountfrom')?.touched ">
                  <small class="text-danger">range from is required.</small>
                </div>
              </div>

              <div class="col-md-4">
                <label for="discountto" name="discountto" class="col-form-label" >To</label>
                <input type="number" formControlName="discountto"  class="form-control" />
                <div *ngIf="discountForm.get('discountto')?.invalid && discountForm.get('discountto')?.touched ">
                  <small class="text-danger">range to is required.</small>
                </div>
              </div>   
            </div>

            <div class="row mb-3">              
              <div *ngIf="discountForm.errors">                   
                  <small *ngIf="discountForm.errors?.['discountRangeInvalid']">Tax From must be less than Tax To</small>
                </div>
                    <div class="col-md-12">
                      <div class="alert alert-info">  
                          <small>Note: If the discount range is enabled, the discount will be applied only when the order amount falls within the specified range. <br>
                          Please confirm the Discount Rate and Discount Type (Percentage / Flat).</small>
                        </div>
                  </div>
            </div>
			
            </form>
       </div>
       <div class="modal-footer"  *ngIf="discountForm">
            <button type="submit" [disabled]="discountForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="discountModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class DiscountComponent {
  // An outlet owner (SuperAdmin) sees every branch's records and picks the branch a new one is saved to;
  // everyone else only works with their own branch (the API enforces this).
  isOutletOwner = inject(AuthService).isOutletOwner();
  saveBranchId = Number(localStorage.getItem('branchid') || 1);
  branchLocked = false;

  discountList:any=[];  
  discountForm!:FormGroup;
  discountFormTitle:String ='Create';
  discountModalRef?: BsModalRef;

  initialDiscountValues ={
      discountid:0,
      discountname:'',
		  discountrate:0,
      discounttype: 'percentage',
      discountrangestatus:false,
      discountfrom: '',
      discountto: ''
  }
  constructor(private changeDetectRef:ChangeDetectorRef,private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getdiscountList();

    this.discountForm = this.fb.group({   
      discountid:[this.initialDiscountValues.discountid],
        discountname:[this.initialDiscountValues.discountname,Validators.required],
		    discountrate:[this.initialDiscountValues.discountrate,[Validators.required,
          Validators.pattern(/^\d+(\.\d{1,2})?$/)  // Accepts numbers like 10.00
        ]],
        discounttype:[this.initialDiscountValues.discounttype,Validators.required],
        discountrangestatus:[this.initialDiscountValues.discountrangestatus,Validators.required],
        discountfrom:[this.initialDiscountValues.discountfrom],
        discountto:[this.initialDiscountValues.discountto]
    })

   this.validateRangeStatus();

  }


  validateRangeStatus(){

    this.discountForm.get('discountrangestatus')?.valueChanges.subscribe((status: boolean) => {

        const discountfrom = this.discountForm.get('discountfrom');
        const discountto = this.discountForm.get('discountto');

        if(status){
          discountfrom?.setValidators([Validators.required]);
          discountto?.setValidators([Validators.required]);
           discountfrom?.enable();
          discountto?.enable();
        }else{
          discountfrom?.clearValidators();
          discountto?.clearValidators();
          discountfrom?.setValue(this.initialDiscountValues.discountfrom);
          discountto?.setValue(this.initialDiscountValues.discountto);
           discountfrom?.disable();
          discountto?.disable();
        }

        discountfrom?.updateValueAndValidity();
        discountto?.updateValueAndValidity();
      
    });

    this.discountForm.get('discountfrom')?.valueChanges.pipe(debounceTime(100)).subscribe(()=>{
      this.checkDiscountRangeValidity();
    })

    this.discountForm.get('discountto')?.valueChanges.pipe(debounceTime(100)).subscribe(()=>{
      this.checkDiscountRangeValidity();
    })

  }

  checkDiscountRangeValidity() {
    const status = this.discountForm.get('discountrangestatus')?.value;
    const from = parseFloat(this.discountForm.get('discountfrom')?.value);
    const to = parseFloat(this.discountForm.get('discountto')?.value);

    console.log(status,from,to,!isNaN(from),!isNaN(to),'--->status --from -- to')

    const currentErrors = this.discountForm.errors || {};

      if (from >= to && status) {
        this.discountForm.setErrors({ ...currentErrors, discountRangeInvalid: true });
      } else {
        const { discountRangeInvalid, ...others } = currentErrors;
        const newErrors = Object.keys(others).length > 0 ? others : null;
        this.discountForm.setErrors(newErrors);
      }
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.discountModalRef = this.modalService.show(template);
  }
  

  getdiscountList(){    
    
    this.stateService.setLoadingState(true);
   
    this.query.getDiscounts(false, true).pipe(
          finalize(() => {
            this.stateService.setLoadingState(false);
          })
        ).subscribe({
          next:((res:any)=>{
            this.discountList = res.data;
            console.log(res,'res'); 
          }),
          error:((err:any)=>{        
          })
      })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the discount',()=>{
      console.log('confirmed');
      this.deletediscountList(id);
    });
  }


  deletediscountList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deleteDiscount(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getdiscountList();
        this.changeDetectRef.detectChanges();
        this.alertService.showAlert('Alert !','discount has been deleted');
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


  setdiscountList(flag: string, inputId: number) {

    this.discountFormTitle = flag;
  
    if (flag === 'create') {
  
      this.saveBranchId = Number(localStorage.getItem('branchid') || 1);
  
      this.branchLocked = false;
     //  this.taxForm.reset(this.initialTaxFormValues);
      this.discountForm.reset(this.initialDiscountValues);
      console.log(this.discountForm);
    } else if (flag === 'edit') {
      this.branchLocked = true;
      const localdiscountForm = this.discountList.filter((x: any) => x.discountid === inputId);
  
      if (localdiscountForm && localdiscountForm.length > 0) {
        this.discountForm.patchValue({
          discountid: localdiscountForm[0].discountid,
          discountname: localdiscountForm[0].discountname,
		  discountrate: localdiscountForm[0].discountrate
        });
      } else {
        console.error('discount data not found for id:', inputId);
      }
    }
    //this.openModal(discountTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.discountForm.valid) {      
      // const outputParams = this.discountForm.value;

        const branchid = this.saveBranchId;
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.discountForm.value,
      discountto:this.discountForm.value.discountto || null,
      discountfrom:this.discountForm.value.discountfrom || null,
      branchid: branchid,
      outletid: outletid
    };
      console.log(outputParams, 'outputParams');

      const request$ =  outputParams.discountid && outputParams.discountid !== 0 ? this.query.updateDiscount(outputParams) :this.query.addDiscount(outputParams)

      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.discountModalRef?.hide();
          this.getdiscountList(); // Refresh list
          this.changeDetectRef.detectChanges();
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','Discount has been updated successfully');  
        },
        error: (err: any) => {
           this.discountModalRef?.hide();
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

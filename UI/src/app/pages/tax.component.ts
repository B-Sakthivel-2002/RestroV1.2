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
  selector: 'app-tax',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,BranchSelectComponent,BranchNamePipe],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Tax</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(taxTemplate);settaxList('create',0);">+ Create Tax</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">Id</th>                       
                        <th scope="col">Tax Name</th>   
						            <th scope="col">Tax Rate</th> 
                        <th>Tax Type</th>
                        <th>Range status</th>
                        <th scope="col">Range From</th> 
                        <th scope="col">Range To</th> 
                        @if(isOutletOwner){<th scope="col">Branch</th>}
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of taxList; track fs.taxid){
                      <tr>
                       
                          <td>{{fs.taxid}}</td>
                          <td>{{fs.taxname}}</td>     
						              <td>{{fs.taxrate}}</td>     		
                          <td>{{fs.taxtype}}</td> 
                           <td>{{fs.taxrangestatus}}</td> 
                          <td>{{fs.taxfrom ? fs.taxfrom :'-'}}</td> 
                          <td>{{fs.taxto ? fs.taxto :'-'}}</td> 
                          			  
                          @if(isOutletOwner){<td>{{fs.branchid | branchName | async}}</td>}
                          			  
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="settaxList('edit',fs.taxid);openModal(taxTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.taxid)">
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

    
     
     <ng-template #taxTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{taxFormTitle}} Tax</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="taxModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="taxForm"  *ngIf="taxForm">
            @if(!branchLocked){<app-branch-select [(branchId)]="saveBranchId"></app-branch-select>} 
            
            <div class="row mb-3">
              <div class="col-md-4">
                <label for="taxname" name="taxname" class="col-form-label">Tax Name</label>
                <input type="text" value="" class="form-control" formControlName="taxname" />
                <div *ngIf="taxForm.get('taxname')?.invalid && taxForm.get('taxname')?.touched">
                  <small class="text-danger">Tax name is required.</small>
                </div>
              </div>
              <div class="col-md-4">
                <label for="taxrate" name="taxrate" class="col-form-label">Tax Rate</label>
                <input type="text" value="" class="form-control" formControlName="taxrate" />
                <div *ngIf="taxForm.get('taxrate')?.invalid && taxForm.get('taxrate')?.touched">
                  <small class="text-danger">Tax rate is required.</small>
                </div>
              </div>
              <div class="col-md-4">
                <label>
                  <input type="checkbox" formControlName="taxrangestatus" /> Enable Tax Range
                </label>
                  <!--
                <label for="taxrangestatus" name="taxrangestatus" class="col-form-label">Range status</label>
                <select id="taxrangestatus" formControlName="taxrangestatus">
                  <option value='true'>On</option>
                  <option value='false'>Off</option>
                </select>
                <div *ngIf="taxForm.get('taxrangestatus')?.invalid && taxForm.get('taxrangestatus')?.touched">
                  <small class="text-danger">Range status is required.</small>
                </div>
                  -->
              </div>
            </div>
                  
            <div class="row mb-3">
               <div class="col-md-4">
                  <label for="taxtype" name="taxtype" class="col-form-label">Type</label>
                 
                 <select id="taxtype" formControlName="taxtype" class="form-control">
                  <option value="percentage" >Percentage (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
              <!--  <input type="text" value="" class="form-control" formControlName="taxtype" />-->
                <div *ngIf="taxForm.get('taxtype')?.invalid && taxForm.get('taxtype')?.touched">
                  <small class="text-danger">Tax type is required.</small>
                </div>
              </div>
              <div class="col-md-4">
                <label for="taxfrom" name="taxfrom" class="col-form-label">From</label>
                <input type="number" value="" class="form-control" formControlName="taxfrom"  />
                <div *ngIf="taxForm.get('taxfrom')?.invalid && taxForm.get('taxfrom')?.touched">
                  <small class="text-danger">Range From is required.</small>
                </div>
              </div>
              <div class="col-md-4">
                <label for="taxto" name="taxto" class="col-form-label">To</label>
                <input type="number" value="" class="form-control" formControlName="taxto" />
                <div *ngIf="taxForm.get('taxto')?.invalid && taxForm.get('taxto')?.touched">
                  <small class="text-danger">Range To is required.</small>
                </div>
              </div>
            </div>
            
            <div class="row mb-3">              
              <div *ngIf="taxForm.errors">                   
                  <small *ngIf="taxForm.errors?.['taxRangeInvalid']">Tax From must be less than Tax To</small>
                </div>
                <div class="col-md-12">
                  <div class="alert alert-info">  
                    <small>Note: If the tax range is enabled, the tax will be applied only when the order amount falls within the specified range. <br><br>
                    Examples:<br>
                    Order Amount: ₹1000, Tax Type: Flat (₹2) → Final Amount = ₹1002<br>
                    Order Amount: ₹1000, Tax Type: 2% → Tax = ₹2, Final Amount = ₹1020<br><br>
                    Please confirm the Tax Rate and Tax Type (Percentage / Flat).</small>
                  </div>
                </div>
            </div>

            </form>
       </div>
       <div class="modal-footer"  *ngIf="taxForm">
            <button type="submit" [disabled]="taxForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="taxModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class TaxComponent {
  // An outlet owner (SuperAdmin) sees every branch's records and picks the branch a new one is saved to;
  // everyone else only works with their own branch (the API enforces this).
  isOutletOwner = inject(AuthService).isOutletOwner();
  saveBranchId = Number(localStorage.getItem('branchid') || 1);
  branchLocked = false;

  taxList:any=[];  
  taxForm!:FormGroup;
  taxFormTitle:String ='Create';
  taxModalRef?: BsModalRef;
  constructor(private changeDetectRef: ChangeDetectorRef, private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  initialTaxFormValues = {
    taxid: 0,
    taxname: '',
    taxrate: 0,
    taxtype: 'percentage',
    taxrangestatus:false,
    taxfrom: '',
    taxto: ''
  };

  ngOnInit(): void {
    
    this.gettaxList();

    this.taxForm = this.fb.group({
	      taxid:[this.initialTaxFormValues.taxid],
        taxname:[this.initialTaxFormValues.taxname,Validators.required],
		    taxrate:[this.initialTaxFormValues.taxrate,[Validators.required,
          Validators.pattern(/^\d+(\.\d{1,2})?$/)  // Accepts numbers like 10.00
        ]],
        taxtype:[this.initialTaxFormValues.taxtype,Validators.required],
        taxrangestatus:[this.initialTaxFormValues.taxrangestatus,Validators.required],
        taxfrom:[this.initialTaxFormValues.taxfrom],
        taxto:[this.initialTaxFormValues.taxto]
    })

    this.validateRangeStatus();

   
  }

  checkType(value: any) {
     return typeof value;
  }


  validateRangeStatus(){
    this.taxForm.get('taxrangestatus')?.valueChanges.subscribe((status: boolean) => {
      console.log(status,'status');
        const taxfrom = this.taxForm.get('taxfrom');
        const taxto = this.taxForm.get('taxto');

        if (status) {
          taxfrom?.setValidators([Validators.required]);
          taxto?.setValidators([Validators.required]);
          taxfrom?.enable();
          taxto?.enable();
        } else {
          taxfrom?.clearValidators();
          taxto?.clearValidators();
          taxfrom?.setValue(this.initialTaxFormValues.taxfrom);
          taxto?.setValue(this.initialTaxFormValues.taxto);
          taxfrom?.disable();
          taxto?.disable();
        }

        taxfrom?.updateValueAndValidity();
        taxto?.updateValueAndValidity();
      });

      this.taxForm.get('taxfrom')?.valueChanges.pipe(debounceTime(100)).subscribe(() => {
        this.checkTaxRangeValidity();
      });

      this.taxForm.get('taxto')?.valueChanges.pipe(debounceTime(100)).subscribe(() => {
        this.checkTaxRangeValidity();
      });
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.taxModalRef = this.modalService.show(template);
  }

  checkTaxRangeValidity() {
  const status = this.taxForm.get('taxrangestatus')?.value;
  const from = parseFloat(this.taxForm.get('taxfrom')?.value);
  const to = parseFloat(this.taxForm.get('taxto')?.value);

  console.log(status,from,to,!isNaN(from),!isNaN(to),'--->status --from -- to')

  const currentErrors = this.taxForm.errors || {};

    if (from >= to && status) {
      this.taxForm.setErrors({ ...currentErrors, taxRangeInvalid: true });
    } else {
      const { taxRangeInvalid, ...others } = currentErrors;
      const newErrors = Object.keys(others).length > 0 ? others : null;
      this.taxForm.setErrors(newErrors);
    }

  // if (status && !isNaN(from) && !isNaN(to)) {
  //   if (from >= to) {
  //     console.log('err--')
  //     this.taxForm.setErrors({ taxRangeInvalid: true });
  //   } else {
  //     this.taxForm.setErrors(null);
  //   }
  // } else {
  //   console.log('checking');
  //   this.taxForm.setErrors(null);
  // }
}
  

  gettaxList(){    
    
    this.stateService.setLoadingState(true);
   
    this.query.getTax(false, true).pipe(
      finalize(() => {
        this.stateService.setLoadingState(false);
      })
    ).subscribe({
      next:((res:any)=>{
        this.taxList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      })
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the tax',()=>{
      console.log('confirmed');
      this.deletetaxList(id);
    });
  }


  deletetaxList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deleteTax(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
         this.gettaxList(); // Refresh list
          this.changeDetectRef.detectChanges();
        this.alertService.showAlert('Alert !','Tax has been deleted');
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


  settaxList(flag: string, inputId: number) {

    this.taxFormTitle = flag;
  
    if (flag === 'create') {
  
      this.saveBranchId = Number(localStorage.getItem('branchid') || 1);
  
      this.branchLocked = false;
      this.taxForm.reset(this.initialTaxFormValues);
      console.log(this.taxForm);
    } else if (flag === 'edit') {
      this.branchLocked = true;
      const localtaxForm = this.taxList.filter((x: any) => x.taxid === inputId);
  
      if (localtaxForm && localtaxForm.length > 0) {
        console.log(localtaxForm[0],'localtaxForm[0]');
        let localFlag = localtaxForm[0].taxfrom &&  localtaxForm[0].taxto ? true :false;
        //console
        this.taxForm.patchValue({
          taxid: localtaxForm[0].taxid,
          taxname: localtaxForm[0].taxname,
		      taxrate: localtaxForm[0].taxrate,
          taxtype:localtaxForm[0].taxtype,
          taxfrom:localtaxForm[0].taxfrom,
          taxto:localtaxForm[0].taxto,
          taxrangestatus: localtaxForm[0].taxrangestatus
        });
      } else {
        console.error('tax data not found for id:', inputId);
      }
    }
    //this.openModal(taxTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.taxForm.valid) {      
      // const outputParams = this.taxForm.value;
    const branchid = this.saveBranchId;
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.taxForm.value,
       taxfrom: this.taxForm.value.taxfrom || null,
       taxto: this.taxForm.value.taxto || null,
      branchid: branchid,
      outletid: outletid
    };
       const request$ = outputParams.taxid && outputParams.taxid !== 0 ? this.query.updateTax(outputParams) : this.query.addTax(outputParams);


      console.log(outputParams, 'outputParams');
      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.taxModalRef?.hide();
          this.gettaxList(); // Refresh list
          this.changeDetectRef.detectChanges();
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','tax has been updated successfully');          
        },
        error: (err: any) => {
          this.taxModalRef?.hide();
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

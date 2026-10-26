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
  selector: 'app-menu-type',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,BranchSelectComponent,BranchNamePipe],
  providers:[BsModalService,AlertService],
  template: `
 <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Menu Type</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(menutypeTemplate);setmenutypeList('create',0);">+ Create Menu Type</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">Id</th>                       
                        <th scope="col">Menu Type Name</th>   
                        @if(isOutletOwner){<th scope="col">Branch</th>}
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of menutypeList; track fs.menutypeId){
                      <tr>
                       
                          <td>{{fs.mealtypeid}}</td>
                          <td>{{fs.mealtypename}}</td>                         
                          @if(isOutletOwner){<td>{{fs.branchid | branchName | async}}</td>}
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="setmenutypeList('edit',fs.mealtypeid);openModal(menutypeTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.mealtypeid)">
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

    
     
     <ng-template #menutypeTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{menutypeFormTitle}} menutype</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="menutypeModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="menutypeForm"  *ngIf="menutypeForm">
            @if(!branchLocked){<app-branch-select [(branchId)]="saveBranchId"></app-branch-select>} 
            
            <div class="row mb-3">
              <div class="col-md-12">
                <label for="mealtypename" name="mealtypename" class="col-form-label">Menu Type Name</label>
                <input type="text" value="" class="form-control" formControlName="mealtypename" />
                <div *ngIf="menutypeForm.get('mealtypename')?.invalid && menutypeForm.get('mealtypename')?.touched">
                  <small class="text-danger">Menu type name is required.</small>
                </div>
              </div>
            </div>
			
            </form>
       </div>
       <div class="modal-footer"  *ngIf="menutypeForm">
            <button type="submit" [disabled]="menutypeForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="menutypeModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class MenuTypeComponent {
  // An outlet owner (SuperAdmin) sees every branch's records and picks the branch a new one is saved to;
  // everyone else only works with their own branch (the API enforces this).
  isOutletOwner = inject(AuthService).isOutletOwner();
  saveBranchId = Number(localStorage.getItem('branchid') || 1);
  branchLocked = false;

  menutypeList:any=[];  
  menutypeForm!:FormGroup;
  menutypeFormTitle:String ='Create';
  menutypeModalRef?: BsModalRef;

  initialMenuForm ={
    mealtypeid:0,
    mealtypename:''
  }
  constructor(private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getmenutypeList();

    this.menutypeForm = this.fb.group({
	    mealtypeid:[this.initialMenuForm.mealtypeid],
        mealtypename:[this.initialMenuForm.mealtypename,Validators.required]
    })

   
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.menutypeModalRef = this.modalService.show(template);
  }
  

  getmenutypeList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getMenuTypes(true).subscribe({
      next:((res:any)=>{
        this.menutypeList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the menutype',()=>{
      console.log('confirmed');
      this.deletemenutypeList(id);
    });
  }


  deletemenutypeList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deletMenuType(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getmenutypeList();
        this.alertService.showAlert('Alert !','menutype has been deleted');
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


  setmenutypeList(flag: string, inputId: number) {

    this.menutypeFormTitle = flag;
  
    if (flag === 'create') {
  
      this.saveBranchId = Number(localStorage.getItem('branchid') || 1);
  
      this.branchLocked = false;
      this.menutypeForm.reset(this.initialMenuForm);
      console.log(this.menutypeForm);
    } else if (flag === 'edit') {
      this.branchLocked = true;
      const localmenutypeForm = this.menutypeList.filter((x: any) => x.mealtypeid === inputId);
  
      if (localmenutypeForm && localmenutypeForm.length > 0) {
        this.menutypeForm.patchValue({
          mealtypeid: localmenutypeForm[0].mealtypeid,
          mealtypename: localmenutypeForm[0].mealtypename
        });
      } else {
        console.error('menutype data not found for id:', inputId);
      }
    }
    //this.openModal(menutypeTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.menutypeForm.valid) {      
      // const outputParams = this.menutypeForm.value;
  const branchid = this.saveBranchId;
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.menutypeForm.value,
      branchid: branchid,
      outletid: outletid
    };
      const request$ = outputParams.mealtypeid && outputParams.mealtypeid !==0 ? this.query.updateMenuType(outputParams): this.query.addMenuType(outputParams);
      console.log(outputParams, 'outputParams');
      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.menutypeModalRef?.hide();
          this.getmenutypeList(); // Refresh list
           this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','Meny Type has been updated successfully');  


        },
        error: (err: any) => {
          this.menutypeModalRef?.hide();
           this.stateService.setLoadingState(false);
          this.alertService.showAlert('Error!',err.message);
        },
        complete: () => { this.stateService.setLoadingState(false);}
      });
     
    }

   

  }
  
  
}

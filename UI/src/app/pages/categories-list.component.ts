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
import { isExpressStallType } from '../core/constants/Appsettings';


@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,BranchSelectComponent,BranchNamePipe],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Categories</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(categoryTemplate);setCategoiresDetail('create',0);">+ Add Category</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>      
                        <th scope="col">Category Id</th>
                        <th scope="col">Category Name</th> 
                        <th scope="col">Status</th>
                        @if(hasExpressStall){<th scope="col">Express Stall</th>}
                        @if(isOutletOwner){<th scope="col">Branch</th>}
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of categoriesList; track fs.categoiresId){
                      <tr>
                          <td>{{fs.categoryid}}</td>
                          <td>{{fs.categoryname}}</td>
                           <td [ngClass]="fs.flag ? 'status-on' : 'status-off'">{{fs.flag ? 'On' : 'Off'}}</td>
                           @if(hasExpressStall){<td [ngClass]="fs.expressstall ? 'status-on' : 'status-off'">{{fs.expressstall ? 'Yes' : 'No'}}</td>}
                          @if(isOutletOwner){<td>{{fs.branchid | branchName | async}}</td>}
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="setCategoiresDetail('edit',fs.categoryid);openModal(categoryTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.categoryid)">
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

    
     
     <ng-template #categoryTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{categoiresFormTitle}} category</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="categoryModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
       <!-- <pre>{{ categoiresForm?.value | json }}</pre> -->

          <form  [formGroup]="categoiresForm"  *ngIf="categoiresForm">
            @if(!branchLocked){<app-branch-select [(branchId)]="saveBranchId"></app-branch-select>} 

            <div class="row mb-3">
              <div class="col-md-12">
                <label for="categoryname" name="categoryname" class="col-form-label">Category Name</label>
                <input type="text" value="" class="form-control" formControlName="categoryname" />
                <div *ngIf="categoiresForm.get('categoryname')?.invalid && categoiresForm.get('categoryname')?.touched">
                  <small class="text-danger">category name is required.</small>
                </div>
              </div>                         
            </div>

            <div class="row mb-3">
            <!--  <div class="col-md-6">
                <label for="branchid" name="branchid" class="col-form-label">Branch Id</label>
                <select formControlName="branchid">
                  @for(br of branchList; track br.branchid){
                    <option [value]="br.branchid">{{br.branchname}}</option>
                  }                    
                  </select>
              </div> -->
              <div class="col-md-6">
                  <div class="form-check form-switch">
                    <label class="form-check-label me-2" for="flag">
                      Status
                    </label>

                    <input
                      class="form-check-input"
                      type="checkbox"
                      id="flag"
                      formControlName="flag"
                    />
                  </div>
                </div>
              @if(hasExpressStall){
              <div class="col-md-6">
                  <div class="form-check form-switch">
                    <label class="form-check-label me-2" for="expressstall">
                      Express Stall
                    </label>

                    <input
                      class="form-check-input"
                      type="checkbox"
                      id="expressstall"
                      formControlName="expressstall"
                    />
                  </div>
                </div>
              }

              <!-- <div class="col-md-6">
                <label for="flag" name="flag" class="col-form-label">Status</label>
                <input type="checkbox" value="" formControlName="flag" />
              </div> -->

              
            </div>

            </form>
       </div>
       <div class="modal-footer"  *ngIf="categoiresForm">
            <button type="submit" [disabled]="categoiresForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="categoryModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class CategoriesListComponent {
  // An outlet owner (SuperAdmin) sees every branch's records and picks the branch a new one is saved to;
  // everyone else only works with their own branch (the API enforces this).
  isOutletOwner = inject(AuthService).isOutletOwner();
  saveBranchId = Number(localStorage.getItem('branchid') || 1);
  branchLocked = false;
  categoriesList:any=[];  
  categoiresForm!:FormGroup;
  categoiresFormTitle:String ='Create';
  categoryModalRef?: BsModalRef;
  branchList:any[]=[];
  hasExpressStall = false;
  initialCategoryForm ={
      categoryid:0,
      categoryname:'',
      branchid:1,
      flag:true,
      expressstall:false
  }
  constructor(private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getCategoriesList();
    this.getBranchList();
    // the Express Stall flag only matters when the outlet has the Express Stall order type
    this.query.getOrderTypes().subscribe({
      next: (res: any) => this.hasExpressStall = (res.data || []).some((ot: any) => isExpressStallType(ot)),
      error: () => {}
    });

    this.categoiresForm = this.fb.group({	
      categoryid:[this.initialCategoryForm.categoryid],
      categoryname:[this.initialCategoryForm.categoryname,Validators.required],
      branchid:[this.initialCategoryForm.branchid,Validators.required],
      flag:[this.initialCategoryForm.flag,Validators.required  ],
      expressstall:[this.initialCategoryForm.expressstall]
    })
  }


    getBranchList(){

    this.stateService.setLoadingState(true);

    this.query.getBranchList().subscribe({
      next:((res:any)=>{
        console.log(res,'--get-branch-res');
        this.branchList = res.data;
        this.stateService.setLoadingState(false);
        
      }),
      error:((err:any)=>{
        console.log(err);
        this.stateService.setLoadingState(false);
      })
    })

  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.categoryModalRef = this.modalService.show(template);
  }
  

  getCategoriesList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getCategories(true).subscribe({
      next:((res:any)=>{
        this.categoriesList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the category',()=>{
      console.log('confirmed');
      this.deleteCategoiresDetail(id);
    });
  }


  deleteCategoiresDetail(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deletecategory(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getCategoriesList();
        this.alertService.showAlert('Alert !','Category has been deleted');
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


  setCategoiresDetail(flag: string, inputId: number) {

    this.categoiresFormTitle = flag;
  
    if (flag === 'create') {
  
      this.saveBranchId = Number(localStorage.getItem('branchid') || 1);
  
      this.branchLocked = false;
      this.categoiresForm.reset(this.initialCategoryForm);
    } else if (flag === 'edit') {
      this.branchLocked = true;
      const localcategoiresForm = this.categoriesList.filter((x: any) => x.categoryid === inputId);
  
      if (localcategoiresForm && localcategoiresForm.length > 0) {
        this.categoiresForm.patchValue({
          categoryid: localcategoiresForm[0].categoryid,
          categoryname: localcategoiresForm[0].categoryname,
          flag:localcategoiresForm[0].flag,
          expressstall:!!localcategoiresForm[0].expressstall,
        });
      } else {
        console.error('Category data not found for id:', inputId);
      }
    }
    //this.openModal(categoryTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.categoiresForm.valid) {
      
    const branchid = this.saveBranchId;
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.categoiresForm.value,
      branchid: branchid,
      outletid: outletid
    };

      console.log(outputParams, 'outputParams');

      const request$ = outputParams.categoryid && outputParams.categoryid !==0 ? this.query.updateCategory(outputParams): this.query.addCategory(outputParams);

      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.categoryModalRef?.hide();
          this.getCategoriesList(); // Refresh list
        },
        error: (err: any) => {
          this.categoryModalRef?.hide();
          console.error(err, '--err-categories');
        },
        complete: () => this.stateService.setLoadingState(false)
      });
     
    }
    if(this.categoiresFormTitle=='create'){
      this.alertService.showAlert('Success!','Category has been created successfully');
    }else{
      this.alertService.showAlert('Success!','Category has been updated successfully');
    }

  }
  
  
}

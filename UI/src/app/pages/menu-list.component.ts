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
  selector: 'app-menu-list',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,BranchSelectComponent,BranchNamePipe],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Menu</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(menuTemplate);setmenuList('create',0);">+ Create menu</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">Id</th>
                        <th scope="col">Category Id</th> 
                        <th scope="col">Category Name</th>
                        <th scope="col">Kitchen</th>
                        <th scope="col">Menu Name</th>     
                        <th scope="col">Description</th>     
                        <th scope="col">Current Price</th>      
                         <th scope="col">Code</th>
                         <th scope="col">Status</th>  
                        @if(isOutletOwner){<th scope="col">Branch</th>}
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of menuList; track fs.menuId){
                      <tr>
                       
                          <td>{{fs.itemid}}</td>
                          <td>{{fs.categoryid}}</td>
                          <td>{{fs.categoryname}}</td>
                          <td [class.text-danger]="!fs.kitchenname">{{fs.kitchenname || 'Not set'}}</td>
                          <td>{{fs.itemname}}</td>
                          <td>{{fs.description	}}</td>
                          <td>{{fs.defaultprice}}</td>
                             <td>{{fs.code}}</td>
                             <td [ngClass]="fs.active ? 'status-on' : 'status-off'">{{fs.active ? 'On' : 'Off'}}</td>
                          @if(isOutletOwner){<td>{{fs.branchid | branchName | async}}</td>}
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="setmenuList('edit',fs.itemid);openModal(menuTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.itemid)">
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

    
     
     <ng-template #menuTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{menuFormTitle}} menu</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="menuModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="menuForm"  *ngIf="menuForm">
            @if(!branchLocked){<app-branch-select [(branchId)]="saveBranchId"></app-branch-select>} 

           
            <div class="row mb-3">
              <div class="col-md-6">
                <label for="itemname" name="itemname" class="col-form-label">Menu Name</label>
                <input type="text" value="" class="form-control" formControlName="itemname" />
                <div *ngIf="menuForm.get('itemname')?.invalid && menuForm.get('itemname')?.touched">
                  <small class="text-danger">Menu name is required.</small>
                </div>
              </div>


              <div class="col-md-6">
                <label for="description" name="description" class="col-form-label">Description</label>
                <input type="text" value="" class="form-control" formControlName="description" />
                <div *ngIf="menuForm.get('description')?.invalid && menuForm.get('description')?.touched">
                  <small class="text-danger">description is required.</small>
                </div>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-4">
                <label for="defaultprice" name="defaultprice" class="col-form-label">Current Price</label>
                <input type="text" value="" class="form-control" formControlName="defaultprice" />
                <div *ngIf="menuForm.get('defaultprice')?.invalid && menuForm.get('defaultprice')?.touched">
                  <small class="text-danger">Price is required.</small>
                </div>
              </div>

              <div class="col-md-4">
                <label for="categoryid" name="categoryid" class="col-form-label">Category Id</label>
                <select formControlName="categoryid" >
                  @for(cs of categoriesForBranch(); track cs.categoryid){
                   <option [value]="cs.categoryid">{{cs.categoryname}}</option>
                  }
                  </select>                
                <div *ngIf="menuForm.get('categoryid')?.invalid && menuForm.get('categoryid')?.touched">
                  <small class="text-danger">category id required.</small>
                </div>
              </div>

              <div class="col-md-4">
                <label for="code" name="code" class="col-form-label">Code</label>
                <input type="text" value="" class="form-control" formControlName="code" />
                <div *ngIf="menuForm.get('code')?.invalid && menuForm.get('code')?.touched">
                  <small class="text-danger">code id required.</small>
                </div>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-6">
                <label for="kitchenid" class="col-form-label">Kitchen</label>
                <select id="kitchenid" class="form-select" formControlName="kitchenid">
                  <option [ngValue]="null" disabled>Select kitchen</option>
                  @for(k of kitchensForBranch(); track k.kitchenid){
                    <option [ngValue]="k.kitchenid">{{k.kitchenname}} ({{k.printername}})</option>
                  }
                </select>
                @if(kitchensForBranch().length === 0){
                  <small class="text-danger">No active kitchen in this branch. Create one under Master &gt; Kitchens.</small>
                } @else if(menuForm.get('kitchenid')?.invalid && menuForm.get('kitchenid')?.touched){
                  <small class="text-danger">Kitchen is required.</small>
                }
              </div>
            </div>

            <div class="row mb-3">
                <div class="col-md-6">
                  <div class="form-check form-switch">
                    <label class="form-check-label me-2" for="active">
                      Status
                    </label>

                    <input
                      class="form-check-input"
                      type="checkbox"
                      id="active"
                      formControlName="active"
                    />
                  </div>
                </div>
            </div>

            
            </form>
       </div>
       <div class="modal-footer"  *ngIf="menuForm">
            <button type="submit" [disabled]="menuForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="menuModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class MenuListComponent {
  // An outlet owner (SuperAdmin) sees every branch's records and picks the branch a new one is saved to;
  // everyone else only works with their own branch (the API enforces this).
  isOutletOwner = inject(AuthService).isOutletOwner();
  saveBranchId = Number(localStorage.getItem('branchid') || 1);
  branchLocked = false;

  // An item must use a category of the branch it is saved to.
  categoriesForBranch(): any[] {
    return this.isOutletOwner ? this.categoriesList.filter((c: any) => c.branchid === this.saveBranchId) : this.categoriesList;
  }

  // The item's KOT prints in this kitchen; only active kitchens of the item's branch can be chosen.
  kitchensList:any[]=[];
  kitchensForBranch(): any[] {
    return this.kitchensList.filter((k: any) => k.status && (!this.isOutletOwner || k.branchid === this.saveBranchId));
  }

  menuList:any=[];  
  menuForm!:FormGroup;
  menuFormTitle:String ='Create';
  menuModalRef?: BsModalRef;
  categoriesList:any[]=[];
  initialMenuForm ={
      itemid:0,
      categoryid:1,
      itemname:'',         
      description:'',
	    defaultprice:'',
      qty:1,
      code:'',
      active:true,
      kitchenid:null as number | null
  }
  constructor(private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getmenuList();

    this.getCategoriesList();
    this.query.getKitchens(true).subscribe({
      next:(res:any)=>{ this.kitchensList = res.data || []; },
      error:()=>{ this.kitchensList = []; }
    });

    this.menuForm = this.fb.group({
	    itemid:[this.initialMenuForm.itemid],
      categoryid:[this.initialMenuForm.categoryid,[Validators.required,Validators.pattern(/^\d+$/)]],
      itemname:[this.initialMenuForm.itemname,Validators.required],         
      description:[this.initialMenuForm.description,Validators.required],
	    defaultprice: [this.initialMenuForm.defaultprice, [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)  ]],
      qty:[this.initialMenuForm.qty]  ,
      code:[this.initialMenuForm.code,Validators.required],
      active:[this.initialMenuForm.active],
      kitchenid:[this.initialMenuForm.kitchenid,Validators.required]
    })

   // this.menuForm.get('categoryid')?.setValue('2');
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.menuModalRef = this.modalService.show(template);
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
  

  getmenuList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getMenus(true).subscribe({
      next:((res:any)=>{
        this.menuList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the menu',()=>{
      console.log('confirmed');
      this.deletemenuList(id);
    });
  }


  deletemenuList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deleteMenu(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getmenuList();
        this.stateService.setLoadingState(false);
        this.alertService.showAlert('Alert !','menu has been deleted');
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


  setmenuList(flag: string, inputId: number) {

    this.menuFormTitle = flag;
  
    if (flag === 'create') {
  
      this.saveBranchId = Number(localStorage.getItem('branchid') || 1);
  
      this.branchLocked = false;
      this.menuForm.reset(this.initialMenuForm);
      console.log(this.menuForm);
    } else if (flag === 'edit') {
      this.branchLocked = true;
      const localmenuForm = this.menuList.filter((x: any) => x.itemid === inputId);
      if (localmenuForm && localmenuForm.length > 0) {
        this.saveBranchId = localmenuForm[0].branchid;
      }
  
      if (localmenuForm && localmenuForm.length > 0) {
        this.menuForm.patchValue({
          itemid: localmenuForm[0].itemid,
          categoryid: localmenuForm[0].categoryid,
          itemname: localmenuForm[0].itemname,
          description: localmenuForm[0].description,
          defaultprice: localmenuForm[0].defaultprice,
          qty:localmenuForm[0].qty,
          code:localmenuForm[0].code,
          active:localmenuForm[0].active,
          kitchenid:localmenuForm[0].kitchenid ?? null
        });
      } else {
        console.error('menu data not found for id:', inputId);
      }
    }
    //this.openModal(menuTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.menuForm.valid) {      
      // const outputParams = this.menuForm.value;

    const branchid = this.saveBranchId;
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.menuForm.value,
      branchid: branchid,
      outletid: outletid
    };
      console.log(outputParams, 'outputParams');

      const request$ = outputParams.itemid && outputParams.itemid !==0 ? this.query.updateMenu(outputParams) : this.query.addMenu(outputParams);
      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.menuModalRef?.hide();
          this.getmenuList(); // Refresh list
          this.stateService.setLoadingState(false);
           this.alertService.showAlert('Success!','menu has been created successfully');
        },
        error: (err: any) => {
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Error!', err?.error?.message || err.message);
          console.error(err, '--err-categories');
        },
        complete: () => {this.stateService.setLoadingState(false);}
      });
      
    }

  

  }
  
  
}

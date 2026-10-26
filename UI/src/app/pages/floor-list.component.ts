import { Component,OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Form, Validators } from '@angular/forms';
import { StateService } from '@appservices/state.service';
import { ChangeDetectorRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';
import { finalize } from 'rxjs';


@Component({
  selector: 'app-floor-list',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Floor</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(floorTemplate);setfloorList('create',0);">+ Create floor</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                         <th scope="col">Branch Id</th>
                        <th scope="col">Floor Id</th>
                        <th scope="col">Floor Name</th>
                        <th scope="col">Capacity</th>
                        <th scope="col" >Description</th>
                        <th scope="col" >Status</th>                        
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of floorList; track fs.floorid){
                      <tr>
                       
                           <td>{{fs.floorid}}</td>
                          <td>{{fs.branchid}}</td>
                          <td>{{fs.floorname}}</td>
                          <td>{{fs.capacity}}</td>
                          <td>{{fs.description}}</td>
                          <td [ngClass]="fs.status ? 'status-on' : 'status-off'">{{fs.status ? 'On' : 'Off'}} </td>
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="setfloorList('edit',fs.floorid);openModal(floorTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.floorid)">
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

    
     
     <ng-template #floorTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{floorFormTitle}} floor</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="floorModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="floorForm"  *ngIf="floorForm"> 

            <div class="row mb-3">

              <div class="col-md-6">
                <label for="floorname" name="floorname" class="col-form-label">Floor Name </label>
                <input type="text" value="" class="form-control" formControlName="floorname" />
                <div *ngIf="floorForm.get('floorname')?.invalid && floorForm.get('floorname')?.touched">
                  <small class="text-danger">Floor name is required.</small>
                </div>
              </div>

              <div class="col-md-6">
                <label for="capacity" name="capacity" class="col-form-label">Capacity</label>
                <input type="text" value="" class="form-control" formControlName="capacity" />
                <div *ngIf="floorForm.get('capacity')?.invalid && floorForm.get('capacity')?.touched">
                  <small class="text-danger">Capacity is required.</small>
                </div>
              </div>

            </div>
            <div class="row mb-3">
              


              <div class="col-md-12">
                <label for="description" name="description" class="col-form-label">Description</label>
                <input type="text" value="" class="form-control" formControlName="description" />
                <div *ngIf="floorForm.get('description')?.invalid && floorForm.get('description')?.touched">
                  <small class="text-danger">Description is required.</small>
                </div>
              </div>
            </div>

            <div class="row mb-3">
              <div class="col-md-12">


                    <!-- 
                  <label for="status" name="status" class="col-form-label">
                   <input type="checkbox" value=""  formControlName="status" />
                   Status</label>      -->

                    <div class="form-check form-switch">

                      <label class="form-check-label me-2" for="status">
                        Status
                      </label>
                      <input
                        class="form-check-input"
                        type="checkbox"
                        id="status"
                        formControlName="status"
                      />

                    </div>

                <div *ngIf="floorForm.get('status')?.invalid && floorForm.get('status')?.touched">
                  <small class="text-danger">Status is required.</small>
                </div>
              </div>
            </div>		
			 
             
            </form>
       </div>
       <div class="modal-footer"  *ngIf="floorForm">
            <button type="submit" [disabled]="floorForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="floorModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class FloorListComponent {

  floorList:any=[];  
  floorForm!:FormGroup;
  floorFormTitle:String ='Create';
  floorModalRef?: BsModalRef;
  constructor(private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getfloorList();

    this.floorForm = this.fb.group({
	  floorid:[0],
	  branchid:[1],
    floorname:['',Validators.required],    	
      capacity:[1,[Validators.required,Validators.pattern(/^\d+$/)]],     
      description:['',Validators.required],
	  status: [true],  
    })

   // this.floorForm.get('categoryId')?.setValue('2');
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.floorModalRef = this.modalService.show(template);
  }
  

  getfloorList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getFloors().subscribe({
      next:((res:any)=>{
        this.floorList = res.data;
        console.log(res,'res-frefsh'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the floor',()=>{
      console.log('confirmed');
      this.deletefloorList(id);
    });
  }


  deletefloorList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deleteFloor(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getfloorList();
        this.alertService.showAlert('Alert !','floor has been deleted');
        this.stateService.setLoadingState(false);
      }),
      error:((err:any)=>{
        console.log(err,'err');
        this.stateService.setLoadingState(false);
        this.alertService.showAlert('Error !',err.message);
      }),
      complete: (() => {
        console.log('completed');        
        this.stateService.setLoadingState(false);
      })
    })
    
  }


  setfloorList(flag: string, inputId: number) {

    this.floorFormTitle = flag;
  
    if (flag === 'create') {
      this.floorForm.reset({
        floorid: 0,
        branchid: 1,
        floorname: '',
        capacity: 1,
        description: '',
        status: true
      });      
      console.log(this.floorForm);
    } else if (flag === 'edit') {
      const localfloorForm = this.floorList.filter((x: any) => x.floorid === inputId);

      console.log(localfloorForm[0],'localfloorForm[0]');
  
      if (localfloorForm && localfloorForm.length > 0) {
        this.floorForm.patchValue({
          floorid: localfloorForm[0].floorid,
          floorname:localfloorForm[0].floorname,         
          description: localfloorForm[0].description,       
          status: localfloorForm[0].status,
        });
         // categoryId: localfloorForm[0].categoryId,
          // itemName: localfloorForm[0].itemName,
             // defaultPrice: localfloorForm[0].defaultPrice,
         console.log(this.floorForm,'floorForm');
       
      } else {
        console.error('floor data not found for id:', inputId);
      }
    }
    //this.openModal(floorTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.floorForm.valid) {      
      // const outputParams = this.floorForm.value;
    const branchid = Number(localStorage.getItem('branchid') || 1);
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.floorForm.value,
      branchid: branchid,
      outletid: outletid
    };
      console.log(outputParams, 'outputParams');

      const request$ =  outputParams.floorid && outputParams.floorid !==0 ?  this.query.updateFloor(outputParams) : this.query.addFloor(outputParams);

     request$.pipe(finalize(() => {
          this.stateService.setLoadingState(false);
          this.floorModalRef?.hide();
          this.query.clearTableCache();
        })
      )
      .subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');

          this.getfloorList(); // Refresh list
          this.cdref.detectChanges();

          this.alertService.showAlert(
            'Success!',
            'Floor List has been updated successfully'
          );
        },

        error: (err: any) => {
          console.error(err, '--err-categories');
          this.alertService.showAlert(
            'Error!',
            err?.message || 'Something went wrong'
          );
        }
      });



    
    }

   

  }
  
  
}

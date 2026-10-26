import { Component,OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Form, Validators } from '@angular/forms';
import { StateService } from '@appservices/state.service';
import { ChangeDetectorRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';


@Component({
  selector: 'app-waiter',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Waiter</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(waiterTemplate);setWaiterList('create',0);">+ Create waiter</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">Waiter Id</th>
                        <th scope="col">Name</th> 
                        <th scope="col">Contact Number</th>     
                        <th scope="col">Shift</th>     
                        <th scope="col">Date of Joining</th>      
                        <th scope="col">Status</th>    
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of waiterList; track fs.waiterid){
                      <tr>                       
                          <td>{{fs.waiterid}}</td>
                          <td>{{fs.waitername	}}</td>
                          <td>{{fs.contactnumber}}</td>
                          <td>{{fs.shift}}</td>
                          <td>{{fs.datejoined	 | date:'dd-MM-yyyy' }}</td>
                           <td [ngClass]="fs.status? 'status-on': 'status-off'">{{fs.status ? 'On' : 'Off'}}</td>
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="setWaiterList('edit',fs.waiterid);openModal(waiterTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.waiterid)">
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

    
     
     <ng-template #waiterTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{waiterFormTitle}} waiter</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="waiterModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="waiterForm"  *ngIf="waiterForm"> 

            <div class="row mb-3">

              <div class="col-md-6">
                <label for="waitername" name="waitername" class="col-form-label">Waiter Name</label>
                <input type="text" value="" class="form-control" formControlName="waitername" />
                <div *ngIf="waiterForm.get('waitername')?.invalid && waiterForm.get('waitername')?.touched">
                  <small class="text-danger">Waiter name is required.</small>
                </div>
              </div>

              <div class="col-md-6">
                <label for="contactnumber" name="contactnumber" class="col-form-label">Waiter Contact Number</label>
                <input type="text" value="" class="form-control" formControlName="contactnumber" />
                <div *ngIf="waiterForm.get('contactnumber')?.invalid && waiterForm.get('contactnumber')?.touched">
                  <small class="text-danger">Contact Number is required.</small>
                </div>
              </div>

            </div>
            <div class="row mb-3">
              
              <div class="col-md-4">
                <label class="col-form-label">Shift</label> <br>
                <select formControlName="shift">
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                  </select>
              </div>

               <div class="col-md-4">
                <label class="col-form-label">Date of Joining</label>
                <input type="date" formControlName="datejoined">
              </div>

              <div class="col-md-4">
                <label class="col-form-label">Status</label>
                <input type="checkbox" formControlName="status">
              </div>
            </div>

            
             
            </form>
       </div>
       <div class="modal-footer"  *ngIf="waiterForm">
            <button type="submit" [disabled]="waiterForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="waiterModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class WaiterComponent {
  waiterList:any=[];  
  waiterForm!:FormGroup;
  waiterFormTitle:String ='Create';
  waiterModalRef?: BsModalRef;
initialWaiterForm ={
  waiterid:0,
  waitername:'',
  contactnumber:'',
  shift:'Morning',
  datejoined: new Date(),
  status:true
}

  constructor(private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getWaiterList();

    this.waiterForm = this.fb.group({
      waiterid:[this.initialWaiterForm.waiterid],
      waitername:[this.initialWaiterForm.waitername,Validators.required],
      shift:[this.initialWaiterForm.shift],
      contactnumber: [this.initialWaiterForm.contactnumber, [Validators.required, Validators.pattern(/^\d+$/)]],   
      datejoined:[this.initialWaiterForm.datejoined,Validators.required],
      status:[this.initialWaiterForm.status]
    })
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.waiterModalRef = this.modalService.show(template);
  }
  

  getWaiterList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getWaiters().subscribe({
      next:((res:any)=>{
        this.waiterList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the waiter',()=>{
      console.log('confirmed');
      this.deleteWaiterList(id);
    });
  }


  deleteWaiterList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deleteWaiter(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getWaiterList();
        this.stateService.setLoadingState(false);
        this.alertService.showAlert('Alert !','waiter has been deleted');
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


  setWaiterList(flag: string, inputId: number) {

    this.waiterFormTitle = flag;
  
    if (flag === 'create') {
      this.waiterForm.reset(this.initialWaiterForm);
      console.log(this.waiterForm);
    } else if (flag === 'edit') {
      const localwaiterForm = this.waiterList.filter((x: any) => x.waiterid === inputId);
  
      if (localwaiterForm && localwaiterForm.length > 0) {
        this.waiterForm.patchValue({
          waiterid: localwaiterForm[0].waiterid,
          waitername: localwaiterForm[0].waitername,
          contactnumber: localwaiterForm[0].contactnumber,
          shift: localwaiterForm[0].shift,
          datejoined: localwaiterForm[0].datejoined,
          status: localwaiterForm[0].status,
        });
      } else {
        console.error('waiter data not found for id:', inputId);
      }
    }
    //this.openModal(waiterTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.waiterForm.valid) {      
      // const outputParams = this.waiterForm.value;
    const branchid = Number(localStorage.getItem('branchid') || 1);
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.waiterForm.value,
      branchid: branchid,
      outletid: outletid
    };
      console.log(outputParams, 'outputParams');

      const request$ = outputParams.waiterid && outputParams.waiterid !==0 ? this.query.updateWaiter(outputParams) : this.query.addWaiter(outputParams);

      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.waiterModalRef?.hide();
          this.getWaiterList(); // Refresh list
            this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','Waiter List has been updated successfully');  
        },
        error: (err: any) => {
          this.waiterModalRef?.hide();
            this.stateService.setLoadingState(false);
          this.alertService.showAlert('Error!',err.message);
          console.error(err, '--err-categories');
        },
        complete: () => {}
      });
      this.stateService.setLoadingState(false);
    }


  }
  
  
}

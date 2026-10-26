import { Component,OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Form, Validators } from '@angular/forms';
import { StateService } from '@appservices/state.service';
import { ChangeDetectorRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';


@Component({
  selector: 'app-order-type',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  providers:[BsModalService,AlertService],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Order Type</h2>
                  </div>  
                  <div class="btn-bg">
                    <!-- <button type="button" class="btn btn-primary" (click)="openModal(ordertypeTemplate);setordertypeList('create',0);">+ Create order Type</button>  -->
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">Id</th>                       
                        <th scope="col">Order Type Name</th>   
                        <th scope="col">Status</th>
                        <!-- <th scope="col" style="width:200px" >Action</th> -->
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of ordertypeList; track fs.ordertypeid){
                      <tr>
                       
                          <td>{{fs.ordertypeid}}</td>
                          <td>{{fs.ordertypename}}</td>  
                          <td>{{fs.status}}</td>      
                          <!--                  
                          <td class="custom-btn">  
                           <button type="button" class="btn btn-primary" (click)="setordertypeList('edit',fs.ordertypeid);openModal(ordertypeTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button> 
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.ordertypeid)">
                                <i class="pi pi-trash " ></i>
                            </button>
                          </td>-->
                      </tr>
                    }
                      
                      
                    </tbody>
                  </table>
              </div>              
            </div>


    </div>

    
     
     <ng-template #ordertypeTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{ordertypeFormTitle}} Order Type</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="ordertypeModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="ordertypeForm"  *ngIf="ordertypeForm"> 
            
            <div class="row mb-3">
              <div class="col-md-12">
                <label for="ordertypename" name="ordertypename" class="col-form-label">Order Type Name</label>
                <input type="text" value="" class="form-control" formControlName="ordertypename" />
                <div *ngIf="ordertypeForm.get('ordertypename')?.invalid && ordertypeForm.get('ordertypename')?.touched">
                  <small class="text-danger">order type name is required.</small>
                </div>
              </div>
            </div>
		<div class="row mb-3">
  <div class="col-md-12">
    <div class="form-check">
      <input
        type="checkbox"
        class="form-check-input"
        id="status"
        formControlName="status"
      />
      <label class="form-check-label" for="status">
        Active
      </label>
    </div>
  </div>
</div>


            </form>
       </div>
       <div class="modal-footer"  *ngIf="ordertypeForm">
            <button type="submit" [disabled]="ordertypeForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="ordertypeModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class OrderTypeComponent {

  ordertypeList:any=[];  
  ordertypeForm!:FormGroup;
  ordertypeFormTitle:String ='Create';
  ordertypeModalRef?: BsModalRef;
  initialFormValue ={
    ordertypeid:0,
    ordertypename:'',
     status: true 
  }
  constructor(private changeDetectRef:ChangeDetectorRef, private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getordertypeList();

    this.ordertypeForm = this.fb.group({
	    ordertypeid:[this.initialFormValue.ordertypeid],
        ordertypename:[this.initialFormValue.ordertypename,Validators.required],
         status: [this.initialFormValue.status]
    })

   
  }

  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.ordertypeModalRef = this.modalService.show(template);
  }
  

  getordertypeList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getOrderTypes().subscribe({
      next:((res:any)=>{
        this.ordertypeList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the ordertype',()=>{
      console.log('confirmed');
      this.deleteordertypeList(id);
    });
  }


  deleteordertypeList(id:Number){
    if(id==1 || id==2){
      return;
    }
    this.stateService.setLoadingState(true);
    this.query.deletOrderType(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.getordertypeList();
        this.changeDetectRef.detectChanges();
        this.alertService.showAlert('Alert !','ordertype has been deleted');
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


  setordertypeList(flag: string, inputId: number) {

    this.ordertypeFormTitle = flag;
  
    if (flag === 'create') {
      this.ordertypeForm.reset(this.initialFormValue);
      console.log(this.ordertypeForm);
    } else if (flag === 'edit') {
      const localordertypeForm = this.ordertypeList.filter((x: any) => x.ordertypeid === inputId);
  
      if (localordertypeForm && localordertypeForm.length > 0) {
        this.ordertypeForm.patchValue({
          ordertypeid: localordertypeForm[0].ordertypeid,
          ordertypename: localordertypeForm[0].ordertypename,
          status: !!localordertypeForm[0].status
        });
      } else {
        console.error('ordertype data not found for id:', inputId);
      }
    }
    //this.openModal(ordertypeTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
      
    if (this.ordertypeForm.valid) {      
      // const outputParams = this.ordertypeForm.value;
       const branchid = Number(localStorage.getItem('branchid') || 1);
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.ordertypeForm.value,
      branchid: branchid,
      outletid: outletid
    };
      
      console.log(outputParams, 'outputParams');

        if(outputParams.ordertypeid==1 || outputParams.ordertypeid==2){
            this.stateService.setLoadingState(false);
          return;
          
        }

      const request$ = outputParams.ordertypeid && outputParams.ordertypeid !== 0 ? this.query.updateOrderType(outputParams) : this.query.addOrderType(outputParams) ;

      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.ordertypeModalRef?.hide();
          this.getordertypeList(); // Refresh list
          this.changeDetectRef.detectChanges();
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','tax has been updated successfully');  
        },
        error: (err: any) => {
          this.ordertypeModalRef?.hide();
          console.error(err, '--err-categories');
          this.stateService.setLoadingState(false);
           this.alertService.showAlert('Error!',err.message);
        },
        complete: () => {
           this.stateService.setLoadingState(false);
        }
      });
     
    }



  }
  
  
}

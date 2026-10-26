import { Component,OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Form, Validators } from '@angular/forms';
import { StateService } from '@appservices/state.service';
import { ChangeDetectorRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';


@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  providers:[BsModalService,AlertService],
  template: `  
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Table</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(tableTemplate);settableList('create',0);">+ Create table</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                         <th scope="col">Id</th>
                        <th scope="col">Floor Id</th>
                        <th scope="col">table Name</th>
                        <th scope="col">Seats</th>
                        <th scope="col" >Description</th>
                        <th scope="col" >Status</th>                        
                        <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of tableList; track fs.tableid){
                      <tr>
                       
                           <td>{{fs.tableid}}</td>
                          <td>{{fs.floorid}}</td>
                          <td>{{fs.tablename}}</td>
                          <td>{{fs.capacity}}</td>
                          <td>{{fs.description}}</td>
                          <td [ngClass]="fs.status ? 'status-on' : 'status-off'">{{fs.status ? 'On' : 'Off'}}</td>
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="settableList('edit',fs.tableid);openModal(tableTemplate);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.tableid)">
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

    
     
     <ng-template #tableTemplate>
       <div class="modal-header">
         <h4 class="modal-title pull-left">{{tableFormTitle}} table</h4>
         <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="tableModalRef?.hide();">
           <span aria-hidden="true" class="visually-hidden">&times;</span>
         </button>
       </div>
       <div class="modal-body">
          <form  [formGroup]="tableForm"  *ngIf="tableForm"> 

            <div class="row mb-3">

              <div class="col-md-6">
                <label for="tablename" name="tablename" class="col-form-label">Table name </label>
                <input type="text" value="" class="form-control" formControlName="tablename" />
                <div *ngIf="tableForm.get('tablename')?.invalid && tableForm.get('tablename')?.touched">
                  <small class="text-danger">tablename is required.</small>
                </div>
              </div>
              <div class="col-md-6">
                    <label for="floorid" name="floorid" class="col-form-label"> Floor List</label> <br>
                    <select formControlName="floorid">
                      {{floorList | json}}
                     @for(fl of floorList; track fl.floorid){
                        <option [value]="fl.floorid">{{ fl.floorname }}</option>
                      }
                    </select>
              </div>
              
            </div>
            <div class="row mb-3">
              <div class="col-md-6">
                <label for="capacity" class="col-form-label">Seats</label>
                <input id="capacity" type="number" min="1" max="50" class="form-control" formControlName="capacity" />
                <div *ngIf="tableForm.get('capacity')?.invalid && tableForm.get('capacity')?.touched">
                  <small class="text-danger">Seats must be between 1 and 50.</small>
                </div>
              </div>
            </div>
            <div class="row mb-3">
              <div class="col-md-8">
                <label for="description" name="description" class="col-form-label">Description</label>
                <input type="text" value="" class="form-control" formControlName="description" />
                <div *ngIf="tableForm.get('description')?.invalid && tableForm.get('description')?.touched">
                  <small class="text-danger">description is required.</small>
                </div>
              </div>
              <div class="col-md-4">
                <label for="status" name="status" class="col-form-label">
                   <input type="checkbox" value=""  formControlName="status" />
                   Status</label>
              </div>
            </div>
            </form>
       </div>
       <div class="modal-footer"  *ngIf="tableForm">
            <button type="submit" [disabled]="tableForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>            
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="tableModalRef?.hide()">Close</button>
          </div>
     </ng-template>   
  `,
  styles: ``
})
export class TableComponent {

  tableList:any=[];  
  tableForm!:FormGroup;
  tableFormTitle:String ='Create';
  tableModalRef?: BsModalRef;
  floorList:any[] =[];
  constructor(private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.gettableList();
    this.getfloorList();

    this.tableForm = this.fb.group({
	     tableid:[0],
	     floorid:[1],
       tablename:['',Validators.required],    	     
       description:['',Validators.required],
	     status: [true],
       capacity: [4, [Validators.required, Validators.min(1), Validators.max(50)]],
    })

   // this.tableForm.get('categoryid')?.setValue('2');
  }


    getfloorList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getFloors().subscribe({
      next:((res:any)=>{
        this.floorList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }


  openModal(template: TemplateRef<void>) {
    if (!template) {
      console.error('TemplateRef is undefined');
      return;
    }
    this.tableModalRef = this.modalService.show(template);
  }
  

  gettableList(){    
    this.stateService.setLoadingState(true);
   
    this.query.getTable().subscribe({
      next:((res:any)=>{
        this.tableList = res.data;
        console.log(res,'res'); 
      }),
      error:((err:any)=>{        
      }),
      complete: () => this.stateService.setLoadingState(false)
    })
    
  }

  
  getConfirmMessage(id:Number){
    this.alertService.showAlert('Confirmation !','Do you want to delete the table',()=>{
      console.log('confirmed');
      this.deletetableList(id);
    });
  }


  deletetableList(id:Number){
    this.stateService.setLoadingState(true);
    this.query.deleteTable(id).subscribe({
      next:((res:any)=>{
        console.log(res,'result');
        this.gettableList();
        this.alertService.showAlert('Alert !','table has been deleted');
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


  settableList(flag: string, inputId: number) {

    this.tableFormTitle = flag;
  
    if (flag === 'create') {
      this.tableForm.reset({
        tableid: 0,
        floorid: 1,
        tablename: '',       
        description: '',
        status: true,
        capacity: 4
      });
      console.log(this.tableForm);
    } else if (flag === 'edit') {
      const localtableForm = this.tableList.filter((x: any) => x.tableid === inputId);
  
      if (localtableForm && localtableForm.length > 0) {
        this.tableForm.patchValue({
          tableid: localtableForm[0].tableid,
          tablename:localtableForm[0].tablename,
          floorid: localtableForm[0].floorid,
          status: localtableForm[0].status,
          capacity: localtableForm[0].capacity || 4,
          categoryid: localtableForm[0].categoryid,
          itemname: localtableForm[0].itemname,
          description: localtableForm[0].description,
          defaultprice: localtableForm[0].defaultprice,
        });
      } else {
        console.error('table data not found for id:', inputId);
      }
    }
    //this.openModal(tableTemplate);
  }

  onHandleSubmit() {
    this.stateService.setLoadingState(true);
    if (this.tableForm.valid) {      
      // const outputParams = this.tableForm.value;
         const branchid = Number(localStorage.getItem('branchid') || 1);
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.tableForm.value,
      branchid: branchid,
      outletid: outletid
    };
      console.log(outputParams, 'outputParams');

      const request$ = outputParams.tableid && outputParams.tableid!==0 ? this.query.updateTable(outputParams): this.query.addTable(outputParams);

      request$.subscribe({
        next: (res: any) => {
          console.log(res, '--set-categories');
          this.tableModalRef?.hide();
          this.gettableList(); // Refresh list
           this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','Table has been updated successfully');  
        },
        error: (err: any) => {
          this.tableModalRef?.hide();
           this.stateService.setLoadingState(false);
          this.alertService.showAlert('Error!',err.message);
          console.error(err, '--err-categories');
        },
        complete: () => { this.stateService.setLoadingState(false);}
      });
     
    }

    
  }
  
  
}

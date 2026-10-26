import { Component,OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Form, Validators,FormsModule, AbstractControl } from '@angular/forms';
import { StateService } from '@appservices/state.service';
import { ChangeDetectorRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AlertService } from '@appservices/alert.service';


@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule,FormsModule],
  providers:[BsModalService,AlertService],
  template: `
   <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Users</h2>
                  </div>  
                  <div class="btn-bg">
                    <button type="button" class="btn btn-primary" (click)="openModal(userTemplate,'user');setUserList('create',0);">+ Create user</button> 
                  </div>           
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>                        
                        <th scope="col">User Id</th>
                        <th scope="col">User name</th> 
                        <th scope="col">Password</th>     
                        <th scope="col">Role</th>     
                        <th scope="col">Branch Name</th>
                         <th scope="col" style="width:200px" >Status</th>
                        <th scope="col" style="width:200px" >Role</th>
                          <th scope="col" style="width:200px" >Action</th>
                      </tr>
                    </thead>
                    <tbody>

                    @for(fs of userList; track fs.userid){
                      <tr>                       
                          <td>{{fs.userid}}</td>
                          <td>{{fs.username	}}</td>
                          <td>{{fs.password}}</td>       
                           <td>{{fs.role}}</td>          
                           <td>{{fs.branchName}}</td>                
                          <td [ngClass]="fs.status? 'status-on': 'status-off'">{{fs.status ? 'On' : 'Off'}}</td>
                          <td>
                            <button type="button" class="btn btn-primary" (click)="openModal(roleTemplate,'role');setRoleList('edit',fs.userid);">
                                <i class="pi pi-file-edit " ></i>
                                <span>Edit Role</span>
                            </button>
                            <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.userid,'role')">
                                <i class="pi pi-trash " ></i>
                                <span>Delete Role</span>
                            </button>
                          </td>
                          <td class="custom-btn">  
                            <button type="button" class="btn btn-primary" (click)="openModal(userTemplate,'user');setUserList('edit',fs.userid);">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                           <button type="button" class="btn btn-danger" (click)="getConfirmMessage(fs.userid,'user')">
                                <i class="pi pi-trash " ></i>
                            </button>

                            
                          </td>
                      </tr>
                    }
                      
                      
                    </tbody>
                  </table>
              </div>              
            </div>

            <ng-template #userTemplate>
                <div class="modal-header">
                  <h4 class="modal-title pull-left">{{formType}} user</h4>
                  <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="userModalRef?.hide();">
                    <span aria-hidden="true" class="visually-hidden">&times;</span>
                  </button>
                </div>
                <div class="modal-body">
                      <form  [formGroup]="userForm"  *ngIf="userForm">             
                        <div class="row mb-3">
                          <div class="col-md-6">
                            <label for="username" name="username" class="col-form-label required">User Name <span class="req-char">(Max 6 characters )</span></label>
                            <input type="text" value="" class="form-control" formControlName="username" />
                            <div *ngIf="userForm.get('username')?.invalid && 
           (userForm.get('username')?.touched || userForm.get('username')?.value)">
                              <small class="text-danger">user name is required.</small>
                            </div>
                          </div>
                          <div class="col-md-6">
                            <label for="password" name="password" class="col-form-label required">Password <span class="req-char">(Max 6 characters )</span></label>
                            <input type="password" value="" class="form-control" formControlName="password" />
                            <div *ngIf="userForm.get('password')?.invalid && userForm.get('password')?.touched">
                              <small class="text-danger">user rate is required.</small>
                            </div>
                          </div>
                          
                        </div>
                       		
                        <div class="row mb-3">
                            <div class="col-md-6">
                              <!-- {{userForm.get('branchid')?.value}} -->
                                      <label for="branchid" name="branchid" class="col-form-label required" >Type</label>                 
                                    <select id="branchid" formControlName="branchid" class="form-control">
                                       <option value="-1">Select</option>
                                      @for(branch  of branchList; track branch.branchid){
                                         <option [value]="branch.branchid" >{{branch.branchname}} {{branch.branchid}}</option>
                                      }                                      
                                     
                                    </select>       
                                    <div *ngIf="userForm.get('branchid')?.invalid && userForm.get('branchid')?.touched">                                    
                                      <div *ngIf="userForm.get('branchid')?.hasError('invalidBranch') && userForm.get('branchid')?.touched">
                                        <small class="text-danger">Please select a valid branch. </small>
                                      </div>
                                    </div>
                                    
                            </div>            
                              <div class="row mb-3">        
                                <!-- {{userForm.invalid}}       -->
                                <div *ngIf="userForm.errors">                   
                                    <small *ngIf="userForm.errors?.['userRangeInvalid']">user From must be less than user To</small>
                                  </div>
                              </div>           
                        </div>
                            
                       
                        </form>
                  </div>    
                   <div class="modal-footer"  *ngIf="userForm">
                              <button type="submit" [disabled]="userForm.invalid" class="btn btn-primary" (click)="onHandleSubmit(this.formType)">Save</button>            
                              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="userModalRef?.hide()">Close</button>
                        </div>   
            </ng-template>


            <ng-template #roleTemplate>
                <div class="modal-header">
                  <h4 class="modal-title pull-left">{{roleType}} Role</h4>
                  <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="userModalRef?.hide();">
                    <span aria-hidden="true" class="visually-hidden">&times;</span>
                  </button>
                </div>
                <div class="modal-body">
                      <form  [formGroup]="roleForm"  *ngIf="roleForm">             
                        <div class="row mb-3">
                          <div class="col-md-6">
                           
                            <label for="username" name="username" class="col-form-label">User Name</label>
                            <input type="text" value="" class="form-control" formControlName="username" />
                            <div *ngIf="userForm.get('username')?.invalid && userForm.get('username')?.touched">
                              <small class="text-danger">user name is required.</small>
                            </div>
                          </div>
                          <div class="col-md-6">
                            <label for="userid" name="userid" class="col-form-label">User Id</label>
                            <input type="text" value="" class="form-control" formControlName="userid" />
                            <div *ngIf="roleForm.get('userid')?.invalid && roleForm.get('userid')?.touched">
                              <small class="text-danger">user id is required.</small>
                            </div>
                          </div>
                        </div>			
                        <div class="row mb-3">
                            <div class="col-md-6">
                                      <label for="roleid" name="roleid" class="col-form-label">Role Type</label>                 
                                    <select id="roleid" formControlName="roleid" class="form-control">
                                       <option value="-1">Select</option>
                                      @for(role  of roleList; track role.roleid){
                                         <option [value]="role.roleid" >{{role.rolename}}</option>
                                      }                                      
                                     
                                    </select>           
                                    <div *ngIf="roleForm.get('roleid')?.invalid && roleForm.get('roleid')?.touched">                                    
                                      <div *ngIf="roleForm.get('roleid')?.hasError('invalidBranch') && roleForm.get('roleid')?.touched">
                                        <small class="text-danger">Please select a valid role. </small>
                                      </div>
                                    </div>
                                    
                            </div> 
                        </div>
                         
                        </form>
                  </div>  
                  <div class="modal-footer"  *ngIf="roleForm">
                              <button type="submit" [disabled]="roleForm.invalid" class="btn btn-primary" (click)="onHandleRoleSubmit()">Save</button>            
                              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" (click)="roleModalRef?.hide()">Close</button>
                        </div>     
            </ng-template>


    </div>

  `,
  styles: ``
})
export class UsersComponent implements OnInit {

  userList:any[]=[];
  branchList:any[]=[];
  roleList:any[]=[];
  userForm!:FormGroup;
  roleForm!:FormGroup;
  userFormTitle:String ='Create';
  userModalRef?: BsModalRef;
  roleModalRef?:BsModalRef;
  formType:string ='create';
  roleType:string='create';

  initialUserFormValues = {
    userid: 0,
    username: '',
    password: '',
    status: true,
    branchid:-1
  };

  initalRoleValue ={
    userid:0,
    username:'',
    roleid:0

  }

  constructor(private alertService: AlertService,private modalService: BsModalService,private query:QueryService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private stateService:StateService){

  }

  ngOnInit(): void {
    
    this.getUsersList();

    this.getBranchList();

    this.getRolesList();

    this.userForm = this.fb.group({
      userid: [this.initialUserFormValues.userid],
      username: [
        this.initialUserFormValues.username,
        [Validators.required, Validators.minLength(6)]
      ],
      password: [
        this.initialUserFormValues.password,
        [Validators.required, Validators.minLength(6)]
      ],
      status: [this.initialUserFormValues.status],
      branchid: [
        this.initialUserFormValues.branchid,
        [Validators.required, this.notMinusOneValidator]
      ],
    });


    this.roleForm = this.fb.group({
      userid:[this.initalRoleValue.userid,[Validators.required]],
      roleid:[this.initalRoleValue.roleid,[Validators.required,this.notMinusOneValidator]],
      username:[this.initalRoleValue.username]
    })
  }

  notMinusOneValidator(control: AbstractControl) {
       return control.value == -1 ? { invalidBranch: true } : null;
  }



    getConfirmMessage(id:Number,type:'user' | 'role'){
      if(type =='user'){
         this.alertService.showAlert('Confirmation !','Do you want to delete the user',()=>{
          console.log('confirmed');
          this.deletefloorList(id);
        });
      }else  if(type =='role'){
         this.alertService.showAlert('Confirmation !','Do you want to delete the role',()=>{
          console.log('confirmed');
          this.deleteroleList(id);
        });
      }
    // this.alertService.showAlert('Confirmation !','Do you want to delete the user',()=>{
    //   console.log('confirmed');
    //   this.deletefloorList(id);
    // });
  }


  getRolesList(){
    this.query.getRoleList().subscribe({
      next:((res:any)=>{
          this.roleList = res.data;
      }),
      error:((res:any)=>{
      })
    })
  }


    deletefloorList(id:Number){
      this.stateService.setLoadingState(true);
      this.query.deleteUser(id).subscribe({
        next:((res:any)=>{
          console.log(res,'result');
          this.getUsersList();
          this.alertService.showAlert('Alert !','user has been deleted');
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

   deleteroleList(id:Number){
      this.stateService.setLoadingState(true);
      this.query.deleteRole(id).subscribe({
        next:((res:any)=>{
          console.log(res,'result');
          this.getUsersList();
          this.alertService.showAlert('Alert !','role has been deleted');
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

      openModal(template: TemplateRef<void>, type: 'user' | 'role') {
        if (!template) {
          console.error('TemplateRef is undefined');
          return;
        }

        const modalRef = this.modalService.show(template);

        if (type === 'user') {
          this.userModalRef = modalRef;
        } else {
          this.roleModalRef = modalRef;
        }
}
  
  setUserList(flag: string, inputId: number) {

      console.log(inputId,'inputId');
     if (flag === 'create') {
      this.userForm.reset(this.initialUserFormValues);
      this.formType = 'create';
      console.log(this.userForm);
    }else{
       this.formType = 'edit';

        const localUserList = this.userList.filter((x: any) => x.userid === inputId);
  
      if (localUserList && localUserList.length > 0) {
        this.userForm.patchValue({
          userid: localUserList[0].userid,
          username:localUserList[0].username,
          password: localUserList[0].password,
          status: localUserList[0].status,
          branchid: localUserList[0].branchid ? localUserList[0].branchid : -1
        });
      } else {
        console.error('floor data not found for id:', inputId);
      }

    }

  }

  setRoleList(flag: string, inputId: number) {

      this.roleType = 'edit';
      const localroleList = this.userList.filter((x: any) => x.userid === inputId);  

      console.log(localroleList,'localroleList');
      console.log(this.userList,'this.userList');


      if (localroleList && localroleList.length > 0) {
        this.roleForm.patchValue({
		  userid: localroleList[0].userid,
          roleid: localroleList[0].roleId ? localroleList[0].roleId : -1,
          username:localroleList[0].username,
        });

        console.log(this.roleForm,'this.roleForm');
      } else {
        console.error('role data not found for id:', inputId);
      }
    //   console.log(inputId,'inputId');
    //  if (flag === 'create') {
    //   this.roleForm.reset(this.initalRoleValue);
    //   this.roleType = 'create';
    //   console.log(this.roleForm);
    // }else{
     

    // }

  }


  getBranchList(){
    this.query.getBranches().subscribe({
      next:((res:any)=>{
        this.branchList = res.data;
      }),
      error:((err:any)=>{

      })
    })

  }


  getUsersList(){
    this.query.getUserList().subscribe({
  
      next:((res:any)=>{

        this.userList = res.data;
        console.log(res,'userlist');

      }),
      error:((err:any)=>{

      }),
      complete:(()=>{})
    })    
  }

  onHandleSubmit(flag:string){

    this.stateService.setLoadingState(true);
    let localquery;



    if (this.userForm.valid) {    

    //const branchid = Number(localStorage.getItem('branchid') || 1);
    //const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.userForm.value,  
    };

      if(flag=='create'){
        localquery =  this.query.createUsers(outputParams);

      }else if(flag=='edit'){
          localquery =  this.query.updateUsers(outputParams);
      }

    

      localquery?.subscribe({
        next:((res:any)=>{
          this.userModalRef?.hide();
          console.log('success');
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','User detail has been updated successfully');  
          this.getUsersList();
        }),
        error:((err:any)=>{
          this.userModalRef?.hide();
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Error!',err.message);
        })
      })

    }

  }

  onHandleRoleSubmit(){

    this.stateService.setLoadingState(true);


    if (this.roleForm.valid) {    

   const branchid = Number(localStorage.getItem('branchid') || 1);
    const outletid = Number(localStorage.getItem('outletid') || 1);

    const outputParams = {
      ...this.roleForm.value,
      branchid: branchid,
      outletid: outletid
    };
      this.query.updateRoles(outputParams).subscribe({
        next:((res:any)=>{
          this.roleModalRef?.hide();
          console.log('success');
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Success!','Role detail has been updated successfully');  
          this.getUsersList();
        }),
        error:((err:any)=>{
          this.roleModalRef?.hide();
          this.stateService.setLoadingState(false);
          this.alertService.showAlert('Error!',err.message);
        })
      })

    }

  }
    
   

    
   
}

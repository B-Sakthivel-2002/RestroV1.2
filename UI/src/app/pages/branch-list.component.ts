import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueryService } from '@appservices/query.service';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Form, Validators } from '@angular/forms';
import { StateService } from '@appservices/state.service';
import { ChangeDetectorRef } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '@appservices/auth.service';


@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  template: `
  <div class="wrapper">
            <div class="right-side">
              <div class="sub-header">
                  <div class="tt">
                    <h2 class="mn-tt">Branch</h2>
                  </div>             
              </div>
              <div class="cnt">
                <table class="table custom-table">
                    <thead>
                      <tr>
                        <th scope="col">Branch Id</th>
                        <th scope="col">Branch Name</th>
                        <th scope="col">Current address</th>
                        <th scope="col">Permanent address</th>
                        <th scope="col" >City</th>
                        <th scope="col" >Country</th>
                        <th scope="col" >Phone Number</th>
			<th scope="col" >Alternateive Phone Number</th>
                        <th scope="col" >Website</th>
                        <th scope="col" style="width:150px">Action</th>

                      </tr>
                    </thead>
                    <tbody>

                    @for(bs of branchList; track bs.branchid){
                      <tr>
                       
                          <td>{{bs.branchid}}</td>
                          <td>{{bs.branchname}}</td>
                          <td>{{bs.addressline1}}</td>
                          <td>{{bs.addressline2}}</td>
                          <td>{{bs.city}}</td>
                          <td>{{bs.country}}</td>
                          <td>{{bs.phone1}}</td>
                          <td>{{bs.phone2}}</td>
                          <td>{{bs.website}}</td>
                          <td class="custom-btn">                            
                           
                            <button type="button" class="btn btn-primary" (click)="setBranchDetail('edit',bs.floorId)" data-bs-toggle="modal" data-bs-target="#myModal">
                                <i class="pi pi-file-edit " ></i>
                            </button>
                            @if(isOutletOwner){
                            <button type="button" class="btn btn-danger" (click)="deleteBranchDetail(bs.floorId)">
                                <i class="pi pi-trash " ></i>
                            </button>
                            }                            
                          </td>
                      </tr>
                    }
                      
                      
                    </tbody>
                  </table>
              </div>              
            </div>
    </div>
  `,
  styles: ``
})
export class BranchListComponent implements OnInit {
  branchList :any =[];  
  branchForm!:FormGroup;
  branchFormTitle:String ='Create';

  // Only an outlet owner (SuperAdmin) may delete branches; the API enforces this too.
  isOutletOwner = false;

  constructor(private query:QueryService,private stateService:StateService,private fb:FormBuilder,private cdref: ChangeDetectorRef,private auth:AuthService){
    this.isOutletOwner = this.auth.isOutletOwner();

  }
  ngOnInit(): void {
    this.getBranchList();
    this.branchForm = this.fb.group({
      branchid:[0],
      branchname:[1],
      addressline1:['',Validators.required],
      addressline2:['',Validators.required],
      city:['',Validators.required],
      country:['',Validators.required],
      phone1:['',Validators.required],
      phone2:['',Validators.required],
      website:['',Validators.required]
    })
  }

  getBranchList(){

    this.stateService.setLoadingState(true);

    this.query.getBranchList().pipe(
      finalize(()=>{
        this.stateService.setLoadingState(false);
      })
    ).subscribe({
      next:((res:any)=>{
        console.log(res,'--get-branch-res');
        this.branchList = res.data;       
        
      }),
      error:((err:any)=>{
        console.log(err);
      })
    })

  }

  setBranchDetail(flag:String,id:Number){
  }
  deleteBranchDetail(id:Number){
  }

}



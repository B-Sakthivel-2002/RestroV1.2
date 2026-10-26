import { Component, OnInit } from '@angular/core';
import { QueryService } from '@appservices/query.service';
import { CommonModule } from '@angular/common';
import { FormGroup,FormBuilder, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CategoryType } from 'app/core/constants/interface';
import { StateService } from '@appservices/state.service';



@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  providers:[],
  template: `
      <div class="wrapper">
        <div class="left-side">
          <ul class="menu-list">
            <li><a href="#"><i class="pi pi-calendar-clock"></i>Dashboard</a></li>
            <li><a href="#"><i class="pi pi-calendar-clock"></i>Appointments</a></li>
            <li><a href="#"><i class="pi pi-shop"></i>Bill payment</a></li>
            <li><a href="#"><i class="pi pi-chart-bar"></i>Reports</a></li>
            <li><a href="#"><i class="pi pi-cog"></i>Settings</a></li>
            <li><a href="#"><i class="pi pi-cog"></i>Bill payment</a></li>
            <li><a href="#"><i class="pi pi-cog"></i>Reports</a></li>            
          </ul>
        </div>
        <div class="right-side">

          <div class="main-title">
            <div class="row">
              <div class="col-12">
                <h2 class="sub-title">Category List</h2>
              </div>
            </div>
          </div>
          <div class="hero-content">
            <form [formGroup]="postCategoryList" (ngSubmit)="handleSubmit()" >
              <div class="filter-bg"> 
                <div class="row">
                  <div class="col-4">
                    <label>Category Name</label>
                    <input type="text" class="form-control"  formControlName="CategoryName"/>
                  </div> 
                  <div class="col-1">
                    <label>isActive</label> <br>
                    <input type="checkbox"  formControlName="IsActive" />
                  </div> 
                  <div class="col-4">
                    <div class="btn-bg">
                    {{postCategoryList.valid}}
                      <button class="btn btn-primary custom-btn" type="submit" [disabled]="!postCategoryList.valid">+ Add</button>
                    </div>
                  </div>	
                </div>
              </div>
            </form>

            <table class="table table-bordered custom-table" >
              <thead>
                <tr>
                  <th style="width:40px">ID</th>
                  <th>Category Name</th>
                  <th>IsActive</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody >
                <tr *ngFor="let list of categoryList">
                  <td >{{list.CategoryId}}</td>
                  <td>{{list.CategoryName}}</td>
                  <td>{{list?.IsActive}}</td>
                  <td></td>
                </tr>               
              </tbody>
            </table>
          </div>

        </div>
    </div>
  `,
  styles: ``
})
export class CategoryListComponent implements OnInit {

  categoryList:any =[];

  postCategoryList!:FormGroup;

  constructor(private stateService:StateService,private query:QueryService,private fb:FormBuilder){

  }

  ngOnInit(){
    this.getCategoryLists();
    this.postCategoryList = this.fb.group({    
     CategoryName:['',Validators.required],
     IsActive:[true,Validators.required]
    });
  }

  getCategoryLists(){
    this.query.getCategoryList().subscribe({
      next:((res:any)=>{
        this.categoryList = res.Categories;
        console.log(res,'result');
      }),
      error:((err:any)=>{
        console.log(err);
      })
    })
  }

  handleSubmit(){
    const formValue:CategoryType =  this.postCategoryList.value
    //AppStoreConfig.isLoading = true;
    this.stateService.setLoadingState(true);
    this.query.postCategoryList(formValue).subscribe({
      next:((res:any)=>{
        setTimeout(() => {
          this.stateService.setLoadingState(false);
        }, 3000);
       
        console.log('res',res);
      }),
      error:((err:any)=>{

      })
    })
  }

}

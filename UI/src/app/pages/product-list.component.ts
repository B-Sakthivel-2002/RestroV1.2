import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { QueryService } from '@appservices/query.service';
import { StateService } from '@appservices/state.service';
import { CategoryType } from 'app/core/constants/interface';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
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
                <h2 class="sub-title">Product List</h2>
              </div>
            </div>
          </div>
          <div class="hero-content">
            <form [formGroup]="postProductList" (ngSubmit)="handleSubmit()" >
              <div class="filter-bg"> 
                <div class="row">
                  <div class="col-3">
                    <label class="required">Product Name</label>
                    <input type="text" class="form-control" [ngClass]="getProductName?.invalid && (getProductName?.dirty || getProductName?.touched) ? 'error':''" formControlName="ProductName"/>
                    </div> 
                  <div class="col-1">
                    <label class="required">Quantity</label> <br>
                    <input type="text" class="form-control" [ngClass]="getQuantity?.invalid && (getQuantity?.dirty || getQuantity?.touched) ? 'error':''"  formControlName="Quantity"/>
                                    
                  </div> 
                  <div class="col-2">
                    <label class="required">MRP</label> <br>
                    <input type="text" class="form-control"  [ngClass]="getMRP?.invalid && (getMRP?.dirty || getMRP?.touched) ? 'error':''"  formControlName="MRP"/>
                  </div> 
                  <div class="col-1">
                    <label class="required">Discount</label> <br>
                    <input type="text" class="form-control"  [ngClass]="getDiscount?.invalid && (getDiscount?.dirty || getDiscount?.touched) ? 'error':''" formControlName="Discount"/>
                  </div> 
                  <div class="col-2">
                    <label class="required">Actual Price</label> <br>
                    <input type="text" class="form-control"   [ngClass]="getActualPrice?.invalid && (getActualPrice?.dirty || getActualPrice?.touched) ? 'error':''" formControlName="ActualPrice"/>
                  </div> 
                  <div class="col-2">
                    <label class="required">Selling Price</label> <br>
                    <input type="text" class="form-control"  [ngClass]="getSellingPrice?.invalid && (getSellingPrice?.dirty || getSellingPrice?.touched) ? 'error':''" formControlName="SellingPrice"/>
                  </div> 
                  <div class="col-1">
                    <div class="btn-bg">
                    <!--  -->
                      <button class="btn btn-primary custom-btn" type="submit" [disabled]="!postProductList.valid">Add</button>
                    </div>
                  </div>	
                </div>
              </div>
            </form>
            {{postProductList.valid}}
            
            <table class="table table-bordered custom-table" >
              <thead>
                <tr>
                  <th style="width:40px">S.No</th>
                  <th>QR Code Id</th>
                  <th>Product Id</th>
                  <th>Product Name</th>
                  <th>Quantity</th>
                  <th>MRP</th>
                  <th>Discount</th>
                  <th>Actual Price</th>
                  <th>Selling Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody >
                <tr *ngFor="let list of productList">
                  <td >{{list.s_no}}</td>
                  <td>{{list.qrcodeid}}</td>
                  <td>{{list?.productid}}</td>
                  <td>{{list?.productname}}</td>
                  <td>{{list?.quantity}}</td>
                  <td>{{list?.mrp}}</td>
                  <td>{{list?.discount}}</td>
                  <td>{{list?.actual_price}}</td>
                  <td>{{list?.selling_price}}</td>
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
export class ProductListComponent {
  productList:any =[];
  postProductList!:FormGroup;
  constructor(private stateService:StateService,private query:QueryService,private fb:FormBuilder){}

  ngOnInit(){
    this.getProductList();
    this.postProductList = this.fb.group({    
     ProductName:['',Validators.required],
     Quantity:['',[Validators.required, Validators.pattern(/^-?\d+(\.\d+)?$/)]],
     MRP:['',[Validators.required,  Validators.pattern(/^-?\d+(\.\d+)?$/)]],
     Discount:['',[Validators.required,  Validators.pattern(/^-?\d+(\.\d+)?$/)]],
     ActualPrice:['',[Validators.required, Validators.pattern(/^-?\d+(\.\d+)?$/)]],
     SellingPrice:['',[Validators.required,  Validators.pattern(/^-?\d+(\.\d+)?$/)]],    
    });
  }

  getProductList(){
    // this.query.getProductList().subscribe({
    //   next:((res:any)=>{
    //     console.log(res,'---result--->')
    //     this.productList = res.items;
    //     console.log(res,'result');
    //   }),
    //   error:((err:any)=>{
    //     console.log(err);
    //   })
    // })
  }

  get getProductName(){
    return this.postProductList.get('ProductName');
  }

  get getQuantity(){
    return this.postProductList.get('Quantity');
  }

  get getMRP(){
    return this.postProductList.get('MRP');
  }

  get getDiscount(){
    return this.postProductList.get('Discount');
  }

  get getActualPrice(){
    return this.postProductList.get('ActualPrice');
  }

  get getSellingPrice(){
    return this.postProductList.get('SellingPrice');
  }

  handleSubmit(){
    // const formValue:CategoryType =  this.postProductList.value;   
    this.stateService.setLoadingState(true);
    this.query.postProductList(this.postProductList.value).subscribe({
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

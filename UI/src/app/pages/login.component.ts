import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { QueryService } from '@appservices/query.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { StorageService } from '@appservices/storage.service';
import { StateService } from '@appservices/state.service';
import {AppSettings} from '../core/constants/Appsettings';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  template: `
    <section class="hero-login-bg">
      <div class="container-fluid">
        <div class="row">
        <div class="col-6">
            <div class="hero-login-content">
                <h2>{{appName}}</h2>
                <p>{{appDescription}}</p>
            </div>
          </div>
          <div class="col-6">
           
              <div class="hero-login">
                  <form (ngSubmit)="onSubmit()" [formGroup]="postData">
                      <!-- <h4>{{appName}}</h4> -->
                      <h2>Sign In</h2>
                      <div class="form-list">
                          <label class="sub-txt">Username or Email</label>
                          <input type="text" value="" class="form-control" formControlName="username" />
                         
                          <div *ngIf="postData.get('username')?.invalid && postData.get('username')?.touched" class="txt-error">
                            Username is required
                          </div>
                         
                          <!-- <div *ngIf="submitted && postData?.value.username?.errors.required">
                            <small >Username is required </small>
                          </div> -->
                          
                      </div>
                      <div class="form-list">
                          <label class="sub-txt">Password</label>
                          <input type="password" value=""  class="form-control" formControlName="password" />
                          <div *ngIf="postData.get('password')?.invalid && postData.get('password')?.touched" class="txt-error">
                            Password is required
                          </div>
                      </div>
                       @if(errorMessage){
                          <div class="alert alert-danger" >{{errorMessage}}</div>
                        }
                      <div class="form-list btn-bg">                          
                          <button type="submit" class="btn btn-primary" [disabled]="this.postData.invalid">Sign In</button>
                          <p class="forgot-btn"><span>Forgot password ?</span></p>
                      </div>
                  </form>
              </div>
          </div>

        </div>
      </div>
    </section>
  `,
  styles: ``
})
export class LoginComponent implements OnInit {

  postData!:FormGroup <any | undefined> ;
  submitted:boolean = false;
  errorMessage:any='';
  appName:string = AppSettings.appName;
  appDescription:string = AppSettings.appDescription;
  constructor( private stateService:StateService,private storageService:StorageService,private queryService:QueryService, private formBuilder: FormBuilder,private router: Router){}

  ngOnInit(): void {
    this.init();
  }


  init(){
    this.postData = this.formBuilder.group({
      username :[null,Validators.required],
      password:['',Validators.required]
    })
  }


  onSubmit():void{
    this.submitted  = true;

    this.stateService.setLoadingState(true);

    console.log('checking',this.postData,this.postData?.invalid);

    if(this.postData?.invalid){
      return;
    }

    let requestParam={
      username: this.postData?.value.username,
      password:this.postData?.value.password
    }
   
    this.queryService.postCheckLogin(requestParam).subscribe({
     
      next:(async (res:any)=>{
      //  console.log('checking');
       // await this.storageService.setItem('authToken',res.token);
        //await this.storageService.setItem('authUser',JSON.stringify(res.user));
        this.errorMessage='';
        if(res.status=='Success'){
          localStorage.setItem('userid', res.data.id);
          this.router.navigate(['/dashboard']);
        }else if(res.status=='Error'){
            this.errorMessage=res.message;
        }

            this.stateService.setLoadingState(false);
       // console.log(res,'result');
      }),
      error:((err:any)=>{
        this.stateService.setLoadingState(false);
      //  console.log(err,'errr');
      })
    })
  }


}

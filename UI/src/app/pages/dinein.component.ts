import { Component, OnInit } from '@angular/core';
import { QueryService } from '@appservices/query.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StateService } from '@appservices/state.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-dinein',
  standalone: true,
  imports: [CommonModule],
  template: `
      <div class="wrapper">
        
        <div class="right-side">
          <div class="custom-tabs ">
            <div class="tabs cs-tab">
              <ul class="nav nav-pills" id="pills-tab" role="tablist" >

                @for(fs of floorSource;track fs.floorid;let first = $first){
                 
                  <li class="nav-item" role="presentation">
                    <button [class]="first ? 'nav-link active':'nav-link'" [id]="'floors-'+fs.floorid+'-tab'" data-bs-toggle="pill" [attr.data-bs-target]="'#floors-'+fs.floorid" type="button" role="tab" [attr.aria-controls]="'floors-'+fs.floorid" aria-selected="false">{{fs.floorname}}</button>
                  </li>
               } 
               
              </ul>
            </div>
            <div class="tabs-list">
              
              <div class="tab-content" id="pills-tabContent">
                <!-- {{floorSource | json }}  -->
                  @for(fs of floorSource; track fs.floorid; let first = $first){
                    
                    <div [class]="first ? 'tab-pane fade active show' : 'tab-pane fade'" [id]="'floors-'+fs.floorid" role="tabpanel" [attr.aria-labelledby]="'floors-'+fs.floorid+'-tab'" tabindex="0">
                     
                        <div class="dinein-list">
                          <!-- {{tablesSource | json}} -->
                            @for(ls of tablesSource; track ls.tableid){
                              @if(fs.floorid==ls.floorid){
                                <div class="list" (click)="openTable(ls)" [ngClass]="ls.mergedinto ? 'txt-red' : ls.orderStatus=='submitted' ? 'txt-red' : ls.orderStatus=='printed' ? 'txt-green':  '' ">
                                  <div class="lft">
                                        <h2 class="mn-tt">{{ls.tablename}}</h2>

                                        @if(ls.mergedinto){
                                          <h4 class="txt-kot-bg">Merged with {{ls.mergedintoname}}</h4>
                                        } @else {
                                        <h4 [ngClass]="ls.orderStatus=='submitted' ? 'txt-kot-bg' : ls.orderStatus =='printed' ? 'txt-print-bg':'txt-avl-bg'">
                                          {{ ls.orderStatus=='submitted' ? 'Order in Kitchen' : ls.orderStatus =='printed' ? 'Ready for bill': 'Available'}}
                                        </h4>
                                        }
                                        
                                        @if(ls.orderStatus=='submitted' ||  ls.orderStatus =='printed'){
                                          <h5>Price : {{ls.orderTotalAmount}}</h5>
                                        }

                                  </div>
                                </div>
                               }
                            }

                            <!-- @if(ls.status==='occupied'){
                                  <span class="sb-tt">{{ls.occupied_by.customer_name}}</span>                                        
                                } -->
                            <!-- <div class="rgt">
                              <i class="pi pi-calendar-plus icon"></i>
                              <span class="sb-tt">{{ls.capacity}} seats</span>                                  
                              @if(ls.status==='occupied'){
                                <span class="sbb-tt nav-link" (click)="ls.flag =!ls.flag">View Reserve <span [class]="ls.flag ? 'pi pi-times-circle' : 'pi pi-arrow-circle-down'"></span></span> 
                                <div class="custom-tooltip" *ngIf="ls.flag">
                                  @for(tl of ls.occupied_by; track tl.reservation_id){
                                    <div class="tl-list">
                                        <h4>{{tl.customer_name}}</h4>
                                        <p>{{tl.start_time | date: 'MMM d, y, h:mm:ss a'}}</p>
                                    </div>
                                  }
                                </div>
                              }
                            </div> -->

                        </div>
                    </div>
                  }

               
              </div>

              
               

            </div>
          </div>
        </div>
    </div>
  `,
  styles: ``
})
export class DineinComponent implements OnInit{

  constructor(private stateService:StateService,private query:QueryService,private router:Router){}

  floorSource:any =[];
  tablesSource:any=[];

  ngOnInit(): void {
    this.getFloorsList();
    this.getTables();
  }



  getFloorsList(){
    this.query.getActiveFloors().subscribe({
      next:((res:any)=>{
        console.log(res,'dine-in status');
        // if(res.status=='success'){
        //   this.floorSource=  res.floors;
        // }

        this.floorSource = res.data;
      }),
      error:((err:any)=>{

      })
    })
  }


  getTables(){
     this.stateService.setLoadingState(true); 
    this.query.getActiveTables().pipe(
      finalize(()=>{
         this.stateService.setLoadingState(false); 
      })
    ).subscribe({
      next:(res:any)=>{
       this.tablesSource = res.data || [];     
      },
      error:(err:any)=>{   
      }
    })
  }

  // A merged table opens the main table of the merge, where its orders are.
  openTable(ls:any){
    const main = ls.mergedinto ? this.tablesSource.find((t:any)=>t.tableid===ls.mergedinto) : null;
    if(main){
      this.onHandleDineIn(main.tableid,main.floorid,main.tablename);
    } else {
      this.onHandleDineIn(ls.tableid,ls.floorid,ls.tablename);
    }
  }

  onHandleDineIn(id:Number,floor:Number,tablename:String){
    this.router.navigate(['/order/'+id+'/'+floor+'/'+1+'/'+tablename]);
  }

}

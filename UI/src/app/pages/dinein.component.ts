import { Component, OnDestroy, OnInit } from '@angular/core';
import { QueryService } from '@appservices/query.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StateService } from '@appservices/state.service';
import { LiveHubService } from '@appservices/live-hub.service';
import { Subscription, debounceTime, finalize, forkJoin, merge } from 'rxjs';

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
                    <button [class]="first ? 'nav-link active':'nav-link'" [id]="'floors-'+fs.floorid+'-tab'" data-bs-toggle="pill" [attr.data-bs-target]="'#floors-'+fs.floorid" type="button" role="tab" [attr.aria-controls]="'floors-'+fs.floorid" aria-selected="false" (click)="activeFloorId = fs.floorid">{{fs.floorname}}</button>
                  </li>
               }

                <!-- Hints: what each tile colour means, on the right of the header; counts are for the open floor -->
                <li class="tbl-legend" role="presentation" aria-label="Table colours">
                  @for(k of legend; track k.kind){
                    <span class="tbl-key" [title]="k.hint">
                      <i class="tbl-dot" [ngClass]="'d-' + k.kind"></i>{{k.label}} <b>{{ countFor(currentFloorId, k.kind) }}</b>
                    </span>
                  }
                  <button type="button" class="btn btn-outline-secondary tbl-refresh" title="Refresh tables" (click)="manualRefresh()">
                    <i class="pi pi-refresh"></i> Refresh
                  </button>
                </li>
              </ul>
            </div>
            <div class="tabs-list">
              
              <div class="tab-content" id="pills-tabContent">
                <!-- {{floorSource | json }}  -->
                  @for(fs of floorSource; track fs.floorid; let first = $first){
                    
                    <div [class]="first ? 'tab-pane fade active show' : 'tab-pane fade'" [id]="'floors-'+fs.floorid" role="tabpanel" [attr.aria-labelledby]="'floors-'+fs.floorid+'-tab'" tabindex="0">
                     
                        <div class="dinein-list">
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

                                        @if(!ls.mergedinto && ls.seatedToken){
                                          <h5 class="seated-by">Occupied by {{ls.seatedToken}}{{ ls.seatedName ? ' · ' + ls.seatedName : '' }}</h5>
                                        } @else if(!ls.mergedinto && ls.tablestate=='Reserved' && ls.tokencode){
                                          <h5 class="seated-by">Reserved for {{ls.tokencode}}</h5>
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
  styles: `
    .seated-by{font-size:12px;font-weight:600;margin:4px 0 0;opacity:.85}
    /* Hints: last item of the floor-tabs bar, pushed to the right edge; wraps under the tabs on narrow screens.
       The dots copy the existing tile colours (styles.scss .txt-red / .txt-green / .txt-avl-bg); tiles are unchanged. */
    .tbl-legend{ display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:center; gap:8px; margin-left:auto; padding-left:16px; list-style:none; }
    .tbl-key{
      display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:999px; cursor:help;
      font-size:12px; font-weight:600; color:var(--rp-text); background:var(--rp-surface); border:1px solid var(--rp-border);
    }
    .tbl-dot{ width:12px; height:12px; border-radius:4px; display:inline-block; }
    .d-avl{ background:var(--rp-surface); border:2px solid var(--rp-success); }
    .d-kitchen{ background:var(--rp-danger); }
    .d-bill{ background:var(--rp-success); }
    .d-merged{ background:var(--rp-danger-soft); border:2px solid var(--rp-danger); }
    .tbl-refresh{ display:inline-flex; align-items:center; gap:6px; padding:4px 14px; font-size:12px; font-weight:600; border-radius:999px; }
    @media (max-width: 991.98px){ .tbl-legend{ width:100%; justify-content:flex-start; margin:10px 0 0; padding-left:0; } }
  `
})
export class DineinComponent implements OnInit, OnDestroy{

  private static readonly LOADER_DELAY_MS = 300;

  constructor(private stateService:StateService,private query:QueryService,private router:Router,private hub:LiveHubService){}

  floorSource:any =[];
  tablesSource:any=[];
  private liveSub?: Subscription;

  ngOnInit(): void {
    this.loadTables();

    // Live: a KOT sent from any device (mobile app, another PC), a bill settled, a table moved / merged
    // or a waitlist change redraws the tables. A burst of events gives one quiet reload (no loader).
    this.liveSub = merge(
      this.hub.on('TableStatus'),
      this.hub.on('OrderUpdated'),
      this.hub.on('OrderSettled'),
      this.hub.on('WaitlistChanged'),
      this.hub.resync$
    ).pipe(debounceTime(400)).subscribe(() => this.refreshTables());
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
  }

  // Tables only, in the background: the floors do not change with orders.
  private refreshTables(done?: () => void){
    this.query.getActiveTables().subscribe({
      next:(res:any)=>{
        this.tablesSource = res?.data || [];
        this.query.dineinSnapshot = { floors: this.floorSource, tables: this.tablesSource };
        done?.();
      },
      error:()=> done?.()
    });
  }

  // Refresh button in the header: reloads the tables now (no full-screen loader).
  manualRefresh(){
    this.refreshTables();
  }

  // Floors and tables are drawn together. Coming back to this screen shows the last data at once and
  // swaps in the fresh data; the full-screen loader appears only when loading is actually slow.
  loadTables(){
    const last = this.query.dineinSnapshot;
    if(last){
      this.floorSource = last.floors;
      this.tablesSource = last.tables;
    }
    const slowLoader = setTimeout(()=> this.stateService.setLoadingState(true), DineinComponent.LOADER_DELAY_MS);
    forkJoin({ floors: this.query.getActiveFloors(), tables: this.query.getActiveTables() }).pipe(
      finalize(()=>{
        clearTimeout(slowLoader);
        this.stateService.setLoadingState(false);
      })
    ).subscribe({
      next:(res:any)=>{
        this.floorSource = res.floors?.data || [];
        this.tablesSource = res.tables?.data || [];
        this.query.dineinSnapshot = { floors: this.floorSource, tables: this.tablesSource };
      },
      error:(err:any)=>{
      }
    })
  }

  // Hints for the tile colours this page already uses (not changed).
  readonly legend = [
    { kind: 'avl',     label: 'Available',        hint: 'White tile: no open orders, ready for guests' },
    { kind: 'kitchen', label: 'Order in Kitchen', hint: 'Red tile: KOT sent, bill not printed yet' },
    { kind: 'bill',    label: 'Ready for bill',   hint: 'Green tile: bill printed, waiting for settlement' },
    { kind: 'merged',  label: 'Merged',           hint: 'Red tile: joined to another table; its orders are on the main table' },
  ];

  // Which hint a table falls under (same conditions as the tile colours above).
  private kindOf(t: any): string {
    if (t.mergedinto) return 'merged';
    if (t.orderStatus === 'submitted') return 'kitchen';
    if (t.orderStatus === 'printed') return 'bill';
    return 'avl';
  }

  // Floor tab that is open (the first one until another is clicked).
  activeFloorId: any = null;
  get currentFloorId(): any {
    const ids = (this.floorSource || []).map((f: any) => f.floorid);
    return ids.includes(this.activeFloorId) ? this.activeFloorId : ids[0];
  }

  countFor(floorId: any, kind: string): number {
    return (this.tablesSource || []).filter((t: any) => t.floorid == floorId && this.kindOf(t) === kind).length;
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

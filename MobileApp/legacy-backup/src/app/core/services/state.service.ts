// state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StateService {
    
  private stateSubject = new BehaviorSubject<string>('Initial State');
  public state$ = this.stateSubject.asObservable();

  private loadingState = new BehaviorSubject<boolean>(false);
  public loadingState$ = this.loadingState.asObservable();

  private alertState = new BehaviorSubject<Object>({});
  public alertState$ = this.alertState.asObservable();


  constructor() {}

//   setState(newState: string) {
//     this.stateSubject.next(newState);
//   }

//   getState(): string {
//     return this.stateSubject.value;
//   }

  setLoadingState(newState:boolean){
    this.loadingState.next(newState);
  }

  getLoadingState():boolean{
    return this.loadingState.value;
  }


 
}

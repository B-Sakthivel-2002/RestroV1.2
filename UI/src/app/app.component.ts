import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoaderComponent } from '@applayout/loader.component';
import { StateService } from '@appservices/state.service';
import { RouterModule } from '@angular/router';
import { setTheme } from 'ngx-bootstrap/utils';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,LoaderComponent,RouterModule],
  providers:[StateService],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Restaurant';
  isLoading: boolean = true;  
  customAlertMessage:any = [];

  constructor(private stateService: StateService) {
    this.getLoading();
    setTheme('bs5');
  }



  getLoading(){
    this.stateService.loadingState$.subscribe(state => {
      setTimeout(() => {
        this.isLoading = state;      
      });
    });
  }

  getAlertMessage(){
    this.stateService.alertState$.subscribe(state=>{
      this.customAlertMessage =  state;
    })
  }
  
}

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@appservices/auth.service';
import {DashboardComponent} from './dashboard.component';
import { KotListComponent } from "./kot-list.component";

@Component({
  selector: 'app-main-dashboard',
  standalone: true,
  imports: [DashboardComponent, KotListComponent],
  template: `
  @if(currentRole=='Admin' || currentRole=='SuperAdmin') {
    <app-dashboard></app-dashboard>
  }@else if (currentRole=='Chef') {
    <app-kot-list [inputIsCaptain]="false"></app-kot-list>
  }
  @else if (currentRole=='Captain') {
    <app-kot-list [inputIsCaptain]="true"></app-kot-list>
  }
    <!-- <p>
      main-dashboard works!1
    </p> -->
  `,
  styles: ``
})
export class MainDashboardComponent implements OnInit {

  currentRole:any;

  constructor(private auth: AuthService, private router: Router) { 
  }

  ngOnInit(): void {
    this.currentRole = this.auth.getUserRole();  
  }

}

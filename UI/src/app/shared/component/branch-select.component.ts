import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@appservices/auth.service';
import { QueryService } from '@appservices/query.service';

// Lets an outlet owner (SuperAdmin) choose which branch a new master record is saved to.
// Hidden for everyone else (the API always uses their own branch) and when the outlet has one branch.
@Component({
  selector: 'app-branch-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (visible) {
      <div class="row mb-3">
        <div class="col-md-6">
          <label for="saveBranch" class="col-form-label">Branch</label>
          <select id="saveBranch" class="form-control" [ngModel]="branchId" (ngModelChange)="onChange($event)" [ngModelOptions]="{standalone: true}">
            @for (br of branches; track br.branchid) {
              <option [ngValue]="br.branchid">{{ br.branchname }}</option>
            }
          </select>
        </div>
      </div>
    }
  `,
})
export class BranchSelectComponent implements OnInit {
  @Input() branchId: number | null = null;
  @Output() branchIdChange = new EventEmitter<number>();

  branches: any[] = [];
  visible = false;

  constructor(private auth: AuthService, private query: QueryService) {}

  ngOnInit(): void {
    if (!this.auth.isOutletOwner()) {
      return;
    }
    this.query.getBranchDirectory().subscribe((list: any[]) => {
      this.branches = list;
      this.visible = list.length > 1;
    });
  }

  onChange(value: number): void {
    this.branchId = value;
    this.branchIdChange.emit(value);
  }
}

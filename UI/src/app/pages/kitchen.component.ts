import { Component, OnInit, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { inject } from '@angular/core';
import { QueryService } from '@appservices/query.service';
import { StateService } from '@appservices/state.service';
import { AlertService } from '@appservices/alert.service';
import { AuthService } from '@appservices/auth.service';
import { BranchSelectComponent } from '../shared/component/branch-select.component';
import { BranchNamePipe } from '../shared/pipes/branch-name.pipe';

// Kitchen master: every kitchen of a branch has its own KOT printer. Menu items are mapped to a kitchen,
// and while ordering each item's KOT prints on its kitchen's printer.
@Component({
  selector: 'app-kitchen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BranchSelectComponent, BranchNamePipe],
  providers: [BsModalService, AlertService],
  template: `
  <div class="wrapper">
    <div class="right-side">
      <div class="sub-header">
        <div class="tt">
          <h2 class="mn-tt">Kitchens</h2>
        </div>
        <div class="btn-bg">
          <button type="button" class="btn btn-primary" (click)="setForm('create', null); openModal(kitchenTemplate);">+ Create Kitchen</button>
        </div>
      </div>
      <div class="cnt">
        <table class="table custom-table">
          <thead>
            <tr>
              <th scope="col">Id</th>
              <th scope="col">Kitchen Name</th>
              <th scope="col">Printer</th>
              <th scope="col">Menu Items</th>
              @if (isOutletOwner) { <th scope="col">Branch</th> }
              <th scope="col">Status</th>
              <th scope="col" style="width:260px">Action</th>
            </tr>
          </thead>
          <tbody>
            @for (k of kitchenList; track k.kitchenid) {
              <tr>
                <td>{{ k.kitchenid }}</td>
                <td>{{ k.kitchenname }}</td>
                <td>{{ k.printername }}</td>
                <td>{{ k.items }}</td>
                @if (isOutletOwner) { <td>{{ k.branchid | branchName | async }}</td> }
                <td [ngClass]="k.status ? 'status-on' : 'status-off'">{{ k.status ? 'On' : 'Off' }}</td>
                <td class="custom-btn">
                  <button type="button" class="btn btn-primary" title="Edit" (click)="setForm('edit', k); openModal(kitchenTemplate);">
                    <i class="pi pi-file-edit"></i>
                  </button>
                  <button type="button" class="btn btn-secondary" title="Print a test ticket" (click)="testPrint(k)">
                    <i class="pi pi-print"></i>
                  </button>
                  <button type="button" class="btn btn-danger" title="Delete" (click)="confirmDelete(k)">
                    <i class="pi pi-trash"></i>
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="text-muted">No kitchens yet. Create one, then map menu items to it in Menu List.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <ng-template #kitchenTemplate>
    <div class="modal-header">
      <h4 class="modal-title pull-left">{{ formTitle }} kitchen</h4>
      <button type="button" class="btn-close close pull-right" aria-label="Close" (click)="modalRef?.hide()"></button>
    </div>
    <div class="modal-body">
      <form [formGroup]="kitchenForm">
        @if (!branchLocked) { <app-branch-select [(branchId)]="saveBranchId"></app-branch-select> }

        <div class="row mb-3">
          <div class="col-md-12">
            <label for="kitchenname" class="col-form-label">Kitchen Name</label>
            <input id="kitchenname" type="text" class="form-control" formControlName="kitchenname" maxlength="100" placeholder="e.g. Main Kitchen, Tandoor, Juice Bar" />
            @if (kitchenForm.get('kitchenname')?.invalid && kitchenForm.get('kitchenname')?.touched) {
              <small class="text-danger">Kitchen name is required.</small>
            }
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-12">
            <label for="printername" class="col-form-label">Printer Name</label>
            <input id="printername" type="text" class="form-control" formControlName="printername" maxlength="200" list="installedPrinters" placeholder="Choose or type the printer name" />
            <datalist id="installedPrinters">
              @for (p of printers; track p) { <option [value]="p"></option> }
            </datalist>
            <small class="text-muted">
              Printers installed on the API computer{{ printers.length ? '' : ' (none found)' }}. A network printer must be installed on that computer first.
            </small>
            @if (kitchenForm.get('printername')?.invalid && kitchenForm.get('printername')?.touched) {
              <div><small class="text-danger">Printer name is required.</small></div>
            }
          </div>
        </div>

        <div class="row mb-3">
          <div class="col-md-12">
            <label class="col-form-label">
              <input type="checkbox" formControlName="status" /> Active
            </label>
            <div><small class="text-muted">Items of an inactive kitchen print on the default kitchen printer.</small></div>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="submit" [disabled]="kitchenForm.invalid" class="btn btn-primary" (click)="onHandleSubmit()">Save</button>
      <button type="button" class="btn btn-secondary" (click)="modalRef?.hide()">Close</button>
    </div>
  </ng-template>
  `,
  styles: ``
})
export class KitchenComponent implements OnInit {
  // An outlet owner (SuperAdmin) sees every branch's kitchens and picks the branch a new one is saved to.
  isOutletOwner = inject(AuthService).isOutletOwner();
  saveBranchId = Number(localStorage.getItem('branchid') || 1);
  branchLocked = false;

  kitchenList: any[] = [];
  printers: string[] = [];
  kitchenForm!: FormGroup;
  formTitle = 'Create';
  modalRef?: BsModalRef;

  constructor(private alertService: AlertService, private modalService: BsModalService, private query: QueryService,
              private fb: FormBuilder, private stateService: StateService) {}

  ngOnInit(): void {
    this.kitchenForm = this.fb.group({
      kitchenid: [0],
      kitchenname: ['', [Validators.required, Validators.maxLength(100)]],
      printername: ['', [Validators.required, Validators.maxLength(200)]],
      status: [true]
    });
    this.getKitchenList();
    this.query.getInstalledPrinters().subscribe({
      next: (res: any) => this.printers = res.data || [],
      error: () => this.printers = []
    });
  }

  openModal(template: TemplateRef<void>) {
    this.modalRef = this.modalService.show(template);
  }

  getKitchenList() {
    this.stateService.setLoadingState(true);
    this.query.getKitchens(true).subscribe({
      next: (res: any) => {
        this.kitchenList = res.data || [];
        this.stateService.setLoadingState(false);
      },
      error: () => this.stateService.setLoadingState(false)
    });
  }

  setForm(flag: 'create' | 'edit', kitchen: any) {
    this.formTitle = flag === 'create' ? 'Create' : 'Edit';
    if (flag === 'create') {
      this.saveBranchId = Number(localStorage.getItem('branchid') || 1);
      this.branchLocked = false;
      this.kitchenForm.reset({ kitchenid: 0, kitchenname: '', printername: '', status: true });
    } else {
      this.branchLocked = true;
      this.kitchenForm.reset({
        kitchenid: kitchen.kitchenid,
        kitchenname: kitchen.kitchenname,
        printername: kitchen.printername,
        status: kitchen.status
      });
    }
  }

  onHandleSubmit() {
    if (this.kitchenForm.invalid) {
      this.kitchenForm.markAllAsTouched();
      return;
    }
    const input = {
      ...this.kitchenForm.value,
      branchid: this.saveBranchId,
      outletid: Number(localStorage.getItem('outletid') || 1)
    };
    const request$ = input.kitchenid ? this.query.updateKitchen(input) : this.query.addKitchen(input);
    this.stateService.setLoadingState(true);
    request$.subscribe({
      next: () => {
        this.stateService.setLoadingState(false);
        this.modalRef?.hide();
        this.getKitchenList();
        this.alertService.showAlert('Success!', 'Kitchen has been saved successfully');
      },
      error: (err: any) => {
        this.stateService.setLoadingState(false);
        this.alertService.showAlert('Error!', err?.error?.message || err.message);
      }
    });
  }

  testPrint(kitchen: any) {
    this.query.testKitchenPrinter(kitchen.kitchenid).subscribe({
      next: (res: any) => this.alertService.showAlert('Test print', res.message),
      error: (err: any) => this.alertService.showAlert('Error!', err?.error?.message || err.message)
    });
  }

  confirmDelete(kitchen: any) {
    this.alertService.showAlert('Confirmation !', `Do you want to delete the kitchen "${kitchen.kitchenname}"?`, () => {
      this.query.deleteKitchen(kitchen.kitchenid).subscribe({
        next: () => {
          this.getKitchenList();
          this.alertService.showAlert('Alert !', 'Kitchen has been deleted');
        },
        error: (err: any) => this.alertService.showAlert('Error !', err?.error?.message || err.message)
      });
    });
  }
}

import { Pipe, PipeTransform } from '@angular/core';
import { Observable, map } from 'rxjs';
import { QueryService } from '@appservices/query.service';

// {{ row.branchid | branchName | async }} -> the branch's name (falls back to the id).
@Pipe({
  name: 'branchName',
  standalone: true,
})
export class BranchNamePipe implements PipeTransform {
  constructor(private query: QueryService) {}

  transform(branchId: number | null | undefined): Observable<string> {
    return this.query.getBranchDirectory().pipe(
      map((list: any[]) => list.find((b: any) => b.branchid === branchId)?.branchname ?? String(branchId ?? '-'))
    );
  }
}

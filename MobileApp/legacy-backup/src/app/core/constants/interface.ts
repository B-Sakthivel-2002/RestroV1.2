export  interface CategoryType {   
    CategoryName: string;
    IsActive: boolean;
}

export interface ExtraChargeType{
    status :string,
    message:string,
    data:ExtraChargeList[]
}

export interface ExtraChargeList{
    extrachargeid:number
    extrachargename:string,
    extrachargerate:number,
    extrachargefrom:number,
    extrachargeto:number,
    extrachargetype:string,
    extrachargestatus:boolean,
    ordertypeid:number,
    branchid:number,
    outletid:number
}

export interface TaxType{
    status:string,
    message:string,
    data:TaxTypeList[]
}

export interface TaxTypeList{

}

export interface TableType{
    status:string,
    message:string,
    data:TableTypeList[]
}

export interface TableTypeList{
tableid:number,
floorid:number,

tablename:string,
description:string,
status:boolean,
orderTotalAmount:number,
orderStatus:string,
printStatus:boolean
}
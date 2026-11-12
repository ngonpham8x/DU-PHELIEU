import type {PlasticInventoryItem, WeighTicket,CashTransaction} from '../../types/factory';
export interface StockMovement {
 id:string; itemId:string; itemCode:string; type:'in'|'out'; quantity:number;unit:string;
 sourceType:'manual'|'weigh_ticket'|'production_batch'|'adjustment';sourceId?:string;
 before:number;after:number; at:string;note:string;
}
export interface StockPosting {item:PlasticInventoryItem;movement:StockMovement}
export function postStockMovement(item:PlasticInventoryItem,existing:StockMovement[],input:Omit<StockMovement,'itemCode'|'unit'|'before'|'after'>):StockPosting {
 if(existing.some(x=>x.id===input.id))throw Error('Mã thao tác kho trùng. Không thực hiện lại.');
 if(input.sourceId&&existing.some(x=>x.itemId===item.id&&x.sourceType===input.sourceType&&x.sourceId===input.sourceId))throw Error('Chứng từ đã ghi vào mặt hàng này; không cộng tồn lần nữa.');
 if(!Number.isFinite(input.quantity)||input.quantity<=0||input.quantity>1e9)throw Error('Số lượng phải lớn hơn 0 và hợp lệ.');
 const before=item.stockWeightKg,after=Math.round((before+(input.type==='in'?input.quantity:-input.quantity))*1000)/1000;
 if(after<0)throw Error('Số lượng xuất vượt tồn kho.');
 const movement:StockMovement={...input,itemCode:item.code,unit:item.unit,before,after};
 return {item:{...item,stockWeightKg:after,inWeightKg:item.inWeightKg+(input.type==='in'?input.quantity:0),outWeightKg:item.outWeightKg+(input.type==='out'?input.quantity:0),updatedAt:input.at,note:input.note},movement};
}
export function findStockIntegrityIssues(items:PlasticInventoryItem[],movements:StockMovement[]):string[]{
 const errs:string[]=[];items.forEach(i=>{if(i.stockWeightKg<0)errs.push(`${i.code}: tồn âm`);if(i.unit!=='kg'&&i.unit!=='Cái'&&i.unit!=='Bộ')errs.push(`${i.code}: đơn vị không hỗ trợ`);});
 const ids=new Set<string>();for(const m of movements){if(ids.has(m.id))errs.push(`Trùng thao tác kho ${m.id}`);ids.add(m.id);if(m.after<0)errs.push(`Tồn âm ở ${m.id}`);}
 return errs;
}
export function summarizeOperations(tickets:WeighTicket[],transactions:CashTransaction[],items:PlasticInventoryItem[]) {
 const active=transactions.filter(x=>x.status==='active');
 const totalIncome=active.filter(x=>x.type==='income').reduce((s,x)=>s+x.amount,0);
 const totalExpense=active.filter(x=>x.type==='expense').reduce((s,x)=>s+x.amount,0);
 const inbound=tickets.filter(x=>x.ticketType==='purchase_in').reduce((s,x)=>s+x.netKg,0);
 const outbound=tickets.filter(x=>x.ticketType==='sales_out').reduce((s,x)=>s+x.netKg,0);
 const batches=tickets.filter(x=>x.ticketType==='production_batch');
 const productionKg=batches.reduce((s,x)=>s+(x.outputKg??x.netKg),0);
 const totalInventoryKg=items.filter(x=>x.unit==='kg').reduce((s,x)=>s+x.stockWeightKg,0);
 return {totalIncome,totalExpense,difference:totalIncome-totalExpense,inbound,outbound,productionKg,totalInventoryKg,batchCount:batches.length};
}

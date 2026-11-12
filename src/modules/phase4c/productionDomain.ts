import type {WeighTicket} from '../../types/factory';
export interface BatchCheck {code:string;passed:boolean;issues:string[];inputKg:number;outputKg:number;scrapKg:number;lossKg:number;recoveryPercent:number}
export function verifyProductionBatch(t:WeighTicket):BatchCheck {
  if(t.ticketType!=='production_batch') throw new Error('Chỉ nhận mẻ băm');
  const input=t.grossKg, output=t.outputKg??t.netKg, scrap=t.scrapKg??0;
  const issues:string[]=[];
  if(![input,output,scrap].every(x=>Number.isFinite(x)&&x>=0))issues.push('Khối lượng không hợp lệ');
  if(input<=0)issues.push('Đầu vào phải lớn hơn 0');
  if(output+scrap>input+0.00001)issues.push('Đầu ra và phế phẩm vượt đầu vào');
  const loss=input-output-scrap;
  const recovery=input>0?100*output/input:0;
  if(loss>input*0.1)issues.push('Hao hụt vượt 10% (ngưỡng cảnh báo tùy chỉnh sau)');
  if(!t.machineName)issues.push('Thiếu mã máy băm');
  return {code:t.ticketCode,passed:issues.length===0,issues,inputKg:input,outputKg:output,scrapKg:scrap,lossKg:loss,recoveryPercent:Math.round(recovery*100)/100};
}
export interface MaintenanceRecord {id:string;machineId:string;machineName:string;kind:'Bảo trì'|'Mài dao'|'Thay dao'|'Sửa chữa';plannedDate:string;status:'pending'|'done';completedAt?:string;notes:string}
export function newMaintenanceRecord(input:MaintenanceRecord, existing:MaintenanceRecord[]):MaintenanceRecord {
  if(existing.some(x=>x.id===input.id))throw new Error('Mã phiếu bảo trì bị trùng');
  if(!input.machineId||!/^\d{4}-\d{2}-\d{2}$/.test(input.plannedDate))throw new Error('Máy hoặc ngày bảo trì không hợp lệ');
  return {...input,status:'pending'};
}
export function completeMaintenance(records:MaintenanceRecord[],id:string,at:string):MaintenanceRecord[]{
  if(!records.some(x=>x.id===id))throw new Error('Không tìm thấy phiếu bảo trì');
  return records.map(x=>x.id===id?x.status==='done'?x:{...x,status:'done',completedAt:at}:x);
}
export function findDuplicateTicketCodes(tickets:WeighTicket[]):string[]{const seen=new Set<string>(),dupes=new Set<string>();for(const t of tickets){if(seen.has(t.ticketCode))dupes.add(t.ticketCode);seen.add(t.ticketCode);}return [...dupes];}

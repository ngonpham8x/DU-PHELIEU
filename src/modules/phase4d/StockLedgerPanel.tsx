import React from 'react';
import type {CashTransaction,PlasticInventoryItem,WeighTicket} from '../../types/factory';
import {findStockIntegrityIssues,summarizeOperations,type StockMovement} from './stockDomain';
import {formatCurrencyVND} from '../../utils/calculations';
import {exportExcelWorkbook} from '../../utils/excel';

async function exportStockExcel(items:PlasticInventoryItem[],movements:StockMovement[]){
 try{
  await exportExcelWorkbook({filename:'TheKho_DEMO_DuNhua.xlsx',subject:'Thẻ kho Dư-Nhựa phế liệu',sheets:[
   {name:'Tồn kho',title:'TỔNG HỢP TỒN KHO NHỰA & VẬT TƯ',subtitle:`${items.length} mặt hàng · Dữ liệu DEMO`,columns:[
    {header:'Mã',key:'code',width:16},{header:'Kho/Nhóm',key:'category',width:28},{header:'Loại nhựa/Vật tư',key:'plasticType',width:26},
    {header:'Nhập tích lũy',key:'inWeightKg',width:18,numFmt:'#,##0.000'},{header:'Xuất tích lũy',key:'outWeightKg',width:18,numFmt:'#,##0.000'},
    {header:'Tồn hiện tại',key:'stockWeightKg',width:18,numFmt:'#,##0.000'},{header:'Đơn vị',key:'unit',width:12},{header:'Cập nhật',key:'updatedAt',width:22},{header:'Ghi chú',key:'note',width:36},
   ],rows:items.map(item=>({...item}))},
   {name:'Biến động kho',title:'NHẬT KÝ BIẾN ĐỘNG KHO',subtitle:`${movements.length} biến động · Có số dư trước và sau`,columns:[
    {header:'Ngày',key:'at',width:22},{header:'Mã thao tác',key:'id',width:28},{header:'Mặt hàng',key:'itemCode',width:16},{header:'Loại',key:'type',width:12},
    {header:'Số lượng',key:'quantity',width:16,numFmt:'#,##0.000'},{header:'Đơn vị',key:'unit',width:12},{header:'Tồn trước',key:'before',width:16,numFmt:'#,##0.000'},
    {header:'Tồn sau',key:'after',width:16,numFmt:'#,##0.000'},{header:'Nguồn',key:'sourceType',width:20},{header:'Mã nguồn',key:'sourceId',width:24},{header:'Nội dung',key:'note',width:40},
   ],rows:movements.map(movement=>({...movement,type:movement.type==='in'?'Nhập':'Xuất'}))},
  ]});
 }catch{window.alert('Không thể xuất thẻ kho Excel. Vui lòng thử lại.');}
}
export function StockLedgerPanel({items,movements,mode}:{items:PlasticInventoryItem[];movements:StockMovement[];mode:'demo'|'production'}){
 if(mode==='production')return <section className="border border-amber-300 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" data-testid="stock-prod-not-ready"><strong>Phase 4D – Thẻ kho Production chưa kích hoạt.</strong> Chưa có backend ghi biến động kho nguyên tử theo quyền xưởng. Dữ liệu demo trên trình duyệt không được sử dụng làm tồn kho chính thức.</section>;
 const issues=findStockIntegrityIssues(items,movements);
 return <section data-testid="stock-ledger-demo" className="border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800 p-4 space-y-3">
 <div className="flex items-center justify-between gap-2"><div><h2 className="font-bold">Phase 4D – Thẻ kho và đối soát DEMO</h2><p className="text-xs text-slate-500">Nhật ký chỉ ghi các biến động phát sinh sau lần nâng cấp này; số dư cũ là số đầu theo dữ liệu demo hiện có.</p></div><button data-testid="export-stock-excel-btn" onClick={()=>void exportStockExcel(items,movements)} className="px-3 py-2 text-xs font-semibold border rounded">Xuất Excel (.xlsx)</button></div>
 <p className={`text-xs ${issues.length?'text-rose-700':'text-emerald-700'}`}>{issues.length?issues.join('; '):'Không phát hiện tồn âm hoặc mã thao tác trùng trong nhật ký hiện có.'}</p>
 <div className="max-h-60 overflow-auto"><table className="w-full min-w-[770px] text-xs"><thead><tr className="bg-slate-100 dark:bg-slate-800">{['Ngày','Mã thao tác','Mặt hàng','Loại','Số lượng','Tồn trước','Tồn sau','Nội dung'].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{movements.slice(0,50).map(x=><tr className="border-b dark:border-slate-800" key={x.id}><td className="p-2 whitespace-nowrap">{x.at}</td><td className="p-2">{x.id}</td><td className="p-2">{x.itemCode}</td><td className="p-2">{x.type==='in'?'Nhập':'Xuất'}</td><td className="p-2 whitespace-nowrap">{x.quantity} {x.unit}</td><td className="p-2">{x.before}</td><td className="p-2">{x.after}</td><td className="p-2">{x.note}</td></tr>)}</tbody></table>{movements.length===0&&<p className="text-xs text-slate-500 p-3">Chưa phát sinh thẻ kho mới ở bản DEMO này.</p>}</div>
 </section>;
}
export function OperationsSummary({tickets,transactions,items,mode}:{tickets:WeighTicket[];transactions:CashTransaction[];items:PlasticInventoryItem[];mode:'demo'|'production'}){
 const s=summarizeOperations(tickets,transactions,mode==='demo'?items:[]);
 return <section data-testid="operations-summary" className="rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 space-y-3"><h2 className="font-bold text-sm">Phase 4D – Báo cáo tổng hợp và đối soát</h2><p className="text-xs text-amber-700">Thu/Chi là dòng tiền, không đồng nghĩa doanh thu/lợi nhuận. Các số liệu cân và sản xuất có thể chưa đối ứng tồn kho; cần đối soát trước khi dùng để quyết toán.</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[['Tổng tiền thu ghi nhận',formatCurrencyVND(s.totalIncome)],['Tổng tiền chi ghi nhận',formatCurrencyVND(s.totalExpense)],['Khối lượng nhập từ phiếu cân',`${s.inbound.toLocaleString('vi-VN')} kg`],['Khối lượng đã xuất',`${s.outbound.toLocaleString('vi-VN')} kg`],['Thành phẩm băm',`${s.productionKg.toLocaleString('vi-VN')} kg`],['Số mẻ băm',s.batchCount],['Tồn kho demo',mode==='demo'?`${s.totalInventoryKg.toLocaleString('vi-VN')} kg`:'Chưa có nguồn thật']].map(([l,v])=><div key={l} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs"><div className="text-slate-500">{l}</div><strong className="text-sm">{v}</strong></div>)}</div></section>
}

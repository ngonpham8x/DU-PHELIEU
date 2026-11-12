import React, {useMemo,useState} from 'react';
import type {AttendanceRecord,EmployeeProfile,ShiftDefinition,UserRole} from '../../types/factory';
import {computeDailyTimesheetRows,formatCurrencyVND} from '../../utils/calculations';
import {exportExcelWorkbook} from '../../utils/excel';
import {aggregateApprovedTime,calculatePayrollPreview} from '../../utils/payroll';
import {editPayrollLine,payrollRemaining,registerPayrollPayment,transitionPayroll,totalNet,totalPaid,validatePayrollPeriod,type PayrollPeriod,type PayrollLine} from './payrollDomain';

const KEY='dunhua_demo_payroll_periods_v2';
const today=()=>new Date().toISOString();
const nowMonth=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(new Date());
const classes='rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-900 w-full text-sm';
const labelStatus: Record<string,string>={draft:'Bản nháp',submitted:'Chờ duyệt',approved:'Đã duyệt',locked:'Đã chốt',partially_paid:'Đã trả một phần',paid:'Đã trả đủ'};
function readPeriods(): PayrollPeriod[]{try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data:[]}catch{return []}}

export function PayrollWorkflowDemo({employees,attendance,shifts,mode,role,onCashPayment,onAudit}: {
  employees: EmployeeProfile[];attendance: AttendanceRecord[];shifts: ShiftDefinition[];mode:'demo'|'production';role:UserRole;
  onCashPayment:(payment:{id:string;employeeCode:string;employeeName:string;amount:number;account:'cash'|'bank';month:string})=>boolean;
  onAudit:(action:string,code:string,summary:string)=>void;
}){
  const [periods,setPeriods]=useState<PayrollPeriod[]>(readPeriods);
  const [month,setMonth]=useState(nowMonth());
  const [selected,setSelected]=useState('');
  const [worker,setWorker]=useState('');
  const [payAmount,setPayAmount]=useState('');
  const [account,setAccount]=useState<'cash'|'bank'>('cash');
  const [notes,setNotes]=useState('');
  const [draftEmployee,setDraftEmployee]=useState('');
  const [message,setMessage]=useState('');
  const allowed=role==='owner'||role==='hr'||role==='accountant';
  const canApprove=role==='owner';
  const p=periods.find(x=>x.id===selected)||periods[0];
  const rows=useMemo(()=>computeDailyTimesheetRows(attendance,employees,shifts),[attendance,employees,shifts]);
  function save(next:PayrollPeriod[]){setPeriods(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{setMessage('Không lưu được dữ liệu DEMO trên trình duyệt. Hãy xuất bản sao lưu.');}}
  function makePeriod(){try{
    if(periods.some(x=>x.id===month))throw Error('Kỳ lương này đã có; không tạo bản trùng.');
    const lines:PayrollLine[]=employees.filter(e=>e.status!=='Đã nghỉ').map(e=>{
      const t=aggregateApprovedTime(rows,e.code,month,shifts);
      const basis=e.salaryType==='Sản lượng'?'Sản lượng':e.salaryType==='Tháng'?'Tháng':'Ngày';
      // Production wage has no allocated accepted quantities: leave 0 and require explicit verification.
      const a=calculatePayrollPreview({basis,rate:e.baseRate,paidDays:t.paidDays,regularHours:t.regularHours,overtimeHours:0,overtimeMultiplier:0,standardDays:26,standardHoursPerDay:8,acceptedProductionKg:0,allowance:0,bonus:0,advance:0,deductions:0});
      return {employeeCode:e.code,employeeName:e.fullName,basis,paidDays:t.paidDays,regularHours:t.regularHours,overtimeHours:t.overtimeHours,rate:e.baseRate,productionKg:0,basePay:a.basePay,overtimePay:0,allowance:0,bonus:0,advance:0,deductions:0,netPay:a.netPay};
    });
    const created:PayrollPeriod={id:month,month,status:'draft',createdAt:today(),updatedAt:today(),lines,payments:[],lastAction:'Tạo nháp'};
    validatePayrollPeriod(created);save([created,...periods]);setSelected(created.id);setWorker(created.lines[0]?.employeeCode||'');setDraftEmployee(created.lines[0]?.employeeCode||'');setMessage('Đã tạo kỳ lương DEMO. Giờ tăng ca và sản lượng chưa nghiệm thu được để 0, cần kiểm tra trước khi duyệt.');onAudit('Tạo kỳ lương DEMO',created.id,'Bảng lương nháp chỉ dùng thử');
  }catch(e){setMessage(e instanceof Error?e.message:'Không tạo được kỳ lương');}}
  function updatePeriod(next:PayrollPeriod){save(periods.map(x=>x.id===next.id?next:x));setMessage(`Đã cập nhật: ${labelStatus[next.status]}`);onAudit('Đổi trạng thái kỳ lương DEMO',next.id,next.lastAction);}
  function change(next:'submitted'|'approved'|'locked'){if(!p)return;try{if(next!=='submitted'&&!canApprove)throw Error('Chỉ Chủ xưởng DEMO được duyệt/chốt.');if(next==='locked'&&!confirm('Chốt kỳ lương sẽ khóa toàn bộ số tiền trong kỳ. Xác nhận?'))return;updatePeriod(transitionPayroll(p,next,today()));}catch(e){setMessage(String(e instanceof Error?e.message:e));}}
  function editDraft(field:'rate'|'productionKg'|'overtimeMultiplier'|'overtimeRatePerHour'|'allowance'|'bonus'|'advance'|'deductions',text:string){
    if(!p || p.status!=='draft')return;
    try{
      const next=editPayrollLine(p,draftEmployee||p.lines[0]?.employeeCode,{[field]:Number(text||0)},today());
      save(periods.map(x=>x.id===p.id?next:x));setMessage('Đang chỉnh bản nháp DEMO; chưa chốt lương.');
    }catch(e){setMessage(String(e instanceof Error?e.message:e));}
  }
  function pay(){if(!p)return;try{
    if(!canApprove)throw Error('Chỉ chủ xưởng được xác nhận chi lương DEMO.');
    const n=Number(payAmount);if(!Number.isSafeInteger(n)||n<=0)throw Error('Nhập số tiền VNĐ nguyên lớn hơn 0.');
    if(!worker)throw Error('Chọn nhân viên.');
    const emp=p.lines.find(x=>x.employeeCode===worker);if(!emp)throw Error('Không có nhân viên.');
    const id=`PL-${p.month}-${worker}-${Date.now()}`;
    const next=registerPayrollPayment(p,{id,employeeCode:worker,amount:n,account,createdAt:today()});
    // Single user DEMO only; financial posting blocked in Production until trusted server transaction exists.
    const ok=onCashPayment({id,employeeCode:worker,employeeName:emp.employeeName,amount:n,account,month:p.month});
    if(!ok)throw Error('Phiếu chi chưa được ghi nhận; kỳ lương vẫn giữ nguyên.');
    updatePeriod(next);setPayAmount('');setMessage(`Đã tạo phiếu chi DEMO ${id} cho ${emp.employeeName}.`);
  }catch(e){setMessage(String(e instanceof Error?e.message:e));}}
  async function exportPayrollExcel(period: PayrollPeriod){
    try{
      await exportExcelWorkbook({
        filename:`BangLuong_DEMO_${period.month}.xlsx`,subject:`Bảng lương ${period.month}`,
        sheets:[
          {name:'Bảng lương',title:`BẢNG LƯƠNG DEMO – KỲ ${period.month}`,subtitle:`Trạng thái: ${labelStatus[period.status]} · Dữ liệu thử nghiệm, chưa phải chứng từ Production`,columns:[
            {header:'Mã NV',key:'employeeCode',width:14},{header:'Họ tên',key:'employeeName',width:28},{header:'Cách tính',key:'basis',width:14},
            {header:'Ngày công',key:'paidDays',width:13,numFmt:'0.00'},{header:'Giờ thường',key:'regularHours',width:13,numFmt:'0.00'},{header:'Giờ tăng ca',key:'overtimeHours',width:13,numFmt:'0.00'},
            {header:'Đơn giá',key:'rate',width:16,numFmt:'#,##0 [$₫-vi-VN]'},{header:'Sản lượng (kg)',key:'productionKg',width:16,numFmt:'#,##0.00'},
            {header:'Lương chính',key:'basePay',width:17,numFmt:'#,##0 [$₫-vi-VN]'},{header:'Lương tăng ca',key:'overtimePay',width:17,numFmt:'#,##0 [$₫-vi-VN]'},
            {header:'Phụ cấp',key:'allowance',width:15,numFmt:'#,##0 [$₫-vi-VN]'},{header:'Thưởng',key:'bonus',width:15,numFmt:'#,##0 [$₫-vi-VN]'},
            {header:'Tạm ứng',key:'advance',width:15,numFmt:'#,##0 [$₫-vi-VN]'},{header:'Khấu trừ',key:'deductions',width:15,numFmt:'#,##0 [$₫-vi-VN]'},
            {header:'Thực nhận',key:'netPay',width:17,numFmt:'#,##0 [$₫-vi-VN]'},{header:'Đã trả',key:'paid',width:17,numFmt:'#,##0 [$₫-vi-VN]'},{header:'Còn trả',key:'remaining',width:17,numFmt:'#,##0 [$₫-vi-VN]'},
          ],rows:period.lines.map(line=>({
            ...line,paid:line.netPay-payrollRemaining(period,line.employeeCode),remaining:payrollRemaining(period,line.employeeCode),
          }))},
          {name:'Thanh toán',title:`LỊCH SỬ THANH TOÁN DEMO – ${period.month}`,subtitle:`Tổng phải trả ${formatCurrencyVND(totalNet(period))} · Đã trả ${formatCurrencyVND(totalPaid(period))}`,columns:[
            {header:'Mã thanh toán',key:'id',width:30},{header:'Mã NV',key:'employeeCode',width:14},{header:'Số tiền',key:'amount',width:18,numFmt:'#,##0 [$₫-vi-VN]'},{header:'Quỹ',key:'account',width:15},{header:'Thời gian',key:'createdAt',width:24},
          ],rows:period.payments.map(payment=>({...payment,account:payment.account==='cash'?'Tiền mặt':'Ngân hàng'}))},
        ],
      });
      setMessage('Đã xuất bảng lương ExcelJS định dạng XLSX.');
    }catch{setMessage('Không thể xuất bảng lương Excel. Vui lòng thử lại.');}
  }
  if(mode==='production')return null;
  if(!allowed)return <div className="rounded-lg border p-4 text-sm">Bạn không được cấp quyền xem dữ liệu lương.</div>;
  return <section data-testid="payroll-workflow-demo" className="rounded-xl border border-indigo-200 bg-white dark:bg-slate-900 dark:border-indigo-800 p-4 sm:p-5 space-y-4">
    <div><h2 className="text-base font-bold text-slate-900 dark:text-white">Phase 4B – Quy trình kỳ lương & tạm ứng (DEMO)</h2><p className="text-xs text-amber-700">Nháp → Chờ duyệt → Đã duyệt → Đã chốt → Trả một phần/Trả đủ. Chỉ dùng để thử; không đồng bộ Firestore, không phải bảng lương chính thức.</p></div>
    <div className="flex flex-wrap gap-2 items-end"><label className="text-xs font-semibold">Kỳ lương<input aria-label="Kỳ lương" className={classes} type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><button className="px-3 py-2 rounded-lg bg-[#0F2942] text-white text-sm font-bold" onClick={makePeriod}>+ Tạo kỳ lương DEMO</button></div>
    {periods.length>0&&<><label className="text-xs font-semibold block">Kỳ lương đã lập<select className={classes} value={p?.id} onChange={e=>{setSelected(e.target.value);setWorker('');}}>{periods.map(v=><option key={v.id} value={v.id}>{v.month} – {labelStatus[v.status]}</option>)}</select></label>
      {p&&<><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[['Trạng thái',labelStatus[p.status]],['Phải trả',formatCurrencyVND(totalNet(p))],['Đã thanh toán',formatCurrencyVND(totalPaid(p))],['Còn lại',formatCurrencyVND(payrollRemaining(p))]].map(([l,v])=><div key={l} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs"><div className="text-slate-500">{l}</div><strong className="break-words text-sm">{v}</strong></div>)}</div>
       {p.status==='draft'&&<div className="rounded-lg border border-indigo-200 dark:border-indigo-800 p-3 space-y-2"><strong className="text-sm">Điều chỉnh từng nhân viên trước khi duyệt</strong><select aria-label="Nhân viên chỉnh lương" className={classes} value={draftEmployee||p.lines[0]?.employeeCode} onChange={e=>setDraftEmployee(e.target.value)}>{p.lines.map(x=><option key={x.employeeCode} value={x.employeeCode}>{x.employeeName}</option>)}</select><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{(['rate','productionKg','overtimeMultiplier','overtimeRatePerHour','allowance','bonus','advance','deductions'] as const).map(f=>{const line=p.lines.find(x=>x.employeeCode===(draftEmployee||p.lines[0]?.employeeCode));const names={rate:'Đơn giá',productionKg:'Sản lượng nghiệm thu kg (nhập thử)',overtimeMultiplier:'Hệ số tăng ca tùy chỉnh',overtimeRatePerHour:'Đơn giá tăng ca/giờ',allowance:'Phụ cấp',bonus:'Thưởng',advance:'Tạm ứng đã trả',deductions:'Khấu trừ hợp lệ'};return <label key={f} className="text-xs">{names[f]}<input className={classes} type="number" min="0" step={f==='overtimeMultiplier'?'0.1':'1'} value={line?.[f]??0} onChange={e=>editDraft(f,e.target.value)}/></label>})}</div><p className="text-xs text-amber-700">Chỉ nhập số liệu đã được đối chiếu trong thực tế. Thao tác tại đây vẫn là DEMO; chưa tự lấy sản lượng phân bổ hoặc khoản ứng đã duyệt.</p></div>}
       <div className="overflow-x-auto"><table className="min-w-[820px] w-full text-xs"><thead><tr className="bg-slate-100 dark:bg-slate-800">{['Nhân viên','Công','Giờ công','Lương dự kiến','Đã trả','Còn trả'].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{p.lines.map(line=><tr key={line.employeeCode} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2">{line.employeeCode} · {line.employeeName}</td><td className="p-2">{line.paidDays}</td><td className="p-2">{line.regularHours}</td><td className="p-2">{formatCurrencyVND(line.netPay)}</td><td className="p-2">{formatCurrencyVND(line.netPay-payrollRemaining(p,line.employeeCode))}</td><td className="p-2">{formatCurrencyVND(payrollRemaining(p,line.employeeCode))}</td></tr>)}</tbody></table></div>
       <div className="flex flex-wrap gap-2"><button disabled={p.status!=='draft'} onClick={()=>change('submitted')} className="border rounded px-3 py-2 disabled:opacity-40 text-xs">Gửi duyệt</button><button disabled={p.status!=='submitted'||!canApprove} onClick={()=>change('approved')} className="border rounded px-3 py-2 disabled:opacity-40 text-xs">Duyệt</button><button disabled={p.status!=='approved'||!canApprove} onClick={()=>change('locked')} className="border rounded px-3 py-2 disabled:opacity-40 text-xs">Chốt kỳ</button><button data-testid="export-payroll-excel-btn" onClick={()=>void exportPayrollExcel(p)} className="border rounded px-3 py-2 text-xs">Xuất Excel (.xlsx)</button></div>
       {['locked','partially_paid'].includes(p.status)&&<div className="rounded-lg border border-emerald-200 p-3 space-y-3"><strong className="text-sm">Ghi nhận thanh toán DEMO (liên kết sổ Thu – Chi)</strong><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><label className="text-xs">Nhân viên<select className={classes} value={worker} onChange={e=>setWorker(e.target.value)}><option value="">Chọn</option>{p.lines.filter(x=>payrollRemaining(p,x.employeeCode)>0).map(x=><option value={x.employeeCode} key={x.employeeCode}>{x.employeeName}</option>)}</select></label><label className="text-xs">Số tiền (VNĐ)<input className={classes} type="number" min="1" value={payAmount} onChange={e=>setPayAmount(e.target.value)}/></label><label className="text-xs">Quỹ<select className={classes} value={account} onChange={e=>setAccount(e.target.value as 'cash'|'bank')}><option value="cash">Tiền mặt</option><option value="bank">Ngân hàng</option></select></label></div><button className="rounded-lg bg-emerald-700 text-white px-3 py-2 text-xs font-bold" onClick={pay}>Xác nhận trả lương DEMO</button><p className="text-xs text-slate-500">Đã chốt mới có thể trả lương. Thanh toán trùng mã được chặn; bản ghi chỉ nằm trong trình duyệt này.</p></div>}
       </>}</>}
    <label className="text-xs block">Ghi chú kiểm tra tự do (chưa lưu)<input className={classes} value={notes} placeholder="Ghi chú cá nhân cho bản kiểm thử" onChange={e=>setNotes(e.target.value)}/></label>
    {message&&<p role="status" className="rounded bg-slate-50 dark:bg-slate-800 p-2 text-xs">{message}</p>}
  </section>
}

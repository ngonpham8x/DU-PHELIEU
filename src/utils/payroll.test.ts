import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayrollPreview, aggregateApprovedTime } from './payroll';
import type { DailyTimesheetRow, ShiftDefinition } from '../types/factory';
const base = {
  basis: 'Ngày' as const, rate: 300000, paidDays: 20, regularHours: 160,
  overtimeHours: 4, overtimeMultiplier: 1.5, standardDays: 26, standardHoursPerDay: 8,
  acceptedProductionKg: 0, allowance: 200000, bonus: 0, advance: 500000, deductions: 100000,
};
test('daily wages include overtime once, allowances and advances',()=>{
  const r=calculatePayrollPreview(base);
  assert.deepEqual(r,{basePay:6000000,overtimePay:225000,grossPay:6425000,totalDeduction:600000,netPay:5825000,uncoveredDeduction:0});
});
test('hourly wages exclude overtime from regular hours',()=>{
  const r=calculatePayrollPreview({...base,basis:'Giờ',rate:40000,regularHours:160,overtimeHours:5,allowance:0,advance:0,deductions:0});
  assert.equal(r.netPay,6700000);
});
test('monthly wages prorate and cap base pay at monthly rate',()=>{
  const r=calculatePayrollPreview({...base,basis:'Tháng',rate:7800000,paidDays:13,overtimeHours:0,allowance:0,advance:0,deductions:0});
  assert.equal(r.netPay,3900000);
});
test('piecework needs explicit overtime price when overtime exists',()=>{
  assert.throws(()=>calculatePayrollPreview({...base,basis:'Sản lượng',rate:1000,acceptedProductionKg:200,overtimeHours:2}),/đơn giá tăng ca/);
  const r=calculatePayrollPreview({...base,basis:'Sản lượng',rate:1000,acceptedProductionKg:200,overtimeHours:2,overtimeRatePerHour:30000,allowance:0,advance:0,deductions:0});
  assert.equal(r.netPay,290000);
});
test('deduction overflow remains visible, net does not become negative',()=>{
  const r=calculatePayrollPreview({...base,paidDays:1,overtimeHours:0,advance:500000,allowance:0,deductions:0});
  assert.equal(r.netPay,0); assert.equal(r.uncoveredDeduction,200000);
});
test('reject negative rates and non-finite inputs',()=>{
  assert.throws(()=>calculatePayrollPreview({...base,rate:-1}));
  assert.throws(()=>calculatePayrollPreview({...base,bonus:Infinity}));
});
test('only completed shifts from selected employee and month count',()=>{
  const one=(code:string,date:string,checkOut:string,hours:number,overtime:number)=>({
    rowKey:code+date,employeeCode:code,employeeName:'Tên',department:'Xưởng',shiftName:'Ca',workDateStr:date,
    checkInTime:'08:00',checkOutTime:checkOut,breakMinutesUsed:0,actualHours:hours,overtimeHours:overtime,
    lateMinutes:0,earlyLeaveMinutes:0,statusLabel:'Đủ công',statusTone:'emerald',notes:'',hasPendingFallback:false,
    hasRejectedFallback:false,isOvernightShift:false,
  }) as DailyTimesheetRow;
  const shifts=[{id:'ca',name:'Ca',startTime:'08:00',endTime:'16:00',breakMinutes:0,graceLateMinutes:0,hoursCount:8}] as ShiftDefinition[];
  const r=aggregateApprovedTime([one('CN-01','11/11/2026','17:00',9,1),one('CN-01','12/11/2026','—',0,0),one('CN-02','11/11/2026','16:00',8,0),one('CN-01','11/10/2026','16:00',8,0)],'CN-01','2026-11',shifts);
  assert.deepEqual(r,{paidDays:1,regularHours:8,overtimeHours:1,completedShifts:1});
});

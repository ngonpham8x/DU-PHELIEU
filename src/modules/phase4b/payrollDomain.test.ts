import test from 'node:test';
import assert from 'node:assert/strict';
import {editPayrollLine, registerPayrollPayment, transitionPayroll, payrollRemaining, payrollCsv, validatePayrollPeriod, type PayrollPeriod} from './payrollDomain';
const base: PayrollPeriod = { id:'2026-11',month:'2026-11',status:'draft',createdAt:'2026-11-01',updatedAt:'2026-11-01',lastAction:'Tạo',lines:[{employeeCode:'CN-1',employeeName:'A',basis:'Ngày',paidDays:2,regularHours:16,overtimeHours:0,rate:300000,productionKg:0,basePay:600000,overtimePay:0,allowance:0,bonus:0,advance:0,deductions:0,netPay:600000}],payments:[]};
test('4B chuyển trạng thái hợp lệ',()=>{const a=transitionPayroll(base,'submitted','t');const b=transitionPayroll(a,'approved','t'); assert.equal(transitionPayroll(b,'locked','t').status,'locked');});
test('4B chặn chốt nháp',()=>assert.throws(()=>transitionPayroll(base,'locked','t')));
test('4B thanh toán một phần và tất toán',()=>{const locked={...base,status:'locked'} as PayrollPeriod;const a=registerPayrollPayment(locked,{id:'p1',employeeCode:'CN-1',amount:200000,account:'cash',createdAt:'t'});assert.equal(a.status,'partially_paid');assert.equal(payrollRemaining(a),400000);const b=registerPayrollPayment(a,{id:'p2',employeeCode:'CN-1',amount:400000,account:'bank',createdAt:'t'});assert.equal(b.status,'paid');});
test('4B chống thanh toán trùng và vượt số',()=>{const locked={...base,status:'locked'} as PayrollPeriod;const p={id:'p1',employeeCode:'CN-1',amount:300000,account:'cash' as const,createdAt:'t'};const a=registerPayrollPayment(locked,p);assert.equal(registerPayrollPayment(a,p).payments.length,1);assert.throws(()=>registerPayrollPayment(a,{...p,id:'p2',amount:500000}));});
test('4B không chấp nhận kỳ trùng nhân viên',()=>assert.throws(()=>validatePayrollPeriod({...base,lines:[base.lines[0],base.lines[0]]})));
test('4B phòng công thức CSV',()=>assert.match(payrollCsv({...base, lines:[{...base.lines[0], employeeName:'=HYPERLINK("bad")'}]}),/"'=HYPERLINK/));

test('4B cho sửa tạm ứng ở bản nháp và chặn sửa đã chốt',()=>{const a=editPayrollLine(base,'CN-1',{advance:100000},'t');assert.equal(a.lines[0].netPay,500000);assert.throws(()=>editPayrollLine({...a,status:'locked'},'CN-1',{advance:0},'t'));});

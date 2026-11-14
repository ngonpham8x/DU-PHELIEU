import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { appCheckConfigured, auth, db, functions } from '../../lib/firebase';
import type { UserRole } from '../../types/factory';
import { formatCurrencyVND } from '../../utils/calculations';

type PayrollPeriodRecord = {
  id: string;
  month: string;
  status: string;
  netTotal: number;
  paidTotal: number;
  employeeCount: number;
  blockingIssueCount: number;
  reviewLineCount: number;
};

type PayrollItemRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  salaryBasis: 'day' | 'month' | 'piecework';
  paidDays: number;
  regularMinutes: number;
  overtimeMinutes: number;
  productionGrams: number;
  rate: number;
  basePay: number;
  overtimePay: number;
  allowance: number;
  bonus: number;
  advance: number;
  deductions: number;
  netPay: number;
  requiresReview: boolean;
};

const callableOptions = { limitedUseAppCheckTokens: true } as const;
const generatePayroll = httpsCallable(functions, 'generatePayrollPeriod', callableOptions);
const adjustPayroll = httpsCallable(functions, 'adjustPayrollItem', callableOptions);
const transitionPayroll = httpsCallable(functions, 'transitionPayrollPeriod', callableOptions);
const payPayroll = httpsCallable(functions, 'payPayrollPeriod', callableOptions);
const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';

function currentMonth() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date());
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Máy chủ từ chối thao tác. Vui lòng thử lại.';
  return error.message.replace(/^Firebase:\s*/i, '').replace(/^FirebaseError:\s*/i, '');
}

function integer(value: string, label: string) {
  const number = Number(value || 0);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} phải là số nguyên không âm.`);
  return number;
}

function kilogramsToGrams(value: string) {
  const kilograms = Number(value || 0);
  const grams = Math.round(kilograms * 1000);
  if (!Number.isFinite(kilograms) || kilograms < 0 || !Number.isSafeInteger(grams) || Math.abs(grams / 1000 - kilograms) > 0.000001) {
    throw new Error('Sản lượng chỉ được nhập tối đa 3 chữ số thập phân theo kg.');
  }
  return grams;
}

function statusLabel(status: string) {
  return ({
    draft: 'Bản nháp', pending_review: 'Chờ duyệt', approved: 'Đã duyệt', finalized: 'Đã chốt',
    partially_paid: 'Đã trả một phần', paid: 'Đã trả đủ',
  } as Record<string, string>)[status] || status;
}

export function PayrollWorkflowProduction({ role }: { role: UserRole }) {
  const [workshopId, setWorkshopId] = useState('');
  const [periods, setPeriods] = useState<PayrollPeriodRecord[]>([]);
  const [items, setItems] = useState<PayrollItemRecord[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [standardDays, setStandardDays] = useState('26');
  const [form, setForm] = useState({ productionKg: '0', overtimePay: '0', allowance: '0', bonus: '0', advance: '0', deductions: '0', reason: '' });
  const [payment, setPayment] = useState({ amount: '', accountType: 'bank' as 'cash' | 'bank', note: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) || periods[0];
  const selectedItem = items.find((item) => item.employeeId === selectedEmployeeId) || items[0];
  const canGenerate = role === 'owner' || role === 'hr' || role === 'accountant';
  const canAdjust = canGenerate;
  const canApprove = role === 'owner' || role === 'manager';
  const canFinalize = role === 'owner' || role === 'accountant';
  const canPay = role === 'owner' || role === 'accountant';
  const canCallServer = Boolean(workshopId && appCheckConfigured);

  useEffect(() => {
    let active = true;
    const user = auth.currentUser;
    if (!user) {
      setError('Hãy đăng nhập tài khoản Production để tải kỳ lương.');
      return;
    }
    getDoc(doc(db, 'user_workshops', user.uid)).then((snapshot) => {
      if (!active) return;
      const data = snapshot.data();
      if (!snapshot.exists() || data?.status !== 'active' || typeof data.workshopId !== 'string') {
        setError('Tài khoản chưa được cấp xưởng trong mô hình nhiều tài khoản.');
        return;
      }
      setWorkshopId(data.workshopId);
    }).catch((cause) => active && setError(errorMessage(cause)));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!workshopId) return;
    return onSnapshot(
      query(collection(db, 'workshops', workshopId, 'payroll_periods'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const next = snapshot.docs.map((entry) => {
          const data = entry.data();
          return {
            id: entry.id, month: String(data.month || ''), status: String(data.status || 'draft'),
            netTotal: Number(data.netTotal) || 0, paidTotal: Number(data.paidTotal) || 0,
            employeeCount: Number(data.employeeCount) || 0, blockingIssueCount: Number(data.blockingIssueCount) || 0,
            reviewLineCount: Number(data.reviewLineCount) || 0,
          };
        });
        setPeriods(next);
        setSelectedPeriodId((current) => current && next.some((period) => period.id === current) ? current : next[0]?.id || '');
      },
      (cause) => setError(errorMessage(cause)),
    );
  }, [workshopId]);

  useEffect(() => {
    if (!workshopId || !selectedPeriod?.id) {
      setItems([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'workshops', workshopId, 'payroll_items'), where('periodId', '==', selectedPeriod.id)),
      (snapshot) => {
        const next = snapshot.docs.map((entry) => {
          const data = entry.data();
          return {
            id: entry.id, employeeId: String(data.employeeId || ''), employeeName: String(data.employeeName || ''),
            salaryBasis: data.salaryBasis || 'day', paidDays: Number(data.paidDays) || 0,
            regularMinutes: Number(data.regularMinutes) || 0, overtimeMinutes: Number(data.overtimeMinutes) || 0,
            productionGrams: Number(data.productionGrams) || 0,
            rate: Number(data.rate) || 0, basePay: Number(data.basePay) || 0, overtimePay: Number(data.overtimePay) || 0,
            allowance: Number(data.allowance) || 0, bonus: Number(data.bonus) || 0, advance: Number(data.advance) || 0,
            deductions: Number(data.deductions) || 0, netPay: Number(data.netPay) || 0, requiresReview: data.requiresReview === true,
          } as PayrollItemRecord;
        }).sort((a, b) => a.employeeId.localeCompare(b.employeeId));
        setItems(next);
        setSelectedEmployeeId((current) => current && next.some((item) => item.employeeId === current) ? current : next.find((item) => item.requiresReview)?.employeeId || next[0]?.employeeId || '');
      },
      (cause) => setError(errorMessage(cause)),
    );
  }, [workshopId, selectedPeriod?.id]);

  useEffect(() => {
    if (!selectedItem) return;
    setForm({
      productionKg: String(selectedItem.productionGrams / 1000),
      overtimePay: String(selectedItem.overtimePay), allowance: String(selectedItem.allowance), bonus: String(selectedItem.bonus),
      advance: String(selectedItem.advance), deductions: String(selectedItem.deductions), reason: '',
    });
  }, [selectedItem?.id]);

  const summary = useMemo(() => ({
    remaining: Math.max(0, (selectedPeriod?.netTotal || 0) - (selectedPeriod?.paidTotal || 0)),
    review: items.filter((item) => item.requiresReview).length,
  }), [items, selectedPeriod]);

  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); setMessage(success); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }

  function createPeriod() {
    if (!workshopId) return;
    const periodId = month.replace('-', '_');
    void run(async () => {
      await generatePayroll({ workshopId, periodId, month, standardDays: integer(standardDays, 'Ngày công chuẩn') });
      setSelectedPeriodId(periodId);
    }, 'Đã tạo kỳ lương nháp từ dữ liệu công được duyệt.');
  }

  function saveAdjustment() {
    if (!workshopId || !selectedPeriod || !selectedItem) return;
    void run(() => adjustPayroll({
      workshopId, periodId: selectedPeriod.id, employeeId: selectedItem.employeeId,
      adjustmentId: `ADJ_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      acceptedProductionGrams: kilogramsToGrams(form.productionKg),
      overtimePay: integer(form.overtimePay, 'Tiền tăng ca'), allowance: integer(form.allowance, 'Phụ cấp'),
      bonus: integer(form.bonus, 'Thưởng'), advance: integer(form.advance, 'Tạm ứng'),
      deductions: integer(form.deductions, 'Khấu trừ'), reason: form.reason,
    }), 'Đã lưu đối soát và cập nhật tổng kỳ lương.');
  }

  function changeStatus(action: 'submit' | 'approve' | 'finalize') {
    if (!workshopId || !selectedPeriod) return;
    void run(() => transitionPayroll({ workshopId, periodId: selectedPeriod.id, action }), 'Đã cập nhật trạng thái kỳ lương.');
  }

  function makePayment() {
    if (!workshopId || !selectedPeriod) return;
    void run(() => payPayroll({
      workshopId, periodId: selectedPeriod.id, paymentId: `PAY_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      amount: integer(payment.amount, 'Số tiền thanh toán'), accountType: payment.accountType, note: payment.note,
    }), 'Đã ghi nhận thanh toán và phiếu chi lương.');
  }

  return <section className="space-y-4" data-testid="payroll-workflow-production">
    <div className="rounded-xl border border-indigo-200 bg-white p-4 dark:border-indigo-900 dark:bg-slate-900">
      <h2 className="font-bold">Bảng lương Production theo xưởng</h2>
      <p className="mt-1 text-xs text-slate-500">Dữ liệu đọc trực tiếp từ Firestore; mọi thay đổi tiền lương đi qua máy chủ, App Check và nhật ký kiểm toán.</p>
      {workshopId && <p className="mt-2 text-xs font-semibold text-indigo-700">Mã xưởng: {workshopId}</p>}
    </div>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    {!appCheckConfigured && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Chưa cấu hình Firebase App Check cho bản web này. Có thể xem dữ liệu nếu được cấp quyền, nhưng các nút thay đổi lương được khóa để máy chủ không nhận yêu cầu không được xác thực.</p>}

    {canGenerate && <div className="grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[1fr_160px_auto]">
      <label className="text-xs font-semibold">Tháng lương<input className={fieldClass} type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <label className="text-xs font-semibold">Ngày công chuẩn<input className={fieldClass} type="number" min="1" max="31" value={standardDays} onChange={(event) => setStandardDays(event.target.value)} /></label>
      <button disabled={busy || !canCallServer} onClick={createPeriod} className="self-end rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Tạo kỳ từ công duyệt</button>
    </div>}

    {periods.length === 0 && workshopId && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Chưa có kỳ lương Production.</div>}
    {selectedPeriod && <>
      <div className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-xs font-semibold">Chọn kỳ lương<select className={fieldClass} value={selectedPeriod.id} onChange={(event) => setSelectedPeriodId(event.target.value)}>{periods.map((period) => <option key={period.id} value={period.id}>{period.month} – {statusLabel(period.status)}</option>)}</select></label>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[['Trạng thái', statusLabel(selectedPeriod.status)], ['Nhân viên', selectedPeriod.employeeCount], ['Phải trả', formatCurrencyVND(selectedPeriod.netTotal)], ['Đã trả', formatCurrencyVND(selectedPeriod.paidTotal)], ['Cần đối soát', summary.review]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800"><span className="text-slate-500">{label}</span><strong className="mt-1 block break-words text-sm">{value}</strong></div>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedPeriod.status === 'draft' && <button disabled={busy || !canCallServer || selectedPeriod.blockingIssueCount > 0} onClick={() => changeStatus('submit')} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">Gửi duyệt</button>}
          {selectedPeriod.status === 'pending_review' && canApprove && <button disabled={busy || !canCallServer} onClick={() => changeStatus('approve')} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Duyệt kỳ</button>}
          {selectedPeriod.status === 'approved' && canFinalize && <button disabled={busy || !canCallServer} onClick={() => changeStatus('finalize')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Chốt kỳ</button>}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-bold">Chi tiết nhân viên</h3>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[920px] text-xs"><thead><tr className="bg-slate-100 dark:bg-slate-800">{['Nhân viên', 'Cách tính', 'Ngày công', 'Giờ thường', 'Tăng ca', 'Lương chính', 'Thực nhận', 'Đối soát'].map((heading) => <th key={heading} className="p-2 text-left">{heading}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b dark:border-slate-800"><td className="p-2">{item.employeeId} · {item.employeeName}</td><td className="p-2">{item.salaryBasis}</td><td className="p-2">{item.paidDays}</td><td className="p-2">{(item.regularMinutes / 60).toFixed(2)}h</td><td className="p-2">{(item.overtimeMinutes / 60).toFixed(2)}h</td><td className="p-2">{formatCurrencyVND(item.basePay)}</td><td className="p-2 font-bold">{formatCurrencyVND(item.netPay)}</td><td className="p-2"><button onClick={() => setSelectedEmployeeId(item.employeeId)} className={`rounded px-2 py-1 ${item.requiresReview ? 'bg-amber-100 text-amber-800' : 'border'}`}>{item.requiresReview ? 'Cần xử lý' : 'Xem/Sửa'}</button></td></tr>)}</tbody></table></div>
      </div>

      {selectedPeriod.status === 'draft' && canAdjust && selectedItem && <div className="rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-900">
        <h3 className="font-bold">Đối soát: {selectedItem.employeeName} ({selectedItem.employeeId})</h3>
        <p className="mt-1 text-xs text-slate-500">Tăng ca ghi nhận: {(selectedItem.overtimeMinutes / 60).toFixed(2)} giờ · Đơn giá gốc: {formatCurrencyVND(selectedItem.rate)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">{[
          ['productionKg', 'Sản lượng nghiệm thu (kg)'], ['overtimePay', 'Tiền tăng ca'], ['allowance', 'Phụ cấp'], ['bonus', 'Thưởng'], ['advance', 'Tạm ứng'], ['deductions', 'Khấu trừ'],
        ].map(([key, label]) => <label key={key} className="text-xs font-semibold">{label}<input className={fieldClass} type="number" min="0" step={key === 'productionKg' ? '0.001' : '1'} value={form[key as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
        <label className="mt-2 block text-xs font-semibold">Lý do và chứng từ đối chiếu<textarea className={fieldClass} rows={2} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
        <button disabled={busy || !canCallServer || form.reason.trim().length < 3} onClick={saveAdjustment} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Lưu đối soát</button>
      </div>}

      {canPay && ['finalized', 'partially_paid'].includes(selectedPeriod.status) && <div className="rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-900">
        <h3 className="font-bold">Thanh toán kỳ lương · Còn lại {formatCurrencyVND(summary.remaining)}</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"><label className="text-xs font-semibold">Số tiền<input className={fieldClass} type="number" min="1" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} /></label><label className="text-xs font-semibold">Nguồn tiền<select className={fieldClass} value={payment.accountType} onChange={(event) => setPayment((current) => ({ ...current, accountType: event.target.value as 'cash' | 'bank' }))}><option value="bank">Ngân hàng</option><option value="cash">Tiền mặt</option></select></label><label className="text-xs font-semibold">Ghi chú<input className={fieldClass} value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} /></label></div>
        <button disabled={busy || !canCallServer || !payment.amount} onClick={makePayment} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Xác nhận thanh toán</button>
      </div>}
    </>}
  </section>;
}

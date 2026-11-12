import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Edit3,
  FileText,
  RotateCcw,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AccountType,
  CashTransaction,
  UserRole,
} from '../types/factory';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ROLE_LABELS,
} from '../data/demoSeed';
import {
  canManageCashFlow,
  canRestoreTransaction,
  formatCurrencyVND,
} from '../utils/calculations';

export interface TransactionUpdatePayload {
  amount: number;
  counterparty: string;
  category: string;
  accountType: AccountType;
  description: string;
  reason: string;
}

interface TransactionDetailModalProps {
  transaction: CashTransaction | null;
  initialMode?: 'view' | 'edit' | 'confirm_cancel' | 'confirm_restore';
  userRole: UserRole;
  onClose: () => void;
  onUpdateTransaction: (
    tx: CashTransaction,
    updates: TransactionUpdatePayload
  ) => Promise<void>;
  onCancelTransaction: (tx: CashTransaction, reason: string) => Promise<void>;
  onRestoreTransaction: (tx: CashTransaction, reason: string) => Promise<void>;
  onPermissionDenied: (actionLabel: string) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  initialMode = 'view',
  userRole,
  onClose,
  onUpdateTransaction,
  onCancelTransaction,
  onRestoreTransaction,
  onPermissionDenied,
}) => {
  const [mode, setMode] = useState<
    'view' | 'edit' | 'confirm_cancel' | 'confirm_restore'
  >(initialMode);
  const [amountStr, setAmountStr] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [category, setCategory] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('cash');
  const [description, setDescription] = useState('');
  const [editReason, setEditReason] = useState(
    'Điều chỉnh số liệu giao dịch thực tế'
  );
  const [cancelReason, setCancelReason] = useState(
    'Hủy giao dịch do nhập sai số liệu thực tế'
  );
  const [restoreReason, setRestoreReason] = useState(
    'Khôi phục giao dịch sau khi đối chiếu chứng từ gốc'
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setMode(initialMode);
    setAmountStr(String(transaction.amount));
    setCounterparty(transaction.counterparty);
    setCategory(transaction.category);
    setAccountType(transaction.accountType);
    setDescription(transaction.description);
    setEditReason('Điều chỉnh số liệu giao dịch thực tế');
    setCancelReason('Hủy giao dịch do nhập sai số liệu thực tế');
    setRestoreReason('Khôi phục giao dịch sau khi đối chiếu chứng từ gốc');
    setErrorMsg('');
    setSubmitting(false);
  }, [transaction, initialMode]);

  if (!transaction) return null;

  const hasCashPermission = canManageCashFlow(userRole);
  const hasRestorePermission = canRestoreTransaction(userRole);
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const categories = isIncome
    ? INCOME_CATEGORIES
    : isTransfer
      ? ['Chuyển tiền nội bộ']
      : EXPENSE_CATEGORIES;

  const numericNewAmount = Math.round(Number(amountStr) || 0);
  const amountDiff = numericNewAmount - transaction.amount;

  const handleStartEdit = () => {
    if (!hasCashPermission) {
      onPermissionDenied('Sửa giao dịch thu chi');
      return;
    }
    setErrorMsg('');
    setMode('edit');
  };

  const handleStartCancel = () => {
    if (!hasCashPermission) {
      onPermissionDenied('Hủy giao dịch thu chi');
      return;
    }
    setErrorMsg('');
    setMode('confirm_cancel');
  };

  const handleStartRestore = () => {
    if (!hasRestorePermission) {
      onPermissionDenied(
        `Khôi phục giao dịch đã hủy (Vai trò ${ROLE_LABELS[userRole].name} không có quyền khôi phục)`
      );
      return;
    }
    setErrorMsg('');
    setMode('confirm_restore');
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!numericNewAmount || numericNewAmount <= 0) {
      setErrorMsg('Số tiền sau khi sửa phải lớn hơn 0 VNĐ.');
      return;
    }
    if (!counterparty.trim()) {
      setErrorMsg('Vui lòng nhập tên người nộp / nhận tiền.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Vui lòng nhập nội dung giao dịch.');
      return;
    }
    if (!editReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do điều chỉnh giao dịch.');
      return;
    }

    setSubmitting(true);
    try {
      await onUpdateTransaction(transaction, {
        amount: numericNewAmount,
        counterparty: counterparty.trim(),
        category: isTransfer ? 'Chuyển tiền nội bộ' : category,
        accountType,
        description: description.trim(),
        reason: editReason.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể lưu cập nhật giao dịch.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!cancelReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do hủy giao dịch để lưu nhật ký kiểm toán.');
      return;
    }

    setSubmitting(true);
    try {
      await onCancelTransaction(transaction, cancelReason.trim());
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể hủy giao dịch.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!restoreReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do khôi phục giao dịch.');
      return;
    }

    setSubmitting(true);
    try {
      await onRestoreTransaction(transaction, restoreReason.trim());
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể khôi phục giao dịch.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-detail-modal-title"
      data-testid="tx-detail-modal"
    >
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Wallet
              className={`w-6 h-6 ${
                isIncome
                  ? 'text-emerald-600'
                  : isTransfer
                    ? 'text-sky-600'
                    : 'text-rose-600'
              }`}
            />
            <div>
              <h2
                id="tx-detail-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
              >
                {mode === 'view' && `Chi Tiết Giao Dịch ${transaction.code}`}
                {mode === 'edit' && `Sửa Giao Dịch ${transaction.code}`}
                {mode === 'confirm_cancel' &&
                  `Xác Nhận Hủy Giao Dịch ${transaction.code}`}
                {mode === 'confirm_restore' &&
                  `Khôi Phục Giao Dịch ${transaction.code}`}
              </h2>
              <p className="text-xs text-slate-500">
                {isIncome
                  ? 'Phiếu Thu Tiền'
                  : isTransfer
                    ? 'Phiếu Chuyển Quỹ Nội Bộ'
                    : 'Phiếu Chi Tiền'}{' '}
                · {transaction.dateStr}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ chi tiết"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {errorMsg}
          </div>
        )}

        {/* 1. VIEW MODE */}
        {mode === 'view' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <span className="text-xs font-semibold text-slate-500">
                  Số tiền giao dịch
                </span>
                <span
                  data-testid="tx-detail-amount"
                  className={`text-xl font-extrabold font-mono ${
                    transaction.status === 'cancelled'
                      ? 'line-through text-slate-400'
                      : isIncome
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : isTransfer
                          ? 'text-sky-700 dark:text-sky-400'
                          : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {isIncome ? '+' : transaction.type === 'expense' ? '-' : ''}
                  {formatCurrencyVND(transaction.amount)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Mã giao dịch</span>
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {transaction.code}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Trạng thái</span>
                  {transaction.status === 'active' ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đang hiệu lực
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                      <Ban className="w-3.5 h-3.5" />
                      Đã hủy
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block">Quỹ tiền</span>
                  <strong className="text-slate-900 dark:text-white">
                    {transaction.accountType === 'cash'
                      ? 'Quỹ Tiền Mặt Tại Xưởng'
                      : 'Tài Khoản Ngân Hàng'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Danh mục</span>
                  <strong className="text-slate-900 dark:text-white">
                    {transaction.category}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div>
                  <span className="text-slate-500 block">
                    Đối tượng nộp / nhận
                  </span>
                  <strong className="text-slate-900 dark:text-white">
                    {transaction.counterparty}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Nội dung chi tiết
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 font-medium">
                    {transaction.description}
                  </p>
                </div>
                {transaction.attachmentNote && (
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-mono">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Chứng từ: {transaction.attachmentNote}</span>
                  </div>
                )}
                {transaction.status === 'cancelled' &&
                  transaction.cancelReason && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold">
                      Lý do đã hủy: {transaction.cancelReason}
                    </div>
                  )}
              </div>
            </div>

            {/* Action Buttons: Sửa, Hủy (hoặc Khôi phục), Đóng */}
            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                {transaction.status === 'active' ? (
                  <>
                    <button
                      type="button"
                      data-testid="btn-edit-tx"
                      onClick={handleStartEdit}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F2942] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      data-testid="btn-cancel-tx"
                      onClick={handleStartCancel}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Hủy</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    data-testid="btn-restore-tx"
                    onClick={handleStartRestore}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Khôi phục giao dịch</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                data-testid="btn-close-tx-detail"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* 2. EDIT MODE */}
        {mode === 'edit' && (
          <form onSubmit={handleSubmitEdit} className="mt-4 space-y-4">
            <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-slate-700 dark:text-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span>Giá trị trước khi sửa:</span>
                <strong className="font-mono">
                  {formatCurrencyVND(transaction.amount)}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Giá trị mới sau khi sửa:</span>
                <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                  {formatCurrencyVND(numericNewAmount)} (
                  {amountDiff >= 0 ? '+' : ''}
                  {formatCurrencyVND(amountDiff)})
                </strong>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Hệ thống tự động cập nhật phần chênh lệch vào số dư quỹ, đảm bảo không cộng/trừ tiền trùng.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="edit-tx-amount"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Số tiền mới (VNĐ) *
                </label>
                <input
                  id="edit-tx-amount"
                  data-testid="edit-tx-amount"
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-tx-account"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Quỹ tiền
                </label>
                <select
                  id="edit-tx-account"
                  value={accountType}
                  onChange={(e) =>
                    setAccountType(e.target.value as AccountType)
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="cash">Quỹ Tiền Mặt Tại Xưởng</option>
                  <option value="bank">Tài Khoản Ngân Hàng</option>
                </select>
              </div>
            </div>

            {!isTransfer && (
              <div>
                <label
                  htmlFor="edit-tx-category"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Danh mục thu / chi
                </label>
                <select
                  id="edit-tx-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="edit-tx-counterparty"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Đối tượng nộp / nhận *
              </label>
              <input
                id="edit-tx-counterparty"
                type="text"
                required
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="edit-tx-description"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Nội dung chi tiết *
              </label>
              <input
                id="edit-tx-description"
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="edit-tx-reason"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Lý do điều chỉnh (Lưu vào Nhật ký hoạt động) *
              </label>
              <input
                id="edit-tx-reason"
                type="text"
                required
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMode('view')}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="submit"
                data-testid="btn-save-edit-tx"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                {submitting ? 'Đang cập nhật...' : 'Lưu cập nhật'}
              </button>
            </div>
          </form>
        )}

        {/* 3. CONFIRM CANCEL MODE */}
        {mode === 'confirm_cancel' && (
          <form onSubmit={handleSubmitCancel} className="mt-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  Xác nhận hủy giao dịch {transaction.code} ({formatCurrencyVND(transaction.amount)})?
                </p>
                <p>
                  Sau khi hủy, số tiền{' '}
                  <strong>{formatCurrencyVND(transaction.amount)}</strong> sẽ
                  được hoàn trả chính xác về số dư{' '}
                  {transaction.accountType === 'cash'
                    ? 'Quỹ Tiền Mặt'
                    : 'Tài Khoản Ngân Hàng'}{' '}
                  và lưu vết kiểm toán vào Nhật ký hoạt động.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-cancel-reason"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Lý do hủy giao dịch *
              </label>
              <input
                id="confirm-cancel-reason"
                data-testid="confirm-cancel-reason"
                type="text"
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy phiếu..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMode('view')}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="submit"
                data-testid="btn-confirm-cancel-tx"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận hủy giao dịch'}
              </button>
            </div>
          </form>
        )}

        {/* 4. CONFIRM RESTORE MODE */}
        {mode === 'confirm_restore' && (
          <form onSubmit={handleSubmitRestore} className="mt-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
              <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  Khôi phục giao dịch {transaction.code} ({formatCurrencyVND(transaction.amount)})?
                </p>
                <p>
                  Giao dịch sẽ chuyển về trạng thái Đang hiệu lực và tính lại vào số dư quỹ. Thao tác khôi phục được ghi vào Nhật ký hoạt động.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-restore-reason"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Lý do khôi phục *
              </label>
              <input
                id="confirm-restore-reason"
                data-testid="confirm-restore-reason"
                type="text"
                required
                value={restoreReason}
                onChange={(e) => setRestoreReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMode('view')}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="submit"
                data-testid="btn-confirm-restore-tx"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                {submitting ? 'Đang khôi phục...' : 'Xác nhận khôi phục'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import type { ToastMessage } from '../types/factory';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-testid="toast-container"
      className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-3 sm:px-0 no-print"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            role="status"
            data-testid="toast-notification"
            data-toast-type={toast.type}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-all ${
              isSuccess
                ? 'bg-emerald-950/95 border-emerald-600 text-white'
                : isError
                  ? 'bg-rose-950/95 border-rose-600 text-white'
                  : isWarning
                    ? 'bg-amber-950/95 border-amber-500 text-white'
                    : 'bg-[#0F2942] border-sky-500 text-white'
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {isSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : isError ? (
                <XCircle className="w-5 h-5 text-rose-400" />
              ) : isWarning ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <Info className="w-5 h-5 text-sky-400" />
              )}
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-extrabold leading-snug">
                {toast.title}
              </p>
              {toast.detail && (
                <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                  {toast.detail}
                </p>
              )}
              <span className="block text-[10px] font-mono text-slate-300 mt-1">
                Xác nhận lúc {toast.timestamp}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Đóng thông báo"
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

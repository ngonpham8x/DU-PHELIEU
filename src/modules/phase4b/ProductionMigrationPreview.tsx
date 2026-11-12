import { useMemo, useState } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import type { EmployeeProfile, ShiftDefinition } from '../../types/factory';
import { createWorkshopMigrationPreview } from './migrationPreview';

type Props = {
  employees: EmployeeProfile[];
  shifts: ShiftDefinition[];
};

function downloadPreview(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'XemTruoc_ChuyenNhanSu_DuNhua.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProductionMigrationPreview({ employees, shifts }: Props) {
  const [workshopId, setWorkshopId] = useState('du_nhua_01');
  const preview = useMemo(
    () => createWorkshopMigrationPreview(workshopId, employees, shifts),
    [employees, shifts, workshopId],
  );

  return (
    <section
      data-testid="production-migration-preview"
      className="rounded-xl border border-sky-200 dark:border-sky-900 bg-white dark:bg-slate-900 p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Phase 4B – Xem trước chuyển nhân sự lên Production</h2>
          <p className="text-xs text-slate-500 mt-1">
            Chỉ kiểm tra dữ liệu DEMO và tạo tệp đối soát. Không ghi Firestore, không chuyển mẫu khuôn mặt.
          </p>
        </div>
        <button
          type="button"
          data-testid="download-migration-preview"
          onClick={() => downloadPreview(JSON.stringify(preview, null, 2))}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white px-4 py-2 text-xs font-bold"
        >
          <Download className="w-4 h-4" />
          Tải gói xem trước
        </button>
      </div>

      <label className="block max-w-md text-xs font-semibold text-slate-700 dark:text-slate-300">
        Mã xưởng dự kiến
        <input
          data-testid="migration-workshop-id"
          value={workshopId}
          onChange={(event) => setWorkshopId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        {[
          ['Nhân viên', preview.summary.employeeCount],
          ['Đang làm', preview.summary.activeEmployeeCount],
          ['Ca làm', preview.summary.shiftCount],
          ['Lỗi phải sửa', preview.summary.errorCount],
          ['Cảnh báo', preview.summary.warningCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
            <div className="text-slate-500">{label}</div>
            <strong className="text-base">{value}</strong>
          </div>
        ))}
      </div>

      {preview.issues.length > 0 ? (
        <div data-testid="migration-issues" className="max-h-48 overflow-y-auto space-y-1">
          {preview.issues.map((issue, index) => (
            <p
              key={`${issue.code}-${index}`}
              className={`rounded-md px-3 py-2 text-xs ${issue.severity === 'error' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'}`}
            >
              <strong>{issue.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}:</strong> {issue.message}
            </p>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="w-4 h-4" /> Dữ liệu đủ điều kiện tạo gói xem trước.
        </p>
      )}

      <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
        Tệp tải xuống không phải tệp nhập trực tiếp. Chỉ chuyển dữ liệu sau khi có sao lưu, Rules nhiều xưởng đã nghiệm thu và bản xem trước không còn lỗi.
      </p>
    </section>
  );
}

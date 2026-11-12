import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  History,
  Lock,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  ActivityLogRecord,
  ActivityModuleType,
  UserRole,
} from '../types/factory';
import { ROLE_LABELS, TODAY_STR } from '../data/demoSeed';
import { canViewActivityLogs } from '../utils/calculations';

interface ActivityLogViewProps {
  logs: ActivityLogRecord[];
  userRole: UserRole;
  onPermissionDenied: (actionLabel: string) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
  logs,
  userRole,
  onPermissionDenied,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<'all' | ActivityModuleType>(
    'all'
  );
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'edits_only'>(
    'all'
  );
  const [selectedLog, setSelectedLog] = useState<ActivityLogRecord | null>(
    null
  );

  const hasAccess = canViewActivityLogs(userRole);

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (moduleFilter !== 'all' && item.moduleName !== moduleFilter) {
        return false;
      }
      if (timeFilter === 'today' && !item.timestampStr.startsWith(TODAY_STR)) {
        return false;
      }
      if (
        timeFilter === 'edits_only' &&
        !item.actionType.toLowerCase().includes('sửa') &&
        !item.actionType.toLowerCase().includes('hủy') &&
        !item.actionType.toLowerCase().includes('khôi phục')
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchActor = item.actorName.toLowerCase().includes(q);
        const matchUid = item.actorUid.toLowerCase().includes(q);
        const matchCode = item.targetCode.toLowerCase().includes(q);
        const matchAction = item.actionType.toLowerCase().includes(q);
        const matchPrev = item.previousValue.toLowerCase().includes(q);
        const matchNew = item.newValue.toLowerCase().includes(q);
        const matchReason = item.reason.toLowerCase().includes(q);
        if (
          !matchActor &&
          !matchUid &&
          !matchCode &&
          !matchAction &&
          !matchPrev &&
          !matchNew &&
          !matchReason
        ) {
          return false;
        }
      }
      return true;
    });
  }, [logs, moduleFilter, timeFilter, searchQuery]);

  if (!hasAccess) {
    return (
      <div
        data-testid="page-activity-log-restricted"
        className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-6 text-center space-y-3"
      >
        <Lock className="w-8 h-8 text-amber-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Nhật Ký Hoạt Động Giới Hạn Theo Phân Quyền
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
          Vai trò hiện tại ({ROLE_LABELS[userRole].name}) không có quyền truy cập nhật ký hoạt động tài chính và kiểm toán của nhà xưởng. Chỉ Chủ xưởng, Quản lý và Kế toán được cấp quyền tra cứu.
        </p>
        <button
          type="button"
          onClick={() =>
            onPermissionDenied('Xem hoặc chỉnh sửa Nhật ký hoạt động')
          }
          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
        >
          Kiểm tra quyền truy cập
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="page-activity-log">
      {/* Header & Immutable Server Security Notice */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#0F2942] dark:text-emerald-400" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Nhật Ký Hoạt Động & Lịch Sử Kiểm Toán ({filteredLogs.length} bản ghi)
              </h2>
              <p className="text-xs text-slate-500">
                Ghi nhận đầy đủ: Người thực hiện, UID, Thời gian máy chủ, Mã giao dịch, Giá trị trước/sau khi sửa, Lý do và Kết quả.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Bảo vệ cấp máy chủ: Cấm xóa lịch sử hoạt động</span>
          </span>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              aria-label="Tìm kiếm trong nhật ký hoạt động"
              placeholder="Tìm mã phiếu, tên người, UID, số tiền trước/sau..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <select
            aria-label="Lọc theo phân hệ chức năng"
            value={moduleFilter}
            onChange={(e) =>
              setModuleFilter(e.target.value as 'all' | ActivityModuleType)
            }
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
          >
            <option value="all">Tất cả chức năng thao tác</option>
            <option value="Thu – Chi">Chức năng: Thu – Chi</option>
            <option value="Chấm công">Chức năng: Chấm công</option>
            <option value="Nhân sự">Chức năng: Nhân sự</option>
            <option value="Cân nhựa">Chức năng: Cân nhựa</option>
            <option value="Phân loại & Băm nhựa">Chức năng: Phân loại &amp; Băm nhựa</option>
            <option value="Kho nhựa">Chức năng: Kho nhựa</option>
            <option value="Hệ thống">Chức năng: Hệ thống</option>
          </select>

          <select
            aria-label="Lọc theo thời gian và loại thao tác"
            value={timeFilter}
            onChange={(e) =>
              setTimeFilter(
                e.target.value as 'all' | 'today' | 'edits_only'
              )
            }
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
          >
            <option value="all">Tất cả thời gian</option>
            <option value="today">Trong ngày hôm nay ({TODAY_STR})</option>
            <option value="edits_only">
              Chỉ các thao tác Sửa / Hủy / Khôi phục
            </option>
          </select>
        </div>

        {/* Activity Log Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table
            className="w-full text-left border-collapse"
            data-testid="activity-log-table"
          >
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <th className="py-3 px-3 font-semibold">Thời gian máy chủ</th>
                <th className="py-3 px-3 font-semibold">
                  Người thực hiện & UID
                </th>
                <th className="py-3 px-3 font-semibold">
                  Chức năng · Thao tác
                </th>
                <th className="py-3 px-3 font-semibold">Mã GD</th>
                <th className="py-3 px-3 font-semibold">
                  Giá trị trước khi sửa
                </th>
                <th className="py-3 px-3 font-semibold">
                  Giá trị sau khi sửa
                </th>
                <th className="py-3 px-3 font-semibold">Lý do / Ghi chú</th>
                <th className="py-3 px-3 text-right font-semibold">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  data-testid="activity-log-row"
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {log.timestampStr}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {log.actorName}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      UID: {log.actorUid}
                    </p>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {log.moduleName}
                    </span>
                    <span className="mx-1 text-slate-400">·</span>
                    <span
                      className={`font-bold ${
                        log.actionType.includes('Hủy')
                          ? 'text-rose-700 dark:text-rose-400'
                          : log.actionType.includes('Sửa')
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {log.actionType}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-[#0F2942] dark:text-sky-400 whitespace-nowrap">
                    {log.targetCode}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 max-w-[190px] truncate">
                    {log.previousValue}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white max-w-[210px] truncate">
                    {log.newValue}
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-[180px] truncate">
                    {log.reason}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{log.resultStatus}</span>
                      <Eye className="w-3.5 h-3.5 ml-1 text-slate-400" />
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    Không tìm thấy bản ghi nhật ký hoạt động nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Xem Chi Tiết Bản Ghi Nhật Ký */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-detail-title"
          data-testid="activity-log-detail-modal"
        >
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#0F2942] dark:text-emerald-400" />
                <h3
                  id="log-detail-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  Chi Tiết Nhật Ký Hoạt Động – {selectedLog.targetCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Đóng chi tiết nhật ký"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block">
                    Tên người thực hiện
                  </span>
                  <strong className="text-slate-900 dark:text-white">
                    {selectedLog.actorName}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">UID tài khoản</span>
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {selectedLog.actorUid}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Thời gian máy chủ
                  </span>
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {selectedLog.timestampStr}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Chức năng & Loại thao tác
                  </span>
                  <strong className="text-slate-900 dark:text-white">
                    {selectedLog.moduleName} · {selectedLog.actionType}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Mã giao dịch</span>
                  <strong className="font-mono text-[#0F2942] dark:text-sky-400">
                    {selectedLog.targetCode}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Kết quả thao tác
                  </span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {selectedLog.resultStatus}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div>
                  <span className="text-slate-500 block">
                    Giá trị trước khi sửa
                  </span>
                  <div className="mt-1 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">
                    {selectedLog.previousValue}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Giá trị sau khi sửa
                  </span>
                  <div className="mt-1 p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 font-mono font-bold text-slate-900 dark:text-white">
                    {selectedLog.newValue}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    Lý do hủy hoặc điều chỉnh
                  </span>
                  <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                    {selectedLog.reason}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-[#0F2942] text-white text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

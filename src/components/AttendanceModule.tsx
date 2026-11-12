import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  Filter,
  Lock,
  Moon,
  PlusCircle,
  Printer,
  ScanFace,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AttendanceAttemptTrace,
  AttendanceRecord,
  DailyTimesheetRow,
  EmployeeProfile,
  ShiftDefinition,
  UserRole,
} from '../types/factory';
import {
  canApproveFallbackAttendance,
  canEditAttendanceTime,
  canViewFullAttendanceTable,
  computeDailyTimesheetRows,
} from '../utils/calculations';
import { TODAY_STR } from '../data/demoSeed';
import { exportExcelWorkbook } from '../utils/excel';

interface AttendanceModuleProps {
  attendance: AttendanceRecord[];
  attemptTraces: AttendanceAttemptTrace[];
  employees: EmployeeProfile[];
  shifts: ShiftDefinition[];
  userRole: UserRole;
  loggedInEmployeeCode: string;
  onOpenQuickAttendance: () => void;
  onReviewFallbackRequest: (
    record: AttendanceRecord,
    decision: 'approved' | 'rejected',
    reviewReason: string
  ) => Promise<void>;
  onAdjustAttendanceRow: (
    row: DailyTimesheetRow,
    newCheckInTime: string,
    newCheckOutTime: string,
    reason: string
  ) => Promise<void>;
  onSaveShiftConfig: (updatedShift: ShiftDefinition) => void;
  onPermissionDenied: (actionLabel: string) => void;
}

export const AttendanceModule: React.FC<AttendanceModuleProps> = ({
  attendance,
  attemptTraces,
  employees,
  shifts,
  userRole,
  loggedInEmployeeCode,
  onOpenQuickAttendance,
  onReviewFallbackRequest,
  onAdjustAttendanceRow,
  onSaveShiftConfig,
  onPermissionDenied,
}) => {
  const canViewAll = canViewFullAttendanceTable(userRole);
  const canEditHours = canEditAttendanceTime(userRole);
  const canApproveFallback = canApproveFallbackAttendance(userRole);
  const visibleAttemptTraces = useMemo(
    () =>
      attemptTraces
        .filter(
          (trace) => canViewAll || !trace.employeeCode || trace.employeeCode === loggedInEmployeeCode
        )
        .slice(0, 12),
    [attemptTraces, canViewAll, loggedInEmployeeCode]
  );

  // Filters for Bảng Chấm Công
  const [empFilter, setEmpFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Fallback review state
  const [reviewingRecord, setReviewingRecord] =
    useState<AttendanceRecord | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>(
    'approved'
  );
  const [reviewReason, setReviewReason] = useState(
    'Đã đối chiếu thực tế tại xưởng và xác nhận hợp lệ'
  );
  const [reviewError, setReviewError] = useState('');

  // Adjust attendance hours modal state
  const [adjustingRow, setAdjustingRow] = useState<DailyTimesheetRow | null>(
    null
  );
  const [adjCheckIn, setAdjCheckIn] = useState('06:30');
  const [adjCheckOut, setAdjCheckOut] = useState('14:30');
  const [adjReason, setAdjReason] = useState('');
  const [adjError, setAdjError] = useState('');

  // Shift configuration modal state
  const [editingShift, setEditingShift] = useState<ShiftDefinition | null>(
    null
  );

  // Compute all daily timesheet rows
  const allTimesheetRows = useMemo(
    () => computeDailyTimesheetRows(attendance, employees, shifts),
    [attendance, employees, shifts]
  );

  // Distinct departments, dates, and months for filters
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.department));
    return Array.from(set);
  }, [employees]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    allTimesheetRows.forEach((r) => set.add(r.workDateStr));
    return Array.from(set);
  }, [allTimesheetRows]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allTimesheetRows.forEach((r) => {
      if (r.workDateStr.length >= 10) {
        set.add(r.workDateStr.slice(3, 10));
      }
    });
    return Array.from(set);
  }, [allTimesheetRows]);

  // Apply RBAC + Filters to timesheet rows
  const filteredRows = useMemo(() => {
    return allTimesheetRows.filter((row) => {
      // RBAC: Workers only see their own attendance rows!
      if (!canViewAll && row.employeeCode !== loggedInEmployeeCode) {
        return false;
      }
      if (canViewAll && empFilter !== 'all' && row.employeeCode !== empFilter) {
        return false;
      }
      if (deptFilter !== 'all' && row.department !== deptFilter) {
        return false;
      }
      if (dateFilter !== 'all' && row.workDateStr !== dateFilter) {
        return false;
      }
      if (
        monthFilter !== 'all' &&
        !row.workDateStr.endsWith(monthFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [
    allTimesheetRows,
    canViewAll,
    loggedInEmployeeCode,
    empFilter,
    deptFilter,
    dateFilter,
    monthFilter,
  ]);

  // Fallback requests list (filtered by RBAC)
  const fallbackRequests = useMemo(() => {
    return attendance.filter((r) => {
      if (r.method !== 'fallback_manual') return false;
      if (!canViewAll && r.employeeCode !== loggedInEmployeeCode) return false;
      return true;
    });
  }, [attendance, canViewAll, loggedInEmployeeCode]);

  const pendingFallbackCount = useMemo(
    () =>
      fallbackRequests.filter((r) => r.approvalStatus === 'pending_approval')
        .length,
    [fallbackRequests]
  );

  // Summary KPIs for the filtered timesheet
  const summaryStats = useMemo(() => {
    let totalActualHours = 0;
    let totalOvertimeHours = 0;
    let lateCount = 0;
    let overnightCount = 0;
    for (const r of filteredRows) {
      totalActualHours += r.actualHours;
      totalOvertimeHours += r.overtimeHours;
      if (r.lateMinutes > 0) lateCount += 1;
      if (r.isOvernightShift) overnightCount += 1;
    }
    return {
      totalRows: filteredRows.length,
      totalActualHours: Number(totalActualHours.toFixed(2)),
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
      lateCount,
      overnightCount,
    };
  }, [filteredRows]);

  const handleExportTimesheetExcel = async () => {
    try {
      await exportExcelWorkbook({
        filename: `BangChamCong_DuNhuaPheLieu_${TODAY_STR.replace(/\//g, '-')}.xlsx`,
        subject: 'Bảng chấm công Dư-Nhựa phế liệu',
        sheets: [
          {
            name: 'Chấm công',
            title: 'BẢNG CHẤM CÔNG DƯ-NHỰA PHẾ LIỆU',
            subtitle: `${filteredRows.length} dòng theo bộ lọc hiện tại · Ngày xuất ${TODAY_STR}`,
            columns: [
              { header: 'Mã NV', key: 'employeeCode', width: 14 },
              { header: 'Họ tên', key: 'employeeName', width: 28 },
              { header: 'Bộ phận', key: 'department', width: 22 },
              { header: 'Ca làm việc', key: 'shiftName', width: 24 },
              { header: 'Ngày làm', key: 'workDate', width: 14 },
              { header: 'Giờ vào', key: 'checkIn', width: 12 },
              { header: 'Giờ ra', key: 'checkOut', width: 12 },
              { header: 'Giờ thực tế', key: 'actualHours', width: 15, numFmt: '0.00' },
              { header: 'Tăng ca', key: 'overtimeHours', width: 12, numFmt: '0.00' },
              { header: 'Trễ (phút)', key: 'lateMinutes', width: 13, numFmt: '0' },
              { header: 'Trạng thái', key: 'status', width: 22 },
              { header: 'Ghi chú', key: 'notes', width: 38 },
            ],
            rows: filteredRows.map((row) => ({
              employeeCode: row.employeeCode,
              employeeName: row.employeeName,
              department: row.department,
              shiftName: row.shiftName,
              workDate: row.workDateStr,
              checkIn: row.checkInTime,
              checkOut: row.checkOutTime,
              actualHours: row.actualHours,
              overtimeHours: row.overtimeHours,
              lateMinutes: row.lateMinutes,
              status: row.statusLabel,
              notes: row.notes,
            })),
          },
          {
            name: 'Tổng hợp',
            title: 'TỔNG HỢP CHẤM CÔNG',
            subtitle: 'Tổng hợp theo đúng bộ lọc đang hiển thị trên màn hình.',
            columns: [
              { header: 'Chỉ tiêu', key: 'label', width: 38 },
              { header: 'Giá trị', key: 'value', width: 18, numFmt: '0.00' },
            ],
            rows: [
              { label: 'Số ca/ngày công hiển thị', value: summaryStats.totalRows },
              { label: 'Tổng giờ thực tế', value: summaryStats.totalActualHours },
              { label: 'Tổng giờ tăng ca', value: summaryStats.totalOvertimeHours },
              { label: 'Số lượt đi trễ', value: summaryStats.lateCount },
              { label: 'Số ca qua đêm', value: summaryStats.overnightCount },
            ],
          },
        ],
      });
    } catch {
      window.alert('Không thể xuất tệp Excel. Vui lòng thử lại.');
    }
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRecord) return;
    if (!reviewReason.trim() || reviewReason.trim().length < 3) {
      setReviewError(
        'Vui lòng nhập lý do duyệt hoặc từ chối tối thiểu 3 ký tự để lưu vào Nhật ký hoạt động.'
      );
      return;
    }
    setReviewError('');
    await onReviewFallbackRequest(
      reviewingRecord,
      reviewDecision,
      reviewReason.trim()
    );
    setReviewingRecord(null);
  };

  const handleConfirmAdjustRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingRow) return;
    if (!adjReason.trim() || adjReason.trim().length < 3) {
      setAdjError(
        'Bắt buộc nhập lý do điều chỉnh giờ công (tối thiểu 3 ký tự) để kiểm toán trong Nhật ký hoạt động.'
      );
      return;
    }
    setAdjError('');
    await onAdjustAttendanceRow(
      adjustingRow,
      adjCheckIn,
      adjCheckOut,
      adjReason.trim()
    );
    setAdjustingRow(null);
  };

  return (
    <div className="space-y-6" data-testid="page-attendance">
      {/* Header & Primary Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Bảng Chấm Công Khuôn Mặt, Duyệt Dự Phòng & Quản Lý Ca
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Thời gian chấm công chuẩn hóa theo giờ máy chủ múi giờ{' '}
            <code className="font-mono font-bold">Asia/Ho_Chi_Minh</code>. Yêu
            cầu chấm công dự phòng phải được quản lý duyệt mới tính công.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            data-testid="open-attendance-modal-btn"
            onClick={onOpenQuickAttendance}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer shadow-xs"
          >
            <ScanFace className="w-4 h-4" />
            <span>Mở Máy Chấm Công Khuôn Mặt</span>
          </button>
          <button
            type="button"
            data-testid="export-timesheet-excel-btn"
            onClick={handleExportTimesheetExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Xuất Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            data-testid="print-timesheet-btn"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>In Bảng Công</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs font-semibold text-slate-500">
            Số ca / Ngày công hiển thị
          </span>
          <p
            data-testid="timesheet-kpi-rows"
            className="mt-1.5 text-xl font-extrabold font-mono text-slate-900 dark:text-white"
          >
            {summaryStats.totalRows} ngày công
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Ca đêm qua ngày: {summaryStats.overnightCount} ca
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs font-semibold text-slate-500">
            Tổng giờ làm thực tế
          </span>
          <p
            data-testid="timesheet-kpi-actual-hours"
            className="mt-1.5 text-xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400"
          >
            {summaryStats.totalActualHours} giờ
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Đã trừ thời gian nghỉ giữa ca
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs font-semibold text-slate-500">
            Tổng giờ tăng ca
          </span>
          <p
            data-testid="timesheet-kpi-overtime-hours"
            className="mt-1.5 text-xl font-extrabold font-mono text-blue-700 dark:text-blue-400"
          >
            {summaryStats.totalOvertimeHours} giờ
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Tính theo định mức giờ công từng ca
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs font-semibold text-slate-500">
            Yêu cầu dự phòng chờ duyệt
          </span>
          <p
            data-testid="timesheet-kpi-pending-fallback"
            className={`mt-1.5 text-xl font-extrabold font-mono ${
              pendingFallbackCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {pendingFallbackCount} yêu cầu
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Đi muộn ghi nhận: {summaryStats.lateCount} lượt
          </p>
        </div>
      </div>

      <section
        data-testid="attendance-attempt-traces"
        className="rounded-xl border border-sky-200 dark:border-sky-900/70 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-3"
      >
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Dấu vết chống mất công ({visibleAttemptTraces.length})
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Camera lỗi, nhận diện lỗi hoặc máy chủ chưa xác nhận vẫn được lưu dấu vết cục bộ để quản lý đối chiếu. Không lưu ảnh khuôn mặt trong nhật ký này.
            </p>
          </div>
        </div>
        {visibleAttemptTraces.length === 0 ? (
          <p className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500">
            Chưa có lần chấm công mới cần truy vết trên thiết bị này.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleAttemptTraces.map((trace) => (
              <article key={trace.id} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <strong>{trace.employeeName || 'Chưa nhận diện'} {trace.employeeCode ? `(${trace.employeeCode})` : ''}</strong>
                  <span className={`font-bold ${trace.status === 'saved' ? 'text-emerald-700' : trace.status === 'failed' ? 'text-rose-700' : 'text-amber-700'}`}>
                    {trace.status === 'saved' ? 'Đã lưu' : trace.status === 'failed' ? 'Cần đối chiếu' : 'Đang xử lý'}
                  </span>
                </div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{trace.message}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">Mã vết: {trace.id} · {trace.dateStr} {trace.timeStr}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 1: DANH SÁCH YÊU CẦU CHẤM CÔNG DỰ PHÒNG (CHỜ DUYỆT / ĐÃ XỬ LÝ) */}
      <div
        data-testid="fallback-approval-section"
        className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-amber-200/80 dark:border-amber-900/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Danh Sách Yêu Cầu Chấm Công Dự Phòng ({fallbackRequests.length}{' '}
                yêu cầu · {pendingFallbackCount} chờ duyệt)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Khi không có camera, mất mạng hoặc lỗi nhận diện, yêu cầu dự
                phòng luôn ở trạng thái <strong>Chờ duyệt</strong> và chưa được
                tính công cho đến khi Quản lý phê duyệt.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300">
            {canApproveFallback
              ? 'Quyền Quản lý: Được phép Duyệt / Từ chối'
              : 'Quyền Công nhân: Chỉ xem trạng thái yêu cầu'}
          </span>
        </div>

        {fallbackRequests.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Hiện không có yêu cầu chấm công dự phòng nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left border-collapse text-xs"
              data-testid="fallback-requests-table"
            >
              <thead>
                <tr className="border-b border-amber-200 dark:border-amber-900/60 text-slate-600 dark:text-slate-300">
                  <th className="py-2 pr-3 font-semibold">Nhân viên</th>
                  <th className="py-2 px-3 font-semibold">Loại & Ca</th>
                  <th className="py-2 px-3 font-semibold">Thời gian yêu cầu</th>
                  <th className="py-2 px-3 font-semibold">
                    Lý do dự phòng & Quản lý nhận
                  </th>
                  <th className="py-2 px-3 font-semibold">Trạng thái duyệt</th>
                  <th className="py-2 pl-3 text-right font-semibold no-print">
                    Phê duyệt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
                {fallbackRequests.map((req) => {
                  const status = req.approvalStatus || 'approved';
                  return (
                    <tr
                      key={req.id}
                      data-testid={`fallback-row-${req.employeeCode}-${req.eventType}`}
                    >
                      <td className="py-2.5 pr-3 font-bold text-slate-900 dark:text-white">
                        {req.employeeName}{' '}
                        <span className="font-mono font-normal text-slate-500">
                          ({req.employeeCode})
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-blue-700 dark:text-blue-400">
                          {req.eventType === 'check_in'
                            ? 'VÀO CA'
                            : req.eventType === 'check_out'
                              ? 'RA CA'
                              : req.eventType === 'leave'
                                ? 'NGHỈ PHÉP'
                                : 'NGHỈ GIỮA CA'}
                        </span>{' '}
                        · {req.shiftName}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {req.dateStr} · {req.timeStr}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        <p>{req.fallbackReason}</p>
                        <p className="text-slate-500">
                          Người nhận duyệt: {req.approvedBy || 'Quản lý xưởng'}
                          {req.reviewReason
                            ? ` · Phản hồi: ${req.reviewReason}`
                            : ''}
                        </p>
                      </td>
                      <td className="py-2.5 px-3">
                        {status === 'pending_approval' && (
                          <span
                            data-testid={`fallback-status-${req.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold"
                          >
                            <Clock className="w-3 h-3" />
                            <span>Chờ duyệt (Chưa tính công)</span>
                          </span>
                        )}
                        {status === 'approved' && (
                          <span
                            data-testid={`fallback-status-${req.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã duyệt (Hợp lệ)</span>
                          </span>
                        )}
                        {status === 'rejected' && (
                          <span
                            data-testid={`fallback-status-${req.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Đã từ chối</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap no-print">
                        {status === 'pending_approval' ? (
                          canApproveFallback ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                data-testid={`btn-approve-fallback-${req.employeeCode}`}
                                onClick={() => {
                                  setReviewingRecord(req);
                                  setReviewDecision('approved');
                                  setReviewReason(
                                    'Xác nhận nhân viên có mặt làm việc thực tế tại xưởng'
                                  );
                                  setReviewError('');
                                }}
                                className="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-bold cursor-pointer"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                data-testid={`btn-reject-fallback-${req.employeeCode}`}
                                onClick={() => {
                                  setReviewingRecord(req);
                                  setReviewDecision('rejected');
                                  setReviewReason(
                                    'Không khớp giờ thực tế tại cổng bảo vệ'
                                  );
                                  setReviewError('');
                                }}
                                className="px-2.5 py-1 rounded-md bg-rose-700 hover:bg-rose-600 text-white font-bold cursor-pointer"
                              >
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              Chờ quản lý duyệt
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: BẢNG CHẤM CÔNG THEO NGÀY & THÁNG (9 CỘT CHUẨN) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Bảng Chấm Công Tổng Hợp Theo Ngày & Tháng ({filteredRows.length}{' '}
              dòng)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {canViewAll
                ? 'Chế độ Quản lý / Chủ xưởng / Nhân sự: Xem toàn bộ nhân viên và được phép điều chỉnh giờ công có ghi nhật ký.'
                : `Chế độ Công nhân: Chỉ hiển thị dữ liệu chấm công cá nhân của ${loggedInEmployeeCode}, khóa quyền sửa giờ.`}
            </p>
          </div>
          <span
            data-testid="attendance-rbac-badge"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
              canEditHours
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>
              {canEditHours
                ? 'Quản lý được phép duyệt / hiệu chỉnh giờ công'
                : 'Công nhân chỉ xem dữ liệu cá nhân · Không được sửa giờ công'}
            </span>
          </span>
        </div>

        {/* Filter Bar: Nhân viên, Bộ phận, Ngày, Tháng */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
          <div>
            <label
              htmlFor="ts-filter-emp"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              Lọc theo nhân viên
            </label>
            <select
              id="ts-filter-emp"
              data-testid="ts-filter-emp"
              disabled={!canViewAll}
              value={canViewAll ? empFilter : loggedInEmployeeCode}
              onChange={(e) => setEmpFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white disabled:opacity-60"
            >
              <option value="all">Tất cả nhân viên ({employees.length})</option>
              {employees.map((e) => (
                <option key={e.code} value={e.code}>
                  {e.code} – {e.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ts-filter-dept"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              Lọc theo bộ phận
            </label>
            <select
              id="ts-filter-dept"
              data-testid="ts-filter-dept"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value="all">Tất cả bộ phận</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ts-filter-date"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              Lọc theo ngày làm
            </label>
            <select
              id="ts-filter-date"
              data-testid="ts-filter-date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value="all">Tất cả các ngày</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  Ngày {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ts-filter-month"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              Lọc theo tháng (MM/YYYY)
            </label>
            <select
              id="ts-filter-month"
              data-testid="ts-filter-month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value="all">Tất cả các tháng</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 9-Column Timesheet Table */}
        <div className="overflow-x-auto">
          <table
            className="w-full text-left border-collapse"
            data-testid="daily-timesheet-table"
          >
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                <th className="py-3 px-3 font-semibold">1. Họ tên</th>
                <th className="py-3 px-3 font-semibold">2. Bộ phận</th>
                <th className="py-3 px-3 font-semibold">3. Ngày làm</th>
                <th className="py-3 px-3 font-semibold">4. Giờ vào</th>
                <th className="py-3 px-3 font-semibold">5. Giờ ra</th>
                <th className="py-3 px-3 text-right font-semibold">
                  6. Giờ làm thực tế
                </th>
                <th className="py-3 px-3 text-right font-semibold">
                  7. Tăng ca
                </th>
                <th className="py-3 px-3 font-semibold">8. Trạng thái</th>
                <th className="py-3 px-3 font-semibold">
                  9. Ghi chú & Điều chỉnh
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredRows.map((row) => (
                <tr
                  key={row.rowKey}
                  data-testid={`timesheet-row-${row.employeeCode}-${row.workDateStr}`}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                    <div>
                      {row.employeeName}{' '}
                      <span className="font-mono font-normal text-slate-500">
                        ({row.employeeCode})
                      </span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 flex items-center gap-1 mt-0.5">
                      {row.isOvernightShift && (
                        <Moon className="w-3 h-3 text-indigo-500" />
                      )}
                      <span>{row.shiftName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                    {row.department}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {row.workDateStr}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {row.checkInTime}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                    {row.checkOutTime}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {row.actualHours > 0 ? `${row.actualHours}h` : '0h'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                    {row.overtimeHours > 0 ? `+${row.overtimeHours}h` : '0h'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md font-bold ${
                        row.statusTone === 'emerald'
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : row.statusTone === 'amber'
                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : row.statusTone === 'rose'
                              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span>{row.notes}</span>
                      {canEditHours && (
                        <button
                          type="button"
                          data-testid={`btn-adjust-hours-${row.employeeCode}-${row.workDateStr}`}
                          onClick={() => {
                            setAdjustingRow(row);
                            setAdjCheckIn(
                              row.checkInTime !== '—' ? row.checkInTime : '06:30'
                            );
                            setAdjCheckOut(
                              row.checkOutTime !== '—'
                                ? row.checkOutTime
                                : '14:30'
                            );
                            setAdjReason('');
                            setAdjError('');
                          }}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold no-print cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa giờ</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    Không có dữ liệu chấm công phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: CẤU HÌNH CA LÀM VIỆC & QUY TẮC TÍNH TĂNG CA LINH HOẠT */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#0F2942] dark:text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cấu Hình Ca Làm Việc & Quy Tắc Tính Tăng Ca Nhà Xưởng
              </h3>
              <p className="text-xs text-slate-500">
                Chủ xưởng cấu hình giờ vào, giờ ra, nghỉ giữa ca, số giờ công
                chuẩn mỗi ca (không cố định cứng 8 giờ) và hệ số tăng ca.
              </p>
            </div>
          </div>
          {canEditHours && (
            <button
              type="button"
              data-testid="btn-add-shift"
              onClick={() =>
                setEditingShift({
                  id: `shift-custom-${Date.now()}`,
                  name: 'Ca tăng cường băm nhựa (18:00 - 23:00)',
                  shiftType: 'flexible',
                  startTime: '18:00',
                  endTime: '23:00',
                  breakMinutes: 30,
                  graceLateMinutes: 10,
                  hoursCount: 4.5,
                  isOvernight: false,
                  overtimeMultiplier: 1.5,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F2942] text-white text-xs font-bold cursor-pointer no-print"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Thêm Ca Mới</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {shifts.map((sh) => (
            <div
              key={sh.id}
              data-testid={`shift-card-${sh.id}`}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between space-y-2"
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {sh.name}
                  </h4>
                  {sh.isOvernight && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-bold shrink-0">
                      Qua đêm
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                  {sh.startTime} → {sh.endTime}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                  Công chuẩn: <strong>{sh.hoursCount} giờ/ca</strong> · Nghỉ:{' '}
                  {sh.breakMinutes}p
                </p>
                <p className="text-[11px] text-slate-500">
                  Trễ cho phép: {sh.graceLateMinutes}p · Hệ số OT:{' '}
                  {sh.overtimeMultiplier || 1.5}x
                </p>
              </div>
              {canEditHours && (
                <button
                  type="button"
                  onClick={() => setEditingShift(sh)}
                  className="w-full py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer no-print"
                >
                  Cấu hình ca
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MODAL 1: DUYỆT / TỪ CHỐI YÊU CẦU CHẤM CÔNG DỰ PHÒNG */}
      {reviewingRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="fallback-review-modal"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {reviewDecision === 'approved'
                    ? 'Phê Duyệt Chấm Công Dự Phòng'
                    : 'Từ Chối Chấm Công Dự Phòng'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewingRecord(null)}
                className="p-1 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReview} className="space-y-4">
              {reviewError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {reviewError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                <p>
                  Nhân viên:{' '}
                  <strong>
                    {reviewingRecord.employeeName} (
                    {reviewingRecord.employeeCode})
                  </strong>
                </p>
                <p>
                  Thao tác:{' '}
                  <strong>
                    {reviewingRecord.eventType === 'check_in'
                      ? 'VÀO CA'
                      : 'RA CA'}
                  </strong>{' '}
                  lúc{' '}
                  <strong className="font-mono">
                    {reviewingRecord.dateStr} {reviewingRecord.timeStr}
                  </strong>
                </p>
                <p>Lý do nhân viên báo: {reviewingRecord.fallbackReason}</p>
              </div>

              <div>
                <label
                  htmlFor="review-reason-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Ghi chú / Lý do của người quản lý *
                </label>
                <input
                  id="review-reason-input"
                  data-testid="review-reason-input"
                  type="text"
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewingRecord(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  data-testid="confirm-fallback-review-btn"
                  className={`px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer ${
                    reviewDecision === 'approved'
                      ? 'bg-emerald-700 hover:bg-emerald-600'
                      : 'bg-rose-700 hover:bg-rose-600'
                  }`}
                >
                  {reviewDecision === 'approved'
                    ? 'Xác Nhận Duyệt & Tính Công'
                    : 'Xác Nhận Từ Chối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ĐIỀU CHỈNH GIỜ CÔNG (CÓ GHI NHẬT KÝ HOẠT ĐỘNG) */}
      {adjustingRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="adjust-attendance-modal"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Điều Chỉnh Giờ Công – {adjustingRow.employeeName} (
                {adjustingRow.workDateStr})
              </h3>
              <button
                type="button"
                onClick={() => setAdjustingRow(null)}
                className="p-1 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjustRow} className="space-y-4">
              {adjError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {adjError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="adj-checkin"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Giờ vào mới (HH:mm)
                  </label>
                  <input
                    id="adj-checkin"
                    data-testid="adj-checkin-input"
                    type="text"
                    value={adjCheckIn}
                    onChange={(e) => setAdjCheckIn(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="adj-checkout"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Giờ ra mới (HH:mm)
                  </label>
                  <input
                    id="adj-checkout"
                    data-testid="adj-checkout-input"
                    type="text"
                    value={adjCheckOut}
                    onChange={(e) => setAdjCheckOut(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="adj-reason"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Lý do điều chỉnh giờ công (Bắt buộc ghi Nhật ký) *
                </label>
                <input
                  id="adj-reason"
                  data-testid="adj-reason-input"
                  type="text"
                  placeholder="Ví dụ: Công nhân tăng ca bốc hàng muộn đã có xác nhận của tổ trưởng"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustingRow(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  data-testid="confirm-adjust-hours-btn"
                  className="px-5 py-2 rounded-lg bg-[#0F2942] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  Lưu Điều Chỉnh & Ghi Nhật Ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CẤU HÌNH CA LÀM VIỆC */}
      {editingShift && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="shift-config-modal"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Thiết Lập Thông Số Ca Làm Việc
              </h3>
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="p-1 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!canEditHours) {
                  onPermissionDenied('Cấu hình ca làm việc');
                  return;
                }
                onSaveShiftConfig(editingShift);
                setEditingShift(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1">Tên ca *</label>
                <input
                  type="text"
                  value={editingShift.name}
                  onChange={(e) =>
                    setEditingShift({ ...editingShift, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">
                    Giờ bắt đầu (HH:mm)
                  </label>
                  <input
                    type="text"
                    value={editingShift.startTime}
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        startTime: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Giờ kết thúc (HH:mm)
                  </label>
                  <input
                    type="text"
                    value={editingShift.endTime}
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        endTime: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">
                    Giờ chuẩn/ca
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={editingShift.hoursCount}
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        hoursCount: Number(e.target.value) || 8,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Nghỉ giữa ca (p)
                  </label>
                  <input
                    type="number"
                    value={editingShift.breakMinutes}
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        breakMinutes: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    Trễ cho phép (p)
                  </label>
                  <input
                    type="number"
                    value={editingShift.graceLateMinutes}
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        graceLateMinutes: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(editingShift.isOvernight)}
                  onChange={(e) =>
                    setEditingShift({
                      ...editingShift,
                      isOvernight: e.target.checked,
                    })
                  }
                />
                <span>
                  Ca đêm qua ngày hôm sau (Giờ ra thuộc sáng ngày kế tiếp)
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingShift(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Lưu Cấu Hình Ca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

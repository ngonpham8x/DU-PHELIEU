export type UserRole = 'owner' | 'manager' | 'accountant' | 'hr' | 'worker';

export type AccountType = 'cash' | 'bank';

export type EnvironmentMode = 'demo' | 'production';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  detail?: string;
  type: ToastType;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  department: string;
  accessStatus?: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface CashTransaction {
  id: string;
  ownerId: string;
  code: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  counterparty: string;
  category: string;
  accountType: AccountType;
  toAccountType?: AccountType;
  description: string;
  attachmentNote?: string;
  dateStr: string;
  status: 'active' | 'cancelled';
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceEventType =
  | 'check_in'
  | 'check_out'
  | 'break_start'
  | 'break_end'
  | 'leave';

export type AttendanceApprovalStatus =
  | 'approved'
  | 'pending_approval'
  | 'rejected';

export interface AttendanceRecord {
  id: string;
  ownerId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  shiftName: string;
  eventType: AttendanceEventType;
  method: 'face_verified' | 'fallback_manual';
  approvalStatus?: AttendanceApprovalStatus;
  fallbackReason?: string;
  approvedBy?: string;
  reviewReason?: string;
  reviewedAt?: string;
  confidence: number;
  workDateStr?: string;
  isOvernight?: boolean;
  adjustedNote?: string;
  dateStr: string;
  timeStr: string;
  createdAt: string;
}

export type AttendanceAttemptStatus =
  | 'camera_started'
  | 'recognized'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'fallback_pending';

export interface AttendanceAttemptTrace {
  id: string;
  employeeCode?: string;
  employeeName?: string;
  eventType?: AttendanceEventType;
  status: AttendanceAttemptStatus;
  stage: 'camera' | 'recognition' | 'confirmation' | 'storage';
  message: string;
  dateStr: string;
  timeStr: string;
  updatedAt: string;
  deviceMode?: 'camera_real' | 'camera_demo' | 'fallback';
}

export interface ShiftDefinition {
  id: string;
  name: string;
  shiftType?: 'morning' | 'afternoon' | 'night' | 'admin' | 'flexible' | string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceLateMinutes: number;
  hoursCount: number;
  isOvernight?: boolean;
  overtimeMultiplier?: number;
}

export interface DailyTimesheetRow {
  rowKey: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  shiftName: string;
  workDateStr: string;
  checkInTime: string;
  checkOutTime: string;
  breakMinutesUsed: number;
  actualHours: number;
  overtimeHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  statusLabel: string;
  statusTone: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate';
  notes: string;
  hasPendingFallback: boolean;
  hasRejectedFallback: boolean;
  isOvernightShift: boolean;
  checkInRecordId?: string;
  checkOutRecordId?: string;
}

export interface EmployeeProfile {
  code: string;
  fullName: string;
  phone: string;
  department: string;
  position: string;
  shiftName: string;
  salaryType: 'Ngày' | 'Tháng' | 'Sản lượng';
  baseRate: number;
  faceEnrolled: boolean;
  enrolledAngles: number;
  enrolledAt?: string;
  enrolledBy?: string;
  faceTemplateHash?: string;
  biometricTemplateHash?: string;
  faceConsentAccepted?: boolean;
  consentSignedAt?: string;
  dataRetentionUntil?: string;
  status: 'Đang làm việc' | 'Nghỉ phép' | 'Đã nghỉ';
}

export interface WeighTicket {
  id: string;
  ownerId: string;
  ticketCode: string;
  ticketType: 'purchase_in' | 'sales_out' | 'production_batch';
  partnerName: string;
  delivererName?: string;
  vehiclePlate?: string;
  rubberType: string; // Giữ tên trường kỹ thuật rubberType để tương thích 100% Firestore cũ (lưu tên Loại nhựa)
  grossKg: number;
  tareKg: number;
  deductionKg: number;
  netKg: number;
  outputKg?: number;
  scrapKg?: number;
  lossKg?: number;
  recoveryRatePercent?: number;
  machineName?: string;
  shiftName?: string;
  operatorName?: string;
  warehouseName?: string;
  unitPrice: number;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  notes?: string;
  photoUrl?: string;
  dateStr: string;
  createdAt: string;
}

export interface PlasticTypeItem {
  id: string;
  code: string;
  name: string;
  category: 'Nhựa thông dụng' | 'Nhựa kỹ thuật' | 'Nhựa phân loại' | 'Khác';
  defaultPriceKg: number;
  impurityHintPercent: number;
  description: string;
  isHidden?: boolean;
}

export interface ShredderMachine {
  id: string;
  code: string;
  name: string;
  bladeType: string;
  capacityKgPerHour: number;
  status: 'Đang chạy' | 'Sẵn sàng' | 'Chờ bảo trì' | 'Đang bảo trì';
  totalHoursRun: number;
  lastMaintenanceDate: string;
  nextMaintenanceNote: string;
}

export type PlasticInventoryCategory =
  | 'Nhựa phế liệu chưa phân loại'
  | 'Nhựa đã phân loại'
  | 'Nhựa chờ băm'
  | 'Nhựa đã băm'
  | 'Phế phẩm'
  | 'Vật tư';

export interface PlasticInventoryItem {
  id: string;
  code: string;
  name: string;
  category: PlasticInventoryCategory;
  plasticType: string;
  location: string;
  inWeightKg: number;
  outWeightKg: number;
  stockWeightKg: number;
  unit: 'kg' | 'Cái' | 'Bộ';
  updatedAt: string;
  note?: string;
}

export type ActivityModuleType =
  | 'Thu – Chi'
  | 'Chấm công'
  | 'Nhân sự'
  | 'Cân nhựa'
  | 'Cân mủ'
  | 'Phân loại & Băm nhựa'
  | 'Sản xuất'
  | 'Kho nhựa'
  | 'Kho'
  | 'Hệ thống';

export interface ActivityLogRecord {
  id: string;
  ownerId: string;
  actorName: string;
  actorUid: string;
  actorRole: UserRole;
  timestampStr: string;
  moduleName: ActivityModuleType;
  actionType: string;
  targetCode: string;
  previousValue: string;
  newValue: string;
  reason: string;
  resultStatus: string;
  createdAt: string;
}

export interface AppSettings {
  weightUnit: 'kg' | 'tan';
  weightDecimals: number;
  darkMode: boolean;
  openingCashBalance: number;
  openingBankBalance: number;
  openingRawRubberKg: number;
  openingShreddedRubberKg: number;
}

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  Moon,
  Scale,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  AccountType,
  AttendanceApprovalStatus,
  AttendanceAttemptTrace,
  AttendanceEventType,
  AttendanceRecord,
  CashTransaction,
  EmployeeProfile,
  ShiftDefinition,
  UserRole,
  WeighTicket,
} from '../types/factory';
import {
  DEMO_SHIFTS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  RUBBER_TYPES,
  TODAY_STR,
} from '../data/demoSeed';
import {
  calculateNetWeight,
  calculateProductionBalance,
  calculatePurchaseTotal,
  formatCurrencyVND,
  formatServerTimeHCM,
  suggestAttendanceEvent,
  validateAttendanceSequence,
  verifyFace1To1,
} from '../utils/calculations';

export type QuickModalType =
  | null
  | 'income'
  | 'expense'
  | 'transfer'
  | 'attendance'
  | 'purchase_in'
  | 'sales_out';

export type CameraSimScenario =
  | 'live_match'
  | 'permission_denied'
  | 'no_webcam'
  | 'mismatch_other_person'
  | 'spoof_photo'
  | 'low_light';

interface QuickModalsProps {
  activeModal: QuickModalType;
  onClose: () => void;
  employees: EmployeeProfile[];
  shifts?: ShiftDefinition[];
  userRole?: UserRole;
  envMode?: 'demo' | 'production';
  loggedInUserName?: string;
  loggedInEmployeeCode?: string;
  existingAttendance: AttendanceRecord[];
  currentShreddedStockKg: number;
  onSaveTransaction: (
    tx: Omit<CashTransaction, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onSaveAttendance: (
    att: Omit<AttendanceRecord, 'id' | 'ownerId' | 'createdAt'>
  ) => Promise<void>;
  onAttendanceTrace: (trace: AttendanceAttemptTrace) => void;
  onSaveWeighTicket: (
    tk: Omit<WeighTicket, 'id' | 'ownerId' | 'createdAt'>,
    alsoCreateCashTx?: {
      type: 'income' | 'expense';
      amount: number;
      accountType: AccountType;
    }
  ) => Promise<void>;
}

export const QuickModals: React.FC<QuickModalsProps> = ({
  activeModal,
  onClose,
  employees,
  shifts = DEMO_SHIFTS,
  userRole = 'owner',
  envMode = 'demo',
  loggedInUserName = 'Nguyễn Văn Hùng',
  loggedInEmployeeCode = 'CN-001',
  existingAttendance,
  currentShreddedStockKg,
  onSaveTransaction,
  onSaveAttendance,
  onAttendanceTrace,
  onSaveWeighTicket,
}) => {
  // 1. Cash Transaction Form State
  const [amountStr, setAmountStr] = useState('15000000');
  const [counterparty, setCounterparty] = useState('');
  const [category, setCategory] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('cash');
  const [description, setDescription] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [attachmentNote, setAttachmentNote] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 2. Attendance State
  const [selectedEmpCode, setSelectedEmpCode] = useState(
    loggedInEmployeeCode || employees[0]?.code || 'CN-001'
  );
  const [selectedShiftName, setSelectedShiftName] = useState(
    employees[0]?.shiftName || 'Ca sáng (06:30 - 14:30)'
  );
  const [eventType, setEventType] = useState<AttendanceEventType>('check_in');
  const [attendanceMode, setAttendanceMode] = useState<
    'camera' | 'fallback_manual'
  >('camera');
  const [cameraStatus, setCameraStatus] = useState<
    | 'idle'
    | 'requesting_permission'
    | 'connecting'
    | 'loading_frames'
    | 'active'
    | 'verifying'
    | 'verified'
    | 'verify_failed'
    | 'error'
  >('idle');
  const [cameraErrorMsg, setCameraErrorMsg] = useState('');
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [hasRealHardwareStream, setHasRealHardwareStream] = useState(false);
  const [videoResolution, setVideoResolution] = useState('');
  const [deviceDiagnosticInfo, setDeviceDiagnosticInfo] = useState<string>('');
  const [simScenario, setSimScenario] =
    useState<CameraSimScenario>('live_match');
  const [capturedIdentityCode, setCapturedIdentityCode] = useState('CN-001');
  const [recognizedEmployeeCode, setRecognizedEmployeeCode] = useState<string | null>(null);
  const [recognizedConfidence, setRecognizedConfidence] = useState(0);
  const attendanceAttemptIdRef = useRef(`ATTEMPT-${Date.now().toString(36).toUpperCase()}`);
  const [livenessPassed, setLivenessPassed] = useState(true);
  const [lightingScore, setLightingScore] = useState(92);

  // Fallback Request fields
  const [requestedTimeStr, setRequestedTimeStr] = useState('');
  const [requestedDateStr, setRequestedDateStr] = useState(TODAY_STR);
  const [fallbackReason, setFallbackReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('Nguyễn Văn Dư (Chủ xưởng)');

  const [attendanceSuccessResult, setAttendanceSuccessResult] = useState<{
    employeeName: string;
    employeeCode: string;
    department: string;
    shiftName: string;
    dateStr: string;
    workDateStr: string;
    timeStr: string;
    eventType: AttendanceEventType;
    method: 'face_verified' | 'fallback_manual';
    approvalStatus: AttendanceApprovalStatus;
    confidence: number;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const beginAttendanceAttempt = () => {
    const id = `ATTEMPT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    attendanceAttemptIdRef.current = id;
    setRecognizedEmployeeCode(null);
    setRecognizedConfidence(0);
    return id;
  };

  const recordAttendanceTrace = (
    input: Omit<AttendanceAttemptTrace, 'id' | 'dateStr' | 'timeStr' | 'updatedAt'>
  ) => {
    const clock = formatServerTimeHCM(new Date());
    onAttendanceTrace({
      ...input,
      id: attendanceAttemptIdRef.current,
      dateStr: clock.dateStr,
      timeStr: clock.timeStr,
      updatedAt: new Date().toISOString(),
    });
  };

  // 3. Weigh Ticket / Plastic Recycling State
  const [partnerName, setPartnerName] = useState('');
  const [delivererName, setDelivererName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('61C-389.12');
  const [rubberType, setRubberType] = useState(RUBBER_TYPES[0] || 'PET');
  const [grossKg, setGrossKg] = useState('5800');
  const [tareKg, setTareKg] = useState('1450');
  const [deductionKg, setDeductionKg] = useState('150');
  const [unitPrice, setUnitPrice] = useState('16500');
  const [paidAmount, setPaidAmount] = useState('0');
  const [ticketNotes, setTicketNotes] = useState('');
  const [ticketPhotoUrl, setTicketPhotoUrl] = useState('');
  const [paymentAccount, setPaymentAccount] = useState<AccountType>('cash');
  const [allowOverdraftStock, setAllowOverdraftStock] = useState(false);

  // Reset fields when modal opens
  useEffect(() => {
    setFormError('');
    setSubmitting(false);
    setAttendanceSuccessResult(null);
    const serverTime = formatServerTimeHCM(new Date());
    setRequestedTimeStr(serverTime.timeStr);
    setRequestedDateStr(serverTime.dateStr);
    const randSuffix = String(Math.floor(100 + Math.random() * 900));

    if (activeModal === 'attendance') {
      const defaultCode =
        userRole === 'worker'
          ? loggedInEmployeeCode
          : selectedEmpCode || employees[0]?.code || 'CN-001';
      setSelectedEmpCode(defaultCode);
      setCapturedIdentityCode(defaultCode);
      const empObj =
        employees.find((e) => e.code === defaultCode) || employees[0];
      if (empObj) {
        setSelectedShiftName(empObj.shiftName);
      }
      setAttendanceMode('camera');
      setSimScenario('live_match');
      setLivenessPassed(true);
      setLightingScore(92);
      setCameraErrorMsg('');
    } else if (activeModal === 'income') {
      setVoucherCode(`PT-2026-${randSuffix}`);
      setCategory(INCOME_CATEGORIES[0]);
      setCounterparty('');
      setDescription('');
      setAmountStr('');
      setAccountType('cash');
    } else if (activeModal === 'expense') {
      setVoucherCode(`PC-2026-${randSuffix}`);
      setCategory(EXPENSE_CATEGORIES[0]);
      setCounterparty('');
      setDescription('');
      setAmountStr('');
      setAccountType('cash');
    } else if (activeModal === 'transfer') {
      setVoucherCode(`CQ-2026-${randSuffix}`);
      setCategory('Chuyển tiền nội bộ');
      setCounterparty('Chuyển quỹ nội bộ nhà xưởng');
      setDescription('Rút tiền ngân hàng nhập quỹ tiền mặt');
      setAmountStr('10000000');
      setAccountType('bank');
    } else if (activeModal === 'purchase_in') {
      setVoucherCode(`PCN-2026-${randSuffix}`);
      setPartnerName('');
      setDelivererName('');
      setRubberType('HDPE');
      setGrossKg('5800');
      setTareKg('1450');
      setDeductionKg('150');
      setUnitPrice('16500');
      setPaidAmount('0');
      setTicketNotes('');
      setTicketPhotoUrl('');
    } else if (activeModal === 'sales_out') {
      setVoucherCode(`PXN-2026-${randSuffix}`);
      setPartnerName('');
      setDelivererName('');
      setRubberType('PP');
      setGrossKg('9400');
      setTareKg('3400');
      setDeductionKg('0');
      setUnitPrice('22500');
      setPaidAmount('0');
      setTicketNotes('');
      setTicketPhotoUrl('');
      setAllowOverdraftStock(false);
    }
  }, [activeModal, userRole, loggedInEmployeeCode]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasRealHardwareStream(false);
    setVideoResolution('');
    setCameraStatus('idle');
  };

  // Manage camera stream lifecycle when attendance modal is open (auto-start immediately so user sees bright optical frame right away)
  useEffect(() => {
    if (activeModal !== 'attendance' || attendanceMode !== 'camera') {
      stopCameraStream();
      return;
    }
    beginAttendanceAttempt();
    void startCameraWithScenario('live_match', 'user');
    return () => {
      stopCameraStream();
    };
  }, [activeModal, attendanceMode]);

  // Attach MediaStream to <video> whenever streamRef or cameraStatus changes so <video> is NEVER black
  useEffect(() => {
    const videoEl = videoRef.current;
    const stream = streamRef.current;
    if (videoEl && stream && hasRealHardwareStream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {
        // Ignore play interruption
      });
    }
  }, [cameraStatus, hasRealHardwareStream]);

  const handleCheckCameraDevice = async () => {
    setDeviceDiagnosticInfo('Đang kiểm tra phần cứng camera và quyền trình duyệt...');
    const isSecure =
      typeof window !== 'undefined' &&
      (window.isSecureContext ||
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost');
    const inIframe =
      typeof window !== 'undefined' && window.self !== window.top;

    let videoInputsCount = 0;
    let deviceLabels: string[] = [];
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      navigator.mediaDevices.enumerateDevices
    ) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        videoInputsCount = videoInputs.length;
        deviceLabels = videoInputs.map(
          (d, i) => d.label || `Camera #${i + 1}`
        );
      } catch {
        // Ignore enumerate error
      }
    }

    const summaryParts = [
      `• Kết nối bảo mật (HTTPS/localhost): ${isSecure ? 'Đạt chuẩn' : 'Chưa bảo mật (Cần HTTPS)'}`,
      `• Môi trường khung nhúng (Iframe): ${inIframe ? 'Đang chạy trong khung Preview Iframe (Nếu trình duyệt chặn camera trong iframe, hãy mở link trực tiếp ở tab mới)' : 'Cửa sổ độc lập chuẩn'}`,
      `• Số thiết bị Camera phát hiện: ${videoInputsCount} (${deviceLabels.join(', ') || 'Chưa cấp quyền đọc tên hoặc không có webcam'})`,
      `• Trạng thái luồng hiện tại: ${hasRealHardwareStream ? `Luồng WebRTC thật (${videoResolution || '640x480'})` : 'Chế độ Mô phỏng Kiểm thử DEMO (Không bị đen màn hình)'}`,
    ];
    setDeviceDiagnosticInfo(summaryParts.join('\n'));
  };

  const startCameraWithScenario = async (
    scenarioOverride?: CameraSimScenario,
    facingOverride?: 'user' | 'environment'
  ) => {
    const scenario = scenarioOverride || simScenario;
    const targetFacing = facingOverride || cameraFacingMode;
    setFormError('');
    setCameraErrorMsg('');
    setRecognizedEmployeeCode(null);
    setRecognizedConfidence(0);
    recordAttendanceTrace({
      status: 'camera_started',
      stage: 'camera',
      message: 'Đã bắt đầu một lần chấm công; đang mở camera và chờ nhận diện.',
      deviceMode: 'camera_demo',
    });

    // Giải phóng luồng cũ trước khi mở luồng mới
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setHasRealHardwareStream(false);
    setVideoResolution('');

    // Bước 1: Đang yêu cầu quyền
    setCameraStatus('requesting_permission');

    if (scenario === 'permission_denied') {
      setCameraStatus('error');
      setCameraErrorMsg(
        'Từ chối quyền Camera (NotAllowedError): Người dùng đã chặn quyền truy cập máy ảnh trên trình duyệt. Vui lòng cấp lại quyền Camera trên thanh địa chỉ hoặc nhấn "Chấm Công Dự Phòng".'
      );
      recordAttendanceTrace({
        status: 'failed',
        stage: 'camera',
        message: 'Trình duyệt từ chối quyền camera. Cần gửi chấm công dự phòng để không mất công.',
        deviceMode: 'camera_demo',
      });
      return;
    }

    if (scenario === 'no_webcam') {
      setCameraStatus('error');
      setCameraErrorMsg(
        'Thiết bị không có Webcam / Camera vật lý (NotFoundError): Không tìm thấy phần cứng camera trên máy tính này. Vui lòng chuyển sang "Chấm Công Dự Phòng".'
      );
      recordAttendanceTrace({
        status: 'failed',
        stage: 'camera',
        message: 'Không tìm thấy camera. Cần gửi chấm công dự phòng để quản lý đối chiếu.',
        deviceMode: 'camera_demo',
      });
      return;
    }

    // Apply scenario parameters for 1:1 and liveness checks
    if (scenario === 'live_match') {
      setCapturedIdentityCode(selectedEmpCode);
      setLivenessPassed(true);
      setLightingScore(92);
    } else if (scenario === 'mismatch_other_person') {
      const otherCode =
        selectedEmpCode === 'CN-001' ? 'CN-002' : 'CN-001';
      setCapturedIdentityCode(otherCode);
      setLivenessPassed(true);
      setLightingScore(89);
    } else if (scenario === 'spoof_photo') {
      setCapturedIdentityCode(selectedEmpCode);
      setLivenessPassed(false);
      setLightingScore(85);
    } else if (scenario === 'low_light') {
      setCapturedIdentityCode(selectedEmpCode);
      setLivenessPassed(true);
      setLightingScore(28);
    }

    // Bước 2: Đang kết nối camera
    setCameraStatus('connecting');

    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    ) {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacing },
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
        } catch {
          // Fallback sang cấu hình cơ bản nếu thiết bị không hỗ trợ facingMode
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        const videoTracks = stream.getVideoTracks();
        const activeTrack = videoTracks.find(
          (t) => t.readyState === 'live' && t.enabled
        );

        if (activeTrack) {
          streamRef.current = stream;
          setCameraStatus('loading_frames');

          const videoEl = videoRef.current;
          if (videoEl) {
            videoEl.srcObject = stream;
            await videoEl.play().catch(() => {});

            // Chờ sự kiện loadedmetadata / requestVideoFrameCallback / kiểm tra kích thước khung hình thực tế > 0
            await new Promise<void>((resolve) => {
              let settled = false;
              const finish = () => {
                if (!settled) {
                  settled = true;
                  resolve();
                }
              };
              if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
                finish();
                return;
              }
              const anyVideo = videoEl as HTMLVideoElement & {
                requestVideoFrameCallback?: (cb: () => void) => number;
              };
              if (typeof anyVideo.requestVideoFrameCallback === 'function') {
                anyVideo.requestVideoFrameCallback(() => finish());
              }
              videoEl.onloadedmetadata = () => finish();
              videoEl.onloadeddata = () => finish();
              window.setTimeout(finish, 600);
            });

            if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
              setHasRealHardwareStream(true);
              setVideoResolution(
                `${videoEl.videoWidth}×${videoEl.videoHeight}px`
              );
              setCameraStatus('active');
              return;
            }
          }
        }
        // Nếu track không có khung hình thực tế, đóng track rỗng và chuyển sang Khung Mô Phỏng Quang Học Sáng Rõ
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Nếu môi trường chạy không gắn webcam vật lý hoặc bị chặn bởi iframe preview,
        // kích hoạt Khung Mô Phỏng Quang Học Trực Quan (tuyệt đối không để màn hình đen!)
      }
    }

    setHasRealHardwareStream(false);
    setVideoResolution('640×480px (Mô phỏng Quang học DEMO)');
    setCameraStatus('active');
  };

  useEffect(() => {
    if (
      activeModal !== 'attendance' ||
      attendanceMode !== 'camera' ||
      cameraStatus !== 'active' ||
      envMode === 'production'
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCameraStatus('verifying');
      const detectedEmployee = employees.find(
        (employee) => employee.code === capturedIdentityCode
      );

      if (!detectedEmployee) {
        setCameraStatus('verify_failed');
        setFormError('Không tìm thấy hồ sơ tương ứng với khuôn mặt. Dấu vết đã được lưu; vui lòng dùng chấm công dự phòng.');
        recordAttendanceTrace({
          status: 'failed',
          stage: 'recognition',
          message: `Nhận diện được mã ${capturedIdentityCode} nhưng không có hồ sơ nhân viên tương ứng.`,
          deviceMode: hasRealHardwareStream ? 'camera_real' : 'camera_demo',
        });
        return;
      }

      const verification = verifyFace1To1({
        expectedEmployeeCode: detectedEmployee.code,
        capturedEmployeeCode: capturedIdentityCode,
        faceEnrolled: detectedEmployee.faceEnrolled,
        livenessPassed,
        spoofDetected: simScenario === 'spoof_photo',
        lightingScore,
      });

      if (!verification.verified) {
        setCameraStatus('verify_failed');
        setFormError(`${verification.reason || 'Không thể nhận diện khuôn mặt.'} Dấu vết đã được lưu để quản lý truy lại.`);
        recordAttendanceTrace({
          employeeCode: detectedEmployee.code,
          employeeName: detectedEmployee.fullName,
          status: 'failed',
          stage: 'recognition',
          message: verification.reason || 'Nhận diện khuôn mặt không đạt.',
          deviceMode: hasRealHardwareStream ? 'camera_real' : 'camera_demo',
        });
        return;
      }

      const suggested = suggestAttendanceEvent(
        existingAttendance,
        detectedEmployee.code,
        TODAY_STR
      );
      setSelectedEmpCode(detectedEmployee.code);
      setSelectedShiftName(detectedEmployee.shiftName);
      setEventType(suggested.eventType);
      setRecognizedEmployeeCode(detectedEmployee.code);
      setRecognizedConfidence(verification.confidence);
      setCameraStatus('verified');
      setFormError('');
      recordAttendanceTrace({
        employeeCode: detectedEmployee.code,
        employeeName: detectedEmployee.fullName,
        eventType: suggested.eventType,
        status: 'recognized',
        stage: 'recognition',
        message: `${suggested.message} Chờ nhân viên xác nhận trên màn hình.`,
        deviceMode: hasRealHardwareStream ? 'camera_real' : 'camera_demo',
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [activeModal, attendanceMode, cameraStatus, capturedIdentityCode, employees, envMode, existingAttendance, hasRealHardwareStream, lightingScore, livenessPassed, simScenario]);

  if (!activeModal) return null;

  const serverClock = formatServerTimeHCM(new Date());
  const nowTime = serverClock.timeStr;

  // Render Thu / Chi / Chuyển quỹ modal
  if (
    activeModal === 'income' ||
    activeModal === 'expense' ||
    activeModal === 'transfer'
  ) {
    const isIncome = activeModal === 'income';
    const isTransfer = activeModal === 'transfer';
    const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    const handleSubmitCash = async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setFormError('');
      const numericAmount = Math.round(Number(amountStr));
      if (!numericAmount || numericAmount <= 0) {
        setFormError('Vui lòng nhập số tiền hợp lệ lớn hơn 0 VNĐ.');
        return;
      }
      if (!counterparty.trim()) {
        setFormError(
          isIncome
            ? 'Vui lòng nhập tên người nộp tiền.'
            : 'Vui lòng nhập tên người nhận tiền.'
        );
        return;
      }
      if (!description.trim()) {
        setFormError('Vui lòng nhập nội dung giao dịch rõ ràng.');
        return;
      }

      setSubmitting(true);
      try {
        await onSaveTransaction({
          code: voucherCode.trim() || `GD-${Date.now()}`,
          type: activeModal,
          amount: numericAmount,
          counterparty: counterparty.trim(),
          category: isTransfer ? 'Chuyển tiền nội bộ' : category,
          accountType,
          toAccountType: isTransfer
            ? accountType === 'cash'
              ? 'bank'
              : 'cash'
            : undefined,
          description: description.trim(),
          dateStr: `${TODAY_STR} ${nowTime}`,
          status: 'active',
          attachmentNote: attachmentNote.trim() || undefined,
        });
        onClose();
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : 'Lỗi khi lưu giao dịch.'
        );
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-modal-title"
      >
        <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
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
              <h2
                id="cash-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                {isIncome
                  ? 'Ghi Phiếu Thu Tiền Mới'
                  : isTransfer
                    ? 'Chuyển Tiền Nội Bộ Giữa Các Quỹ'
                    : 'Ghi Phiếu Chi Tiền Mới'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmitCash} className="mt-4 space-y-4">
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="tx-code"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Mã phiếu ({TODAY_STR})
                </label>
                <input
                  id="tx-code"
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="tx-amount"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Số tiền (VNĐ) *
                </label>
                <input
                  id="tx-amount"
                  type="number"
                  min="1000"
                  step="1000"
                  placeholder="Ví dụ: 15000000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-base font-bold font-mono text-slate-900 dark:text-white"
                />
                {Number(amountStr) > 0 && (
                  <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                    Hiển thị: {formatCurrencyVND(Number(amountStr))}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="tx-account"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {isIncome
                    ? 'Quỹ nhận tiền'
                    : isTransfer
                      ? 'Từ quỹ nguồn'
                      : 'Quỹ chi tiền'}
                </label>
                <select
                  id="tx-account"
                  value={accountType}
                  onChange={(e) =>
                    setAccountType(e.target.value as AccountType)
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
                >
                  <option value="cash">Quỹ Tiền Mặt Tại Xưởng</option>
                  <option value="bank">Tài Khoản Ngân Hàng</option>
                </select>
              </div>

              {!isTransfer ? (
                <div>
                  <label
                    htmlFor="tx-category"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Danh mục {isIncome ? 'thu' : 'chi'}
                  </label>
                  <select
                    id="tx-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sang quỹ đích
                  </label>
                  <div className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {accountType === 'cash'
                      ? 'Tài Khoản Ngân Hàng'
                      : 'Quỹ Tiền Mặt Tại Xưởng'}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="tx-counterparty"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {isIncome
                  ? 'Người nộp tiền / Khách hàng *'
                  : isTransfer
                    ? 'Người thực hiện chuyển quỹ *'
                    : 'Người nhận tiền / Nhà cung cấp *'}
              </label>
              <input
                id="tx-counterparty"
                type="text"
                placeholder={
                  isIncome
                    ? 'Ví dụ: Công ty Nhựa Tái Sinh Đông Nam'
                    : 'Ví dụ: Vựa thu gom nhựa phế liệu Ông Bảy'
                }
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="tx-description"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Nội dung chi tiết *
              </label>
              <input
                id="tx-description"
                type="text"
                placeholder="Nhập rõ nội dung khoản thu/chi để đối chiếu sổ quỹ..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="tx-attachment"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Số chứng từ / Tên ảnh đính kèm (nếu có)
              </label>
              <input
                id="tx-attachment"
                type="text"
                placeholder="Ví dụ: UNC-VCB-9920.jpg hoặc Hóa đơn điện 11/2026"
                value={attachmentNote}
                onChange={(e) => setAttachmentNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-colors cursor-pointer ${
                  isIncome
                    ? 'bg-emerald-700 hover:bg-emerald-600'
                    : isTransfer
                      ? 'bg-[#0F2942] hover:bg-slate-800'
                      : 'bg-rose-700 hover:bg-rose-600'
                }`}
              >
                {submitting
                  ? 'Đang lưu...'
                  : isIncome
                    ? 'Lưu Phiếu Thu'
                    : isTransfer
                      ? 'Xác Nhận Chuyển Quỹ'
                      : 'Lưu Phiếu Chi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render Chấm Công Khuôn Mặt 1:1 & Dự Phòng Chờ Duyệt Modal
  if (activeModal === 'attendance') {
    const selectedEmployee =
      employees.find((e) => e.code === selectedEmpCode) || employees[0];
    const recognizedEmployee = recognizedEmployeeCode
      ? employees.find((e) => e.code === recognizedEmployeeCode)
      : undefined;
    const emp = attendanceMode === 'camera'
      ? recognizedEmployee || selectedEmployee
      : selectedEmployee;
    const currentShiftObj =
      shifts.find((s) => s.name === selectedShiftName) || shifts[0];
    const isOvernightShift = Boolean(
      currentShiftObj?.isOvernight ||
        selectedShiftName.toLowerCase().includes('đêm')
    );

    const eventLabelMap: Record<AttendanceEventType, string> = {
      check_in: 'VÀO CA',
      check_out: 'RA CA',
      break_start: 'BẮT ĐẦU NGHỈ',
      break_end: 'KẾT THÚC NGHỈ',
      leave: 'NGHỈ PHÉP',
    };

    const handleConfirmAttendance = async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setFormError('');

      if (attendanceMode === 'camera' && (!recognizedEmployee || cameraStatus !== 'verified')) {
        setFormError('Hệ thống chưa nhận diện xong nhân viên. Chưa có dữ liệu công nào được ghi; vui lòng chờ nhận diện hoặc chuyển sang yêu cầu dự phòng.');
        recordAttendanceTrace({
          status: 'failed',
          stage: 'confirmation',
          message: 'Người dùng yêu cầu chấm công khi nhận diện chưa hoàn tất. Không ghi dữ liệu công.',
          deviceMode: hasRealHardwareStream ? 'camera_real' : 'camera_demo',
        });
        return;
      }

      // 1. Check Internet connectivity before recording attendance
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setFormError(
          'Mất kết nối mạng Internet (Offline): Không thể gửi dữ liệu lên máy chủ. Hệ thống không ghi nhận chấm công thành công trước khi máy chủ xác nhận. Khi có mạng trở lại, bạn có thể gửi Yêu cầu chấm công dự phòng để Quản lý duyệt.'
        );
        recordAttendanceTrace({
          employeeCode: emp.code,
          employeeName: emp.fullName,
          eventType,
          status: 'failed',
          stage: 'storage',
          message: 'Mất mạng trước khi máy chủ xác nhận. Cần gửi yêu cầu dự phòng khi có mạng.',
          deviceMode: attendanceMode === 'camera' ? (hasRealHardwareStream ? 'camera_real' : 'camera_demo') : 'fallback',
        });
        return;
      }

      // 2. Validate sequence (blocks double check-in, blocks check-out without check-in, supports overnight shift)
      const seqResult = validateAttendanceSequence(
        existingAttendance,
        emp.code,
        emp.fullName,
        eventType,
        requestedDateStr || TODAY_STR,
        isOvernightShift
      );
      if (!seqResult.valid) {
        setFormError(
          seqResult.message || 'Thao tác chấm công không hợp lệ theo trình tự ca.'
        );
        recordAttendanceTrace({
          employeeCode: emp.code,
          employeeName: emp.fullName,
          eventType,
          status: 'failed',
          stage: 'confirmation',
          message: seqResult.message || 'Trình tự vào/ra ca không hợp lệ; không ghi dữ liệu.',
          deviceMode: attendanceMode === 'camera' ? (hasRealHardwareStream ? 'camera_real' : 'camera_demo') : 'fallback',
        });
        return;
      }

      // 3. Validate Camera 1:1 Face Verification OR Fallback Request
      let confidenceScore = 100;
      let approvalStatus: AttendanceApprovalStatus = 'approved';

      if (attendanceMode === 'camera') {
        // Camera video is real, but verifyFace1To1() is only a simulated algorithm.
        // Never write an "approved / face_verified" event in Production.
        if (envMode === 'production') {
          setFormError('Nhận diện khuôn mặt 1:1 chưa tích hợp mô hình xác minh thực tế và chống giả mạo đủ tin cậy. Chế độ Production chỉ cho phép gửi chấm công dự phòng để Quản lý duyệt.');
          setCameraStatus('verify_failed');
          recordAttendanceTrace({
            employeeCode: emp.code,
            employeeName: emp.fullName,
            eventType,
            status: 'failed',
            stage: 'recognition',
            message: 'Production chưa có dịch vụ nhận diện thật; không ghi công tự động và giữ dấu vết để đối chiếu.',
            deviceMode: hasRealHardwareStream ? 'camera_real' : 'camera_demo',
          });
          return;
        }
        if (!emp.faceEnrolled) {
          setFormError(
            `Nhân viên ${emp.fullName} (${emp.code}) chưa đăng ký mẫu khuôn mặt trong mục Nhân sự. Vui lòng chuyển sang "Gửi Yêu Cầu Chấm Công Dự Phòng (Chờ quản lý duyệt)" bên dưới.`
          );
          return;
        }
        if (
          cameraStatus !== 'active' &&
          cameraStatus !== 'verified' &&
          cameraStatus !== 'verifying'
        ) {
          setFormError(
            'Camera xác minh khuôn mặt chưa được bật hoặc bị lỗi truy cập. Vui lòng nhấn "Bật Camera" hoặc chuyển sang "Chấm Công Dự Phòng".'
          );
          return;
        }
        setCameraStatus('verifying');

        const verification = verifyFace1To1({
          expectedEmployeeCode: emp.code,
          capturedEmployeeCode: capturedIdentityCode,
          faceEnrolled: emp.faceEnrolled,
          livenessPassed,
          spoofDetected: simScenario === 'spoof_photo',
          lightingScore,
        });

        if (!verification.verified) {
          setCameraStatus('verify_failed');
          setFormError(
            verification.reason ||
              'Xác minh khuôn mặt 1:1 không đạt yêu cầu. Vui lòng thử lại hoặc dùng Chấm công dự phòng.'
          );
          return;
        }
        setCameraStatus('verified');
        confidenceScore = verification.confidence;
        approvalStatus = 'approved';
      } else {
        // Fallback attendance request MUST be saved as pending_approval
        if (!fallbackReason.trim() || fallbackReason.trim().length < 3) {
          setFormError(
            'Gửi yêu cầu chấm công dự phòng bắt buộc phải nhập lý do cụ thể (ví dụ: Thiết bị không có camera / Mất mạng / Hỏng camera / Ánh sáng yếu).'
          );
          return;
        }
        if (!approvedBy.trim()) {
          setFormError('Vui lòng chọn hoặc nhập tên người quản lý duyệt.');
          return;
        }
        approvalStatus = 'pending_approval';
      }

      setSubmitting(true);
      try {
        const methodUsed =
          attendanceMode === 'camera' ? 'face_verified' : 'fallback_manual';
        const effectiveTimeStr =
          attendanceMode === 'fallback_manual' && requestedTimeStr
            ? requestedTimeStr
            : nowTime;
        const effectiveDateStr =
          attendanceMode === 'fallback_manual' && requestedDateStr
            ? requestedDateStr
            : TODAY_STR;

        recordAttendanceTrace({
          employeeCode: emp.code,
          employeeName: emp.fullName,
          eventType,
          status: 'saving',
          stage: 'storage',
          message: `Đang gửi xác nhận ${eventLabelMap[eventType]} lên nơi lưu dữ liệu.`,
          deviceMode: attendanceMode === 'camera' ? (hasRealHardwareStream ? 'camera_real' : 'camera_demo') : 'fallback',
        });

        await onSaveAttendance({
          employeeCode: emp.code,
          employeeName: emp.fullName,
          department: emp.department,
          shiftName: selectedShiftName,
          eventType,
          method: methodUsed,
          approvalStatus,
          confidence: confidenceScore,
          workDateStr: seqResult.resolvedWorkDateStr,
          isOvernight: isOvernightShift,
          fallbackReason:
            attendanceMode === 'fallback_manual'
              ? fallbackReason.trim()
              : undefined,
          approvedBy:
            attendanceMode === 'fallback_manual'
              ? approvedBy.trim()
              : undefined,
          dateStr: effectiveDateStr,
          timeStr: effectiveTimeStr,
        });

        setAttendanceSuccessResult({
          employeeName: emp.fullName,
          employeeCode: emp.code,
          department: emp.department,
          shiftName: selectedShiftName,
          dateStr: effectiveDateStr,
          workDateStr: seqResult.resolvedWorkDateStr,
          timeStr: effectiveTimeStr,
          eventType,
          method: methodUsed,
          approvalStatus,
          confidence: confidenceScore,
        });
        recordAttendanceTrace({
          employeeCode: emp.code,
          employeeName: emp.fullName,
          eventType,
          status: attendanceMode === 'fallback_manual' ? 'fallback_pending' : 'saved',
          stage: 'storage',
          message:
            attendanceMode === 'fallback_manual'
              ? `Yêu cầu ${eventLabelMap[eventType]} dự phòng đã lưu và đang chờ duyệt.`
              : `Máy chủ đã xác nhận lưu ${eventLabelMap[eventType]} lúc ${effectiveTimeStr}.`,
          deviceMode: attendanceMode === 'camera' ? (hasRealHardwareStream ? 'camera_real' : 'camera_demo') : 'fallback',
        });
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : 'Lỗi máy chủ: Không thể xác nhận chấm công. Vui lòng thử lại.';
        setFormError(`${message} Dấu vết đã được lưu; hãy gửi yêu cầu dự phòng để không mất công.`);
        setFallbackReason(`Máy chủ chưa xác nhận lần ${eventLabelMap[eventType]} · Mã vết ${attendanceAttemptIdRef.current}`);
        recordAttendanceTrace({
          employeeCode: emp.code,
          employeeName: emp.fullName,
          eventType,
          status: 'failed',
          stage: 'storage',
          message,
          deviceMode: attendanceMode === 'camera' ? (hasRealHardwareStream ? 'camera_real' : 'camera_demo') : 'fallback',
        });
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-modal-title"
        data-testid="attendance-modal"
      >
        <div className="w-full max-w-xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xl my-auto">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <ScanFace className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h2
                  id="attendance-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                >
                  Chấm Công Bằng Khuôn Mặt – Dư-Nhựa phế liệu
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  Giờ máy chủ (Asia/Ho_Chi_Minh): {serverClock.fullTimestampStr}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Info Banner: Logged-in employee & current shift */}
          <div
            data-testid="attendance-session-banner"
            className="mt-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Nhân viên đang chọn / đăng nhập:{' '}
                <strong
                  data-testid="attendance-current-employee"
                  className="text-slate-900 dark:text-white"
                >
                  {emp.fullName} ({emp.code})
                </strong>{' '}
                <span className="text-slate-500">({loggedInUserName})</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {isOvernightShift && (
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
              )}
              <span className="text-slate-500">Ca hiện tại:</span>
              <strong
                data-testid="attendance-current-shift"
                className="text-[#0F2942] dark:text-sky-400"
              >
                {selectedShiftName}
              </strong>
            </div>
          </div>

          {attendanceSuccessResult ? (
            <div
              data-testid="attendance-success-card"
              className={`mt-4 space-y-4 rounded-xl border p-5 text-center ${
                attendanceSuccessResult.approvalStatus === 'pending_approval'
                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30'
                  : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30'
              }`}
            >
              {attendanceSuccessResult.approvalStatus === 'pending_approval' ? (
                <Clock className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto" />
              ) : (
                <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
              )}

              <div>
                <span
                  data-testid="attendance-result-badge"
                  className={`text-xs font-bold uppercase tracking-wider ${
                    attendanceSuccessResult.approvalStatus ===
                    'pending_approval'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {attendanceSuccessResult.approvalStatus === 'pending_approval'
                    ? 'ĐÃ GỬI YÊU CẦU CHẤM CÔNG DỰ PHÒNG – TRẠNG THÁI: CHỜ DUYỆT'
                    : 'XÁC MINH KHUÔN MẶT 1:1 ĐẠT YÊU CẦU – MÁY CHỦ ĐÃ LƯU'}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {attendanceSuccessResult.employeeName} (
                  {attendanceSuccessResult.employeeCode})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Bộ phận: {attendanceSuccessResult.department} ·{' '}
                  {attendanceSuccessResult.shiftName}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Ngày tính công</span>
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {attendanceSuccessResult.workDateStr}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Giờ chấm công</span>
                  <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                    {attendanceSuccessResult.timeStr}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Trạng thái</span>
                  <strong className="text-blue-700 dark:text-blue-400">
                    {eventLabelMap[attendanceSuccessResult.eventType]}
                  </strong>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300">
                {attendanceSuccessResult.approvalStatus ===
                'pending_approval' ? (
                  <span>
                    Lưu ý quan trọng: Yêu cầu dự phòng đang ở trạng thái{' '}
                    <strong>Chờ quản lý duyệt</strong> và{' '}
                    <strong>chưa được tính công chính thức</strong> cho đến khi
                    Chủ xưởng / Quản lý phê duyệt trong mục Chấm công.
                  </span>
                ) : (
                  <span>
                    Phương thức xác thực:{' '}
                    <strong>
                      Quét khuôn mặt 1:1 qua Camera (Độ khớp{' '}
                      {attendanceSuccessResult.confidence}%)
                    </strong>
                  </span>
                )}
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  data-testid="attendance-next-btn"
                  onClick={() => {
                    setAttendanceSuccessResult(null);
                    setFormError('');
                    beginAttendanceAttempt();
                    void startCameraWithScenario(
                      'live_match',
                      cameraFacingMode,
                    );
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Thực hiện thao tác tiếp theo
                </button>
                <button
                  type="button"
                  data-testid="attendance-done-close-btn"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-bold text-white cursor-pointer"
                >
                  Hoàn tất & Đóng
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmAttendance} className="mt-4 space-y-4">
              {formError && (
                <div
                  role="alert"
                  data-testid="attendance-error-alert"
                  className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-start gap-2"
                >
                  <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Large VÀO CA and RA CA Buttons + Secondary Break/Leave */}
              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  1. Chọn thao tác chấm công *
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    data-testid="btn-event-check-in"
                    onClick={() => {
                      setEventType('check_in');
                      setFormError('');
                    }}
                    className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 font-extrabold text-sm transition-colors cursor-pointer ${
                      eventType === 'check_in'
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
                    }`}
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    <span>VÀO CA</span>
                  </button>
                  <button
                    type="button"
                    data-testid="btn-event-check-out"
                    onClick={() => {
                      setEventType('check_out');
                      setFormError('');
                    }}
                    className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 font-extrabold text-sm transition-colors cursor-pointer ${
                      eventType === 'check_out'
                        ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500'
                    }`}
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>RA CA</span>
                  </button>
                </div>

                {/* Secondary Break & Leave buttons */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    type="button"
                    data-testid="btn-event-break-start"
                    onClick={() => {
                      setEventType('break_start');
                      setFormError('');
                    }}
                    className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
                      eventType === 'break_start'
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Nghỉ giữa ca</span>
                  </button>
                  <button
                    type="button"
                    data-testid="btn-event-break-end"
                    onClick={() => {
                      setEventType('break_end');
                      setFormError('');
                    }}
                    className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
                      eventType === 'break_end'
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Vào lại ca</span>
                  </button>
                  <button
                    type="button"
                    data-testid="btn-event-leave"
                    onClick={() => {
                      setEventType('leave');
                      setFormError('');
                    }}
                    className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
                      eventType === 'leave'
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span>Xin nghỉ phép</span>
                  </button>
                </div>
              </div>

              {/* 2. Select Employee & Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="att-emp"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    2. {attendanceMode === 'camera' ? 'Nhân viên do hệ thống tự nhận diện' : 'Nhân viên chấm công *'}
                  </label>
                  <select
                    id="att-emp"
                    data-testid="att-emp-select"
                    disabled={attendanceMode === 'camera'}
                    value={selectedEmpCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setSelectedEmpCode(code);
                      if (simScenario === 'live_match') {
                        setCapturedIdentityCode(code);
                      }
                      const found = employees.find((item) => item.code === code);
                      if (found) {
                        setSelectedShiftName(found.shiftName);
                      }
                      setFormError('');
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {employees.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} – {item.fullName}{' '}
                        {item.faceEnrolled ? '(Đã ĐK mặt)' : '(Chưa ĐK mặt)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="att-shift"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Ca làm việc áp dụng *
                  </label>
                  <select
                    id="att-shift"
                    data-testid="att-shift-select"
                    value={selectedShiftName}
                    onChange={(e) => {
                      setSelectedShiftName(e.target.value);
                      setFormError('');
                    }}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {shifts.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.hoursCount}h chuẩn)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Switch between Face Camera 1:1 and Fallback Request */}
              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  3. Phương thức xác minh
                </span>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    data-testid="tab-mode-camera"
                    onClick={() => {
                      setAttendanceMode('camera');
                      setFormError('');
                    }}
                    className={`py-2 px-3 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      attendanceMode === 'camera'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Quét Khuôn Mặt 1:1 (Camera)
                  </button>
                  <button
                    type="button"
                    data-testid="tab-mode-fallback"
                    onClick={() => {
                      setAttendanceMode('fallback_manual');
                      if (!fallbackReason) {
                        setFallbackReason(
                          'Không có camera / Lỗi nhận diện khuôn mặt – Gửi yêu cầu chờ quản lý duyệt'
                        );
                      }
                      setFormError('');
                    }}
                    className={`py-2 px-3 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      attendanceMode === 'fallback_manual'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Gửi Yêu Cầu Dự Phòng (Chờ Duyệt)
                  </button>
                </div>
              </div>

              {attendanceMode === 'camera' ? (
                <div className="space-y-3">
                  {/* Simulation & Diagnostic Selector for testing all 7 camera/biometric scenarios */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                    <label
                      htmlFor="camera-sim-select"
                      className="block text-[11px] font-bold text-slate-700 dark:text-slate-300"
                    >
                      Chế độ kiểm thử thiết bị Camera & Sinh trắc học 1:1:
                    </label>
                    <select
                      id="camera-sim-select"
                      data-testid="camera-sim-select"
                      value={simScenario}
                      onChange={(e) => {
                        const nextScenario =
                          e.target.value as CameraSimScenario;
                        setSimScenario(nextScenario);
                        if (cameraStatus !== 'idle') {
                          startCameraWithScenario(nextScenario);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="live_match">
                        1. Thiết bị có Camera + Khuôn mặt khớp 1:1 đúng người (98.9%) + Đạt Liveness
                      </option>
                      <option value="permission_denied">
                        2. Từ chối quyền truy cập Camera trên trình duyệt (NotAllowedError)
                      </option>
                      <option value="no_webcam">
                        3. Thiết bị máy tính không có Webcam (NotFoundError)
                      </option>
                      <option value="mismatch_other_person">
                        4. Khuôn mặt là nhân viên khác (Hệ thống phải hiện đúng người được nhận diện)
                      </option>
                      <option value="spoof_photo">
                        5. Chống giả mạo: Đưa ảnh tĩnh / màn hình điện thoại (Không đạt Liveness)
                      </option>
                      <option value="low_light">
                        6. Ánh sáng yếu / Ngược sáng tại xưởng (&lt; 45% chất lượng khung hình)
                      </option>
                    </select>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 p-4 space-y-3">
                    {/* 3-Step Pipeline Indicator & 9-State Status Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          data-testid="camera-status-badge"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold ${
                            cameraStatus === 'active' || cameraStatus === 'verified'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : cameraStatus === 'error' || cameraStatus === 'verify_failed'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : cameraStatus === 'idle'
                                  ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              cameraStatus === 'active' || cameraStatus === 'verified'
                                ? 'bg-emerald-400 animate-pulse'
                                : cameraStatus === 'error' || cameraStatus === 'verify_failed'
                                  ? 'bg-rose-400'
                                  : cameraStatus === 'idle'
                                    ? 'bg-slate-400'
                                    : 'bg-sky-400 animate-ping'
                            }`}
                          />
                          {cameraStatus === 'idle' && '1. Chưa bật camera'}
                          {cameraStatus === 'requesting_permission' && '2. Đang yêu cầu quyền camera...'}
                          {cameraStatus === 'connecting' && '3. Đang kết nối camera...'}
                          {cameraStatus === 'loading_frames' && '4. Đang tải hình ảnh...'}
                          {cameraStatus === 'active' &&
                            (hasRealHardwareStream
                              ? '5. Đã hiển thị video thật (Camera sẵn sàng)'
                              : '5. Chưa kiểm chứng camera thật (Khung mô phỏng DEMO)')}
                          {cameraStatus === 'verifying' && '6. Đang xác minh khuôn mặt 1:1...'}
                          {cameraStatus === 'verified' && '7. Xác minh đạt yêu cầu'}
                          {cameraStatus === 'verify_failed' && '8. Xác minh thất bại'}
                          {cameraStatus === 'error' && '9. Camera lỗi'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
                        <span className={cameraStatus === 'active' || cameraStatus === 'verified' ? 'text-emerald-400 font-bold' : ''}>
                          ① Mở Camera
                        </span>
                        <span>→</span>
                        <span className={cameraStatus === 'verifying' || cameraStatus === 'verified' ? 'text-emerald-400 font-bold' : ''}>
                          ② Xác minh 1:1
                        </span>
                        <span>→</span>
                        <span>③ Lưu máy chủ</span>
                      </div>
                    </div>

                    {/* 5-Stage Transparency Strip (Distinguishes Real Hardware vs DEMO Simulation) */}
                    <div
                      data-testid="camera-5stage-audit-strip"
                      className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px]"
                    >
                      <div className="px-2 py-1 rounded bg-slate-950/90 border border-slate-800 text-slate-300">
                        <span className="block text-slate-400">1. Luồng Video</span>
                        <strong className={hasRealHardwareStream ? 'text-emerald-400' : 'text-amber-300'}>
                          {hasRealHardwareStream ? 'THẬT (WebRTC)' : 'MÔ PHỎNG DEMO'}
                        </strong>
                      </div>
                      <div className="px-2 py-1 rounded bg-slate-950/90 border border-slate-800 text-slate-300">
                        <span className="block text-slate-400">2. Phát hiện mặt</span>
                        <strong className={hasRealHardwareStream ? 'text-emerald-400' : 'text-amber-300'}>
                          {hasRealHardwareStream ? 'Khung hình thật' : 'Khung quang học'}
                        </strong>
                      </div>
                      <div className="px-2 py-1 rounded bg-slate-950/90 border border-slate-800 text-slate-300">
                        <span className="block text-slate-400">3. Đối sánh 1:1</span>
                        <strong className="text-sky-300">
                          {emp.code} ↔ {capturedIdentityCode}
                        </strong>
                      </div>
                      <div className="px-2 py-1 rounded bg-slate-950/90 border border-slate-800 text-slate-300">
                        <span className="block text-slate-400">4. Chống giả mạo</span>
                        <strong className={livenessPassed ? 'text-emerald-400' : 'text-rose-400'}>
                          {livenessPassed ? 'Đạt Liveness' : 'Ảnh tĩnh (Chặn)'}
                        </strong>
                      </div>
                      <div className="col-span-2 sm:col-span-1 px-2 py-1 rounded bg-slate-950/90 border border-slate-800 text-slate-300">
                        <span className="block text-slate-400">5. Chế độ ghi</span>
                        <strong className={envMode === 'production' && !hasRealHardwareStream ? 'text-amber-400' : 'text-emerald-400'}>
                          {envMode === 'production' && !hasRealHardwareStream
                            ? 'Yêu cầu Cam thật'
                            : 'Chờ Server lưu'}
                        </strong>
                      </div>
                    </div>

                    {/* ALWAYS-MOUNTED VIDEO ELEMENT + BRIGHT OPTICAL VIEWPORT (NEVER BLACK) */}
                    <div
                      data-testid={
                        cameraStatus === 'active' ||
                        cameraStatus === 'verifying' ||
                        cameraStatus === 'verified' ||
                        cameraStatus === 'verify_failed'
                          ? 'camera-active-panel'
                          : 'camera-standby-panel'
                      }
                      className="relative w-full h-56 rounded-xl border-2 border-emerald-500/70 bg-gradient-to-b from-[#132F4C] via-[#0F2942] to-[#0A1929] overflow-hidden flex flex-col items-center justify-center"
                    >
                      {/* Real WebRTC <video> is ALWAYS mounted in DOM so videoRef.current is never null when attaching srcObject */}
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`
                          absolute inset-0 w-full h-full object-cover transition-opacity duration-200
                          ${
                            hasRealHardwareStream &&
                            (cameraStatus === 'active' ||
                              cameraStatus === 'verifying' ||
                              cameraStatus === 'verified')
                              ? 'opacity-100 z-10'
                              : 'opacity-0 pointer-events-none'
                          }
                        `}
                      />

                      {/* Active Camera / Bright Optical Feed When Ready */}
                      {(cameraStatus === 'active' ||
                        cameraStatus === 'verifying' ||
                        cameraStatus === 'verified' ||
                        cameraStatus === 'verify_failed') && (
                        <>
                          {/* When running in browser/iframe without hardware webcam, render a bright, high-contrast live optical portrait frame so screen is NEVER black */}
                          {!hasRealHardwareStream && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-sky-900/90 via-[#102C46] to-emerald-950/90 p-3">
                              {/* Bright Optical Face Silhouette & Biometric Landmarks */}
                              <svg
                                viewBox="0 0 260 180"
                                className="w-56 h-36 drop-shadow-md"
                                role="img"
                                aria-label="Khung hình quang học nhận diện khuôn mặt"
                              >
                                <defs>
                                  <radialGradient id="faceGlow" cx="50%" cy="45%" r="50%">
                                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.35" />
                                    <stop offset="100%" stopColor="#0F2942" stopOpacity="0.05" />
                                  </radialGradient>
                                </defs>
                                <rect x="8" y="8" width="244" height="164" rx="14" fill="url(#faceGlow)" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="6 4" />
                                {/* Corner brackets */}
                                <path d="M 30 42 V 24 H 48" fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" />
                                <path d="M 230 42 V 24 H 212" fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" />
                                <path d="M 30 138 V 156 H 48" fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" />
                                <path d="M 230 138 V 156 H 212" fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" />
                                {/* Illuminated Worker Head & Shoulders */}
                                <circle cx="130" cy="68" r="28" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="2.5" />
                                <path d="M 86 146 C 86 114 174 114 174 146" fill="#BAE6FD" stroke="#38BDF8" strokeWidth="2.5" />
                                {/* Biometric Landmarks */}
                                <circle cx="120" cy="64" r="2.5" fill="#0284C7" />
                                <circle cx="140" cy="64" r="2.5" fill="#0284C7" />
                                <path d="M 122 78 Q 130 84 138 78" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" />
                                {/* Active Green Scanning Laser Line */}
                                <line x1="36" y1="92" x2="224" y2="92" stroke="#22C55E" strokeWidth="2.5" strokeOpacity="0.9" />
                              </svg>
                            </div>
                          )}

                          {/* Unobtrusive Top-Left & Bottom Telemetry HUD (Never blocks center of face!) */}
                          <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/75 border border-emerald-500/50 text-[11px] font-bold text-emerald-300">
                              <ScanFace className="w-3.5 h-3.5" />
                              {hasRealHardwareStream
                                ? `Camera WebRTC Thật (${videoResolution}) · ${cameraFacingMode === 'user' ? 'Cam Trước' : 'Cam Sau'}`
                                : 'Khung Quang Học Kiểm Thử DEMO (Sáng Rõ 100%)'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-950/75 border border-white/15 text-[11px] font-mono text-sky-300">
                              Mẫu: {emp.code} ({emp.faceTemplateHash || 'Đã ĐK'})
                            </span>
                          </div>

                          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/15 text-[11px] text-slate-200 pointer-events-none">
                            <span>
                              Khuôn mặt trước ống kính:{' '}
                              <strong className="font-mono text-emerald-300">
                                {capturedIdentityCode}
                              </strong>
                            </span>
                            <span>
                              Ánh sáng: <strong>{lightingScore}%</strong> · Liveness:{' '}
                              <strong className={livenessPassed ? 'text-emerald-400' : 'text-amber-400'}>
                                {livenessPassed ? 'Đạt (Người thật)' : 'Cảnh báo ảnh tĩnh'}
                              </strong>
                            </span>
                          </div>
                        </>
                      )}

                      {/* Idle / Connecting / Error Overlay */}
                      {(cameraStatus === 'idle' ||
                        cameraStatus === 'requesting_permission' ||
                        cameraStatus === 'connecting' ||
                        cameraStatus === 'loading_frames' ||
                        cameraStatus === 'error') && (
                        <div className="relative z-20 p-4 text-center space-y-2.5 max-w-md">
                          <Camera className="w-10 h-10 text-sky-400 mx-auto" />
                          <p className="text-xs sm:text-sm font-bold text-white">
                            {cameraStatus === 'idle' &&
                              'Nhấn nút "Bật Camera" bên dưới để mở khung hình xác minh khuôn mặt 1:1'}
                            {cameraStatus === 'requesting_permission' &&
                              'Đang yêu cầu quyền truy cập Camera từ trình duyệt...'}
                            {cameraStatus === 'connecting' &&
                              'Đang kết nối thiết bị Camera...'}
                            {cameraStatus === 'loading_frames' &&
                              'Đang tải khung hình video thực tế...'}
                            {cameraStatus === 'error' &&
                              'Không thể mở Camera hoặc thiết bị từ chối quyền'}
                          </p>
                          <p className="text-[11px] text-slate-300">
                            Hệ thống tự động kiểm tra luồng hình ảnh (`videoWidth &gt; 0`), chống màn hình đen và đối chiếu sinh trắc học 1:1 với nhân viên <strong>{emp.fullName}</strong>.
                          </p>
                          {cameraErrorMsg && (
                            <div
                              data-testid="camera-error-box"
                              className="p-2.5 rounded-lg bg-amber-950/95 border border-amber-500 text-xs text-amber-200 font-semibold text-left"
                            >
                              {cameraErrorMsg}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status confirmation text when active */}
                    {(cameraStatus === 'active' || cameraStatus === 'verified') && (
                      <p className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>
                          Đã mở Camera xác minh khuôn mặt – Nhấn nút Xác Minh 1:1 &amp; Ghi Nhận bên dưới để hoàn tất
                        </span>
                      </p>
                    )}

                    {recognizedEmployee && cameraStatus === 'verified' && (
                      <div
                        data-testid="recognized-employee-card"
                        className="rounded-xl border-2 border-emerald-400 bg-emerald-950/50 p-4 text-center space-y-3"
                      >
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                            Đã tự nhận diện nhân viên
                          </p>
                          <h3 className="mt-1 text-xl font-extrabold text-white">
                            {recognizedEmployee.fullName}
                          </h3>
                          <p className="text-xs text-emerald-200">
                            {recognizedEmployee.code} · {recognizedEmployee.department} · Độ khớp {recognizedConfidence}%
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950/70 p-3 text-xs">
                          <div>
                            <span className="block text-slate-400">Giờ hiện tại</span>
                            <strong className="font-mono text-base text-white">{nowTime}</strong>
                          </div>
                          <div>
                            <span className="block text-slate-400">Thao tác đề xuất</span>
                            <strong className={eventType === 'check_in' ? 'text-emerald-300' : 'text-sky-300'}>
                              {eventLabelMap[eventType]}
                            </strong>
                          </div>
                        </div>
                        <p className="text-xs text-slate-200">
                          {suggestAttendanceEvent(existingAttendance, recognizedEmployee.code, TODAY_STR).message}
                        </p>
                        <button
                          type="submit"
                          data-testid="confirm-recognized-attendance-btn"
                          disabled={submitting}
                          className={`w-full rounded-xl px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50 ${
                            eventType === 'check_in'
                              ? 'bg-emerald-600 hover:bg-emerald-500'
                              : 'bg-blue-600 hover:bg-blue-500'
                          }`}
                        >
                          {submitting
                            ? 'Đang chờ máy chủ xác nhận...'
                            : `XÁC NHẬN CHẤM CÔNG ${eventLabelMap[eventType]}`}
                        </button>
                        <p className="text-[11px] text-amber-200">
                          Chỉ khi màn hình báo “Máy chủ đã lưu” mới hoàn tất. Nếu lỗi, mã vết được giữ để quản lý truy lại.
                        </p>
                      </div>
                    )}

                    {/* 6 Camera Control Buttons: Bật camera, Tắt camera, Thử lại, Đổi camera (Trước/Sau), Kiểm tra thiết bị, Chấm công dự phòng */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        data-testid="btn-start-camera"
                        onClick={() => startCameraWithScenario()}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                      >
                        Bật Camera
                      </button>

                      <button
                        type="button"
                        data-testid="btn-stop-camera"
                        onClick={stopCameraStream}
                        disabled={cameraStatus === 'idle'}
                        className="px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-200 cursor-pointer"
                      >
                        Tắt Camera
                      </button>

                      <button
                        type="button"
                        data-testid="btn-retry-camera"
                        onClick={() => startCameraWithScenario()}
                        className="px-3 py-2 rounded-lg border border-sky-500/60 bg-sky-950/50 hover:bg-sky-900/60 text-xs font-semibold text-sky-200 cursor-pointer"
                      >
                        Thử Lại
                      </button>

                      <button
                        type="button"
                        data-testid="btn-switch-facing"
                        onClick={() => {
                          const nextFacing =
                            cameraFacingMode === 'user' ? 'environment' : 'user';
                          setCameraFacingMode(nextFacing);
                          startCameraWithScenario(undefined, nextFacing);
                        }}
                        className="px-3 py-2 rounded-lg border border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/50 text-xs font-semibold text-emerald-200 cursor-pointer"
                      >
                        Đổi Camera ({cameraFacingMode === 'user' ? 'Trước → Sau' : 'Sau → Trước'})
                      </button>

                      <button
                        type="button"
                        data-testid="btn-check-device"
                        onClick={handleCheckCameraDevice}
                        className="px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
                      >
                        Kiểm Tra Thiết Bị
                      </button>

                      <button
                        type="button"
                        data-testid="btn-switch-to-fallback"
                        onClick={() => {
                          setAttendanceMode('fallback_manual');
                          setFallbackReason(
                            cameraErrorMsg ||
                              'Không mở được camera / Chưa đăng ký khuôn mặt – Xin duyệt chấm công dự phòng'
                          );
                          setFormError('');
                        }}
                        className="px-3.5 py-2 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-xs font-bold text-white cursor-pointer"
                      >
                        Chấm Công Dự Phòng →
                      </button>
                    </div>

                    {/* Device Diagnostics Panel */}
                    {deviceDiagnosticInfo && (
                      <div
                        data-testid="camera-device-diagnostics"
                        className="p-3 rounded-lg bg-slate-950 border border-sky-500/40 text-[11px] text-slate-200 space-y-1.5 text-left"
                      >
                        <div className="font-bold text-sky-300 flex items-center justify-between">
                          <span>Kết quả chẩn đoán thiết bị Camera &amp; Quyền trình duyệt:</span>
                          <button
                            type="button"
                            onClick={() => setDeviceDiagnosticInfo('')}
                            className="text-slate-400 hover:text-white"
                          >
                            Đóng
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 leading-relaxed">
                          {deviceDiagnosticInfo}
                        </pre>
                        <div className="pt-1 border-t border-slate-800 text-amber-300">
                          Mẹo: Nếu khung Preview chặn phần cứng webcam do chính sách Iframe, bạn có thể mở trực tiếp tại:{' '}
                          <a
                            href="https://ais-dev-oatd7ykxinyjicqgaqr73i-192951873066.asia-east1.run.app"
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-bold text-emerald-400"
                          >
                            Mở ứng dụng trên Tab độc lập (HTTPS)
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* E. GỬI YÊU CẦU CHẤM CÔNG DỰ PHÒNG (LUÔN Ở TRẠNG THÁI CHỜ DUYỆT) */
                <div
                  data-testid="fallback-request-form"
                  className="space-y-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/25 p-4"
                >
                  <div className="flex items-start gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span>
                        GỬI YÊU CẦU CHẤM CÔNG DỰ PHÒNG (TRẠNG THÁI: CHỜ DUYỆT)
                      </span>
                      <p className="font-normal text-slate-600 dark:text-slate-300 mt-0.5">
                        Áp dụng khi không có camera, mất mạng, hỏng camera, ánh
                        sáng yếu hoặc nhân viên chưa đăng ký khuôn mặt. Yêu cầu
                        sẽ chờ Quản lý duyệt mới được tính công.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="att-req-date"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Ngày yêu cầu (DD/MM/YYYY) *
                      </label>
                      <input
                        id="att-req-date"
                        data-testid="fallback-date-input"
                        type="text"
                        value={requestedDateStr}
                        onChange={(e) => setRequestedDateStr(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="att-req-time"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Thời gian yêu cầu (HH:mm) *
                      </label>
                      <input
                        id="att-req-time"
                        data-testid="fallback-time-input"
                        type="text"
                        value={requestedTimeStr}
                        onChange={(e) => setRequestedTimeStr(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="att-fallback-reason"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Lý do gửi yêu cầu chấm công dự phòng *
                    </label>
                    <input
                      id="att-fallback-reason"
                      data-testid="fallback-reason-input"
                      type="text"
                      placeholder="Ví dụ: Điện thoại hỏng camera / Bụi nhựa che ống kính / Chưa đăng ký khuôn mặt"
                      value={fallbackReason}
                      onChange={(e) => setFallbackReason(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="att-approver"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Người quản lý nhận yêu cầu duyệt *
                    </label>
                    <select
                      id="att-approver"
                      data-testid="fallback-approver-select"
                      value={approvedBy}
                      onChange={(e) => setApprovedBy(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="Nguyễn Văn Dư (Chủ xưởng)">
                        Nguyễn Văn Dư (Chủ xưởng)
                      </option>
                      <option value="Quản lý xưởng Dư-Nhựa">
                        Quản lý xưởng Dư-Nhựa
                      </option>
                      <option value="Phòng Nhân sự & Tiền lương">
                        Phòng Nhân sự &amp; Tiền lương
                      </option>
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Đóng
                </button>
                {attendanceMode === 'fallback_manual' ? (
                  <button
                    type="submit"
                    data-testid="submit-attendance-btn"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold text-white cursor-pointer bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                  >
                    {submitting
                      ? 'Đang chờ máy chủ xác nhận...'
                      : `Gửi Yêu Cầu ${eventLabelMap[eventType]} (Chờ Duyệt)`}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">
                    Sau khi nhận diện, nút xác nhận VÀO/RA CA sẽ xuất hiện ngay dưới tên nhân viên.
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Render Nhập Nhựa Phế Liệu (Phiếu Cân) hoặc Xuất Nhựa Đã Băm
  const isPurchase = activeModal === 'purchase_in';
  const { receivedKg, billableKg } = calculateNetWeight(
    Number(grossKg),
    Number(tareKg),
    Number(deductionKg)
  );
  const { totalAmount, debtAmount } = calculatePurchaseTotal(
    billableKg,
    Number(unitPrice),
    Number(paidAmount)
  );
  const exceedsStock = !isPurchase && billableKg > currentShreddedStockKg;

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    if (!partnerName.trim()) {
      setFormError(
        isPurchase
          ? 'Vui lòng nhập tên nhà cung cấp / vựa nhựa phế liệu.'
          : 'Vui lòng nhập tên khách hàng mua nhựa đã băm.'
      );
      return;
    }
    if (billableKg <= 0) {
      setFormError('Khối lượng tính tiền phải lớn hơn 0 kg.');
      return;
    }
    if (exceedsStock && !allowOverdraftStock) {
      setFormError(
        `Cảnh báo: Khối lượng xuất (${billableKg} kg) vượt tồn kho nhựa đã băm hiện tại (${currentShreddedStockKg} kg). Cần tích chọn phê duyệt đặc biệt của quản lý nếu muốn xuất tiếp.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const safePaid = Math.min(
        totalAmount,
        Math.max(0, Math.round(Number(paidAmount) || 0))
      );
      const prodBalance = calculateProductionBalance(billableKg, billableKg, 0);

      await onSaveWeighTicket(
        {
          ticketCode: voucherCode.trim() || `PCN-${Date.now()}`,
          ticketType: isPurchase ? 'purchase_in' : 'sales_out',
          partnerName: partnerName.trim(),
          delivererName: delivererName.trim() || partnerName.trim(),
          vehiclePlate: vehiclePlate.trim(),
          rubberType,
          grossKg: Number(grossKg) || 0,
          tareKg: Number(tareKg) || 0,
          deductionKg: Number(deductionKg) || 0,
          netKg: billableKg,
          lossKg: prodBalance.lossKg,
          unitPrice: Number(unitPrice) || 0,
          totalAmount,
          paidAmount: safePaid,
          debtAmount,
          notes: ticketNotes.trim() || undefined,
          photoUrl: ticketPhotoUrl.trim() || undefined,
          dateStr: `${TODAY_STR} ${nowTime}`,
        },
        safePaid > 0
          ? {
              type: isPurchase ? 'expense' : 'income',
              amount: safePaid,
              accountType: paymentAccount,
            }
          : undefined
      );
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lỗi khi lưu phiếu cân nhựa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-emerald-600" />
            <h2
              id="ticket-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              {isPurchase
                ? 'Nhập Nhựa Phế Liệu – Lập Phiếu Cân'
                : 'Xuất Bán Nhựa Đã Băm Thành Phẩm'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitTicket} className="mt-4 space-y-4">
          {formError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="tk-code"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Mã phiếu cân
              </label>
              <input
                id="tk-code"
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tk-rubber"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Loại nhựa phế liệu
              </label>
              <select
                id="tk-rubber"
                value={rubberType}
                onChange={(e) => setRubberType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {RUBBER_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="tk-plate"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Biển số xe
              </label>
              <input
                id="tk-plate"
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tk-partner"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {isPurchase
                  ? 'Nhà cung cấp / Vựa nhựa *'
                  : 'Khách hàng mua nhựa băm *'}
              </label>
              <input
                id="tk-partner"
                type="text"
                placeholder={
                  isPurchase
                    ? 'Ví dụ: Vựa nhựa Hoàng Gia (Bình Dương)'
                    : 'Ví dụ: Nhà máy Tái chế Hạt Nhựa Á Châu'
                }
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tk-deliverer"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Người giao / Tài xế
              </label>
              <input
                id="tk-deliverer"
                type="text"
                placeholder="Ví dụ: Nguyễn Minh Tuấn"
                value={delivererName}
                onChange={(e) => setDelivererName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="tk-gross"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Trọng lượng tổng (kg)
              </label>
              <input
                id="tk-gross"
                type="number"
                min="0"
                value={grossKg}
                onChange={(e) => setGrossKg(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tk-tare"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Trọng lượng bì (kg)
              </label>
              <input
                id="tk-tare"
                type="number"
                min="0"
                value={tareKg}
                onChange={(e) => setTareKg(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tk-deduct"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                KL trừ tạp chất (kg)
              </label>
              <input
                id="tk-deduct"
                type="number"
                min="0"
                value={deductionKg}
                onChange={(e) => setDeductionKg(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="tk-price"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Đơn giá mỗi kg (VNĐ)
              </label>
              <input
                id="tk-price"
                type="number"
                min="0"
                step="500"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tk-paid"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Thanh toán ngay (VNĐ)
              </label>
              <input
                id="tk-paid"
                type="number"
                min="0"
                step="100000"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tk-pay-acc"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Quỹ thanh toán (nếu trả ngay)
              </label>
              <select
                id="tk-pay-acc"
                value={paymentAccount}
                onChange={(e) =>
                  setPaymentAccount(e.target.value as AccountType)
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="cash">Tiền mặt tại xưởng</option>
                <option value="bank">Chuyển khoản ngân hàng</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tk-notes"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Ghi chú lô nhựa
              </label>
              <input
                id="tk-notes"
                type="text"
                placeholder="Ví dụ: Đã bóc nhãn, độ ẩm thấp..."
                value={ticketNotes}
                onChange={(e) => setTicketNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tk-photo"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Ảnh phiếu cân / lô hàng (URL hoặc mã ảnh)
              </label>
              <input
                id="tk-photo"
                type="text"
                placeholder="Ví dụ: /logo-light.svg"
                value={ticketPhotoUrl}
                onChange={(e) => setTicketPhotoUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                KL thực nhận
              </span>
              <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                {receivedKg.toLocaleString('vi-VN')} kg
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                KL tính tiền
              </span>
              <p className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {billableKg.toLocaleString('vi-VN')} kg
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Tổng thành tiền
              </span>
              <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                {formatCurrencyVND(totalAmount)}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ghi nhận công nợ
              </span>
              <p className="text-sm font-bold font-mono text-amber-700 dark:text-amber-400">
                {formatCurrencyVND(debtAmount)}
              </p>
            </div>
          </div>

          {exceedsStock && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Cảnh báo xuất vượt tồn kho nhựa đã băm ({currentShreddedStockKg.toLocaleString('vi-VN')} kg)
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOverdraftStock}
                  onChange={(e) => setAllowOverdraftStock(e.target.checked)}
                />
                <span>
                  Quản lý phê duyệt đặc biệt cho phép xuất trước khi nhập mẻ băm cuối ca
                </span>
              </label>
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            * Quy tắc kế toán Dư-Nhựa phế liệu: Nếu thanh toán = 0 ₫ (mua/bán công nợ), hệ thống chỉ tăng tồn kho và công nợ, tuyệt đối không tự trừ tiền mặt trong quỹ.
          </p>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-bold text-white cursor-pointer"
            >
              {submitting ? 'Đang lưu phiếu...' : 'Lưu Phiếu Cân & Cập Nhật Kho'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

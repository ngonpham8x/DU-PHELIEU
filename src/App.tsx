import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Ban,
  Boxes,
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Edit3,
  Eye,
  FileSpreadsheet,
  Lock,
  LogIn,
  LogOut,
  Minus,
  Plus,
  PlusCircle,
  Printer,
  RotateCcw,
  ScanFace,
  Search,
  Settings,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  addDoc,
  collection,
  getDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import type {
  AccountType,
  ActivityLogRecord,
  ActivityModuleType,
  AppSettings,
  AttendanceAttemptTrace,
  AttendanceRecord,
  CashTransaction,
  DailyTimesheetRow,
  EmployeeProfile,
  EnvironmentMode,
  PlasticInventoryCategory,
  PlasticInventoryItem,
  PlasticTypeItem,
  ShiftDefinition,
  ShredderMachine,
  ToastMessage,
  ToastType,
  UserProfile,
  UserRole,
  WeighTicket,
} from './types/factory';
import {
  DEFAULT_PLASTIC_TYPES,
  DEFAULT_SETTINGS,
  DEMO_ACTIVITY_LOGS,
  DEMO_ATTENDANCE,
  DEMO_EMPLOYEES,
  DEMO_INVENTORY_ITEMS,
  DEMO_MACHINES,
  DEMO_SHIFTS,
  DEMO_TICKETS,
  DEMO_TRANSACTIONS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ROLE_LABELS,
  SQL_MIGRATION_SCRIPT,
  TODAY_STR,
} from './data/demoSeed';
import {
  calculateDashboardMetrics,
  calculateProductionBalance,
  canApproveFallbackAttendance,
  canEditAttendanceTime,
  canManageCashFlow,
  canManageFaceEnrollment,
  canRestoreTransaction,
  formatCurrencyVND,
  formatServerTimeHCM,
  formatWeight,
} from './utils/calculations';
import { OfflineIndicator } from './components/PWAInstallButton';
import type { QuickModalType } from './components/QuickModals';
import {
  AppShell,
  SIDEBAR_MENU_ITEMS,
  type NavTab,
} from './components/AppShell';
import { ToastContainer } from './components/ToastContainer';
import { ResponsiveTableEnhancer } from './components/ResponsiveTableEnhancer';
import type { TransactionUpdatePayload } from './components/TransactionDetailModal';
import { postStockMovement, type StockMovement } from './modules/phase4d/stockDomain';
import {
  PRIMARY_OWNER_EMAIL,
  evaluateAccountAccess,
  evaluateSignInThrottle,
  normalizeAccountEmail,
} from './security/accountSecurity';

const BrandAssetShowcase = React.lazy(() => import('./components/BrandLogo').then((m) => ({ default: m.BrandAssetShowcase })));
const QuickModals = React.lazy(() => import('./components/QuickModals').then((m) => ({ default: m.QuickModals })));
const TransactionDetailModal = React.lazy(() => import('./components/TransactionDetailModal').then((m) => ({ default: m.TransactionDetailModal })));
const ActivityLogView = React.lazy(() => import('./components/ActivityLogView').then((m) => ({ default: m.ActivityLogView })));
const AttendanceModule = React.lazy(() => import('./components/AttendanceModule').then((m) => ({ default: m.AttendanceModule })));
const PayrollPreview = React.lazy(() => import('./components/PayrollPreview').then((m) => ({ default: m.PayrollPreview })));
const PayrollWorkflowDemo = React.lazy(() => import('./modules/phase4b/PayrollWorkflowDemo').then((m) => ({ default: m.PayrollWorkflowDemo })));
const EmployeeManagerDemo = React.lazy(() => import('./modules/phase4b/EmployeeManagerDemo').then((m) => ({ default: m.EmployeeManagerDemo })));
const FactoryOpsDemo = React.lazy(() => import('./modules/phase4c/FactoryOpsDemo').then((m) => ({ default: m.FactoryOpsDemo })));
const StockLedgerPanel = React.lazy(() => import('./modules/phase4d/StockLedgerPanel').then((m) => ({ default: m.StockLedgerPanel })));
const OperationsSummary = React.lazy(() => import('./modules/phase4d/StockLedgerPanel').then((m) => ({ default: m.OperationsSummary })));
const ReleaseReadiness = React.lazy(() => import('./modules/phase4e/ReleaseReadiness').then((m) => ({ default: m.ReleaseReadiness })));

const ACTIVE_TAB_STORAGE_KEY = 'vandu_active_tab';
const DEMO_TX_STORAGE_KEY = 'vandu_demo_transactions_v1';
const DEMO_LOGS_STORAGE_KEY = 'vandu_demo_activity_logs_v1';
const DEMO_ATT_STORAGE_KEY = 'vandu_demo_attendance_v1';
const ATTENDANCE_TRACE_STORAGE_KEY = 'dunhua_attendance_attempt_traces_v1';
const DEMO_EMP_STORAGE_KEY = 'vandu_demo_employees_v1';
const DEMO_SHIFTS_STORAGE_KEY = 'vandu_demo_shifts_v1';
const DEMO_ROLE_STORAGE_KEY = 'vandu_demo_role_v1';
const DEMO_PLASTIC_TYPES_KEY = 'dunhua_plastic_types_v1';
const DEMO_MACHINES_KEY = 'dunhua_machines_v1';
const DEMO_INVENTORY_KEY = 'dunhua_inventory_v1';
const DEMO_STOCK_LEDGER_KEY = 'dunhua_demo_stock_movements_v1';
const DEMO_TICKETS_STORAGE_KEY = 'dunhua_demo_tickets_v1';
const MIGRATION_SNAPSHOT_KEY = 'dunhua_pre_migration_snapshot_v1';
const LOGIN_ATTEMPT_STORAGE_KEY = 'dunhua_login_attempts_v1';

interface SecurityAlert {
  id: string;
  email: string;
  type: string;
  severity: 'medium' | 'high' | 'critical';
  message: string;
}

const PLASTIC_INVENTORY_CATEGORIES: PlasticInventoryCategory[] = [
  'Nhựa phế liệu chưa phân loại',
  'Nhựa đã phân loại',
  'Nhựa chờ băm',
  'Nhựa đã băm',
  'Phế phẩm',
  'Vật tư',
];

// Chỉ dùng để xem xét dữ liệu lịch sử. Không được suy đoán mủ cao su = một loại nhựa.
function migrateLegacyRubberText(text: string): string {
  return text;
}

export default function App() {
  // Environment Mode: strictly separated ('demo' vs 'production')
  const [envMode, setEnvMode] = useState<EnvironmentMode>('demo');

  // Active Navigation Tab persisted in localStorage so reload keeps active page
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    try {
      const saved = window.localStorage.getItem(
        ACTIVE_TAB_STORAGE_KEY
      ) as NavTab | null;
      if (saved && SIDEBAR_MENU_ITEMS.some((m) => m.id === saved)) {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'home';
  });

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    } catch {
      // Ignore storage errors
    }
  };

  const [activeModal, setActiveModal] = useState<QuickModalType>(null);

  // Settings (Currency VNĐ, Weight kg/tấn & decimals, Dark mode)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Auth & User Role state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    let savedRole: UserRole = 'owner';
    try {
      const r = window.localStorage.getItem(
        DEMO_ROLE_STORAGE_KEY
      ) as UserRole | null;
      if (r && r in ROLE_LABELS) {
        savedRole = r;
      }
    } catch {
      // Ignore storage error
    }
    return {
      uid: 'demo-owner',
      displayName: 'Nguyễn Văn Dư',
      email: PRIMARY_OWNER_EMAIL,
      role: savedRole,
      department: 'Ban Giám Đốc – Dư-Nhựa phế liệu',
      createdAt: TODAY_STR,
      updatedAt: TODAY_STR,
    };
  });
  const [authError, setAuthError] = useState('');
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const securityFeedReadyRef = useRef(false);
  const seenSecurityAlertIdsRef = useRef<Set<string>>(new Set());

  // Toast Notification state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = (
    title: string,
    detail?: string,
    type: ToastType = 'success'
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowTime = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setToasts((prev) => [
      { id, title, detail, type, timestamp: nowTime },
      ...prev.slice(0, 1),
    ]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // DEMO state (persisted in localStorage under DEMO-only keys so reload keeps test data, never mixed with Production)
  const [demoTransactions, setDemoTransactions] = useState<CashTransaction[]>(
    () => {
      try {
        const raw = window.localStorage.getItem(DEMO_TX_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Ignore storage error
      }
      return DEMO_TRANSACTIONS;
    }
  );

  const [demoActivityLogs, setDemoActivityLogs] = useState<ActivityLogRecord[]>(
    () => {
      try {
        const raw = window.localStorage.getItem(DEMO_LOGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Ignore storage error
      }
      return DEMO_ACTIVITY_LOGS;
    }
  );

  const [demoAttendance, setDemoAttendance] = useState<AttendanceRecord[]>(
    () => {
      try {
        const raw = window.localStorage.getItem(DEMO_ATT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Ignore storage error
      }
      return DEMO_ATTENDANCE;
    }
  );

  const [attendanceAttemptTraces, setAttendanceAttemptTraces] = useState<AttendanceAttemptTrace[]>(() => {
    try {
      const raw = window.localStorage.getItem(ATTENDANCE_TRACE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 200) : [];
    } catch {
      return [];
    }
  });

  const [demoTickets, setDemoTickets] = useState<WeighTicket[]>(() => {
    try {
      const raw = window.localStorage.getItem(DEMO_TICKETS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage error
    }
    return DEMO_TICKETS;
  });

  const [plasticTypes, setPlasticTypes] = useState<PlasticTypeItem[]>(() => {
    try {
      const raw = window.localStorage.getItem(DEMO_PLASTIC_TYPES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage error
    }
    return DEFAULT_PLASTIC_TYPES;
  });

  const [machines, setMachines] = useState<ShredderMachine[]>(() => {
    try {
      const raw = window.localStorage.getItem(DEMO_MACHINES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage error
    }
    return DEMO_MACHINES;
  });

  const [inventoryItems, setInventoryItems] = useState<PlasticInventoryItem[]>(
    () => {
      try {
        const raw = window.localStorage.getItem(DEMO_INVENTORY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Ignore storage error
      }
      return DEMO_INVENTORY_ITEMS;
    }
  );

  // Phase 4D: append-only DEMO stock movement history, not authoritative Production inventory.
  const [demoStockMovements, setDemoStockMovements] = useState<StockMovement[]>(() => {
    try {
      const found = JSON.parse(window.localStorage.getItem(DEMO_STOCK_LEDGER_KEY) || '[]');
      return Array.isArray(found) ? found : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(DEMO_STOCK_LEDGER_KEY, JSON.stringify(demoStockMovements)); }
    catch { /* DEMO storage quota; production not affected */ }
  }, [demoStockMovements]);

  // Plastic type management states (for Cân nhựa tab)
  const [showPlasticTypeManager, setShowPlasticTypeManager] = useState(false);
  const [newPlasticCode, setNewPlasticCode] = useState('');
  const [newPlasticName, setNewPlasticName] = useState('');
  const [newPlasticPrice, setNewPlasticPrice] = useState('14000');
  const [newPlasticImpurity, setNewPlasticImpurity] = useState('3.5');
  const [newPlasticDesc, setNewPlasticDesc] = useState('');
  const [editingPlasticId, setEditingPlasticId] = useState<string | null>(null);
  const [editingPlasticPrice, setEditingPlasticPrice] = useState('');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migrationConfirmed, setMigrationConfirmed] = useState(false);
  const [hasMigrationSnapshot, setHasMigrationSnapshot] = useState<boolean>(() => {
    try {
      return Boolean(window.localStorage.getItem(MIGRATION_SNAPSHOT_KEY));
    } catch {
      return false;
    }
  });

  // Production / Shredding batch creation states (for Phân loại & Băm nhựa tab)
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchDate, setBatchDate] = useState(TODAY_STR);
  const [batchShift, setBatchShift] = useState('Ca sáng (06:30 - 14:30)');
  const [batchWorker, setBatchWorker] = useState('Nguyễn Văn Hùng');
  const [batchMachine, setBatchMachine] = useState(
    'Dây chuyền Băm #1 (Công suất lớn 800kg/h)'
  );
  const [batchPlasticType, setBatchPlasticType] = useState('HDPE');
  const [batchInputKg, setBatchInputKg] = useState('2500');
  const [batchOutputKg, setBatchOutputKg] = useState('2360');
  const [batchScrapKg, setBatchScrapKg] = useState('80');
  const [batchNotes, setBatchNotes] = useState(
    'Phân loại tách tạp chất, băm mảnh 12mm và rửa nổi sạch'
  );

  // Inventory filter & movement states (for Kho nhựa tab)
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<
    'all' | PlasticInventoryCategory
  >('all');
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [invMoveType, setInvMoveType] = useState<'in' | 'out'>('in');
  const [invTargetId, setInvTargetId] = useState('inv-01');
  const [invMoveKg, setInvMoveKg] = useState('500');
  const [invMoveNote, setInvMoveNote] = useState(
    'Cập nhật nhập/xuất kho nhựa thực tế trong ca'
  );

  const [employees, setEmployees] = useState<EmployeeProfile[]>(() => {
    try {
      const raw = window.localStorage.getItem(DEMO_EMP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage error
    }
    return DEMO_EMPLOYEES;
  });

  const [shifts, setShifts] = useState<ShiftDefinition[]>(() => {
    try {
      const raw = window.localStorage.getItem(DEMO_SHIFTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage error
    }
    return DEMO_SHIFTS;
  });

  // Sync DEMO transactions, activity logs, attendance, employees, shifts, plasticTypes, machines, inventory to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEMO_TX_STORAGE_KEY,
        JSON.stringify(demoTransactions)
      );
    } catch {
      // Ignore storage error
    }
  }, [demoTransactions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEMO_LOGS_STORAGE_KEY,
        JSON.stringify(demoActivityLogs)
      );
    } catch {
      // Ignore storage error
    }
  }, [demoActivityLogs]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEMO_ATT_STORAGE_KEY,
        JSON.stringify(demoAttendance)
      );
    } catch {
      // Ignore storage error
    }
  }, [demoAttendance]);

  const handleAttendanceTrace = (trace: AttendanceAttemptTrace) => {
    setAttendanceAttemptTraces((previous) => {
      const next = [trace, ...previous.filter((item) => item.id !== trace.id)].slice(0, 200);
      try {
        window.localStorage.setItem(ATTENDANCE_TRACE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Trạng thái vẫn được giữ trong bộ nhớ phiên nếu localStorage đầy hoặc bị chặn.
      }
      return next;
    });
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEMO_EMP_STORAGE_KEY,
        JSON.stringify(employees)
      );
    } catch {
      // Ignore storage error
    }
  }, [employees]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEMO_SHIFTS_STORAGE_KEY,
        JSON.stringify(shifts)
      );
    } catch {
      // Ignore storage error
    }
  }, [shifts]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEMO_PLASTIC_TYPES_KEY,
        JSON.stringify(plasticTypes)
      );
    } catch {
      // Ignore storage error
    }
  }, [plasticTypes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEMO_MACHINES_KEY, JSON.stringify(machines));
    } catch {
      // Ignore storage error
    }
  }, [machines]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEMO_INVENTORY_KEY,
        JSON.stringify(inventoryItems)
      );
    } catch {
      // Ignore storage error
    }
  }, [inventoryItems]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DEMO_TICKETS_STORAGE_KEY,
        JSON.stringify(demoTickets)
      );
    } catch {
      // Ignore storage error
    }
  }, [demoTickets]);

  // PRODUCTION state (loaded exclusively from Firestore when authenticated)
  const [prodTransactions, setProdTransactions] = useState<CashTransaction[]>(
    []
  );
  const [prodAttendance, setProdAttendance] = useState<AttendanceRecord[]>([]);
  const [prodTickets, setProdTickets] = useState<WeighTicket[]>([]);
  const [prodActivityLogs, setProdActivityLogs] = useState<ActivityLogRecord[]>(
    []
  );

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<'all' | AccountType>(
    'all'
  );
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'income' | 'expense' | 'transfer'
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

  // Selected Transaction for Detail / Edit / Cancel / Restore Modal
  const [selectedTx, setSelectedTx] = useState<CashTransaction | null>(null);
  const [selectedTxMode, setSelectedTxMode] = useState<
    'view' | 'edit' | 'confirm_cancel' | 'confirm_restore'
  >('view');

  // Face Enrollment Modal State
  const [enrollingEmp, setEnrollingEmp] = useState<EmployeeProfile | null>(
    null
  );
  const [enrollConsent, setEnrollConsent] = useState(false);
  const [enrollStep, setEnrollStep] = useState<0 | 1 | 2 | 3>(0);
  const [enrollCameraError, setEnrollCameraError] = useState('');
  const [enrollHasLiveVideo, setEnrollHasLiveVideo] = useState(false);
  const enrollVideoRef = useRef<HTMLVideoElement | null>(null);
  const enrollStreamRef = useRef<MediaStream | null>(null);

  // Copy SQL feedback
  const [copiedSql, setCopiedSql] = useState(false);

  // Sync Dark Mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings.darkMode]);

  // Production access fails closed. Bootstrap administrators can create/recover their
  // own owner profile; every other account must be provisioned by an administrator first.
  useEffect(() => {
    let active = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setAuthReady(false);
      if (!user) {
        setFirebaseUser(null);
        setAuthReady(true);
        return;
      }
      const userRef = doc(db, 'users', user.uid);
      let profileRole: UserRole = 'worker';
      let department = 'Chưa phân bộ phận';
      let displayName = user.displayName || user.email || 'Nhân viên';
      try {
        const existing = await getDoc(userRef);
        const existingRecord = existing.exists() ? existing.data() : null;
        const hasProvisionedProfile = Boolean(
          existingRecord &&
          existingRecord.accessStatus === 'active' &&
          normalizeAccountEmail(existingRecord.email) === normalizeAccountEmail(user.email),
        );
        const access = evaluateAccountAccess(user.email, hasProvisionedProfile);

        if (!access.allowed) {
          const email = (user.email || 'không có email').slice(0, 160);
          try {
            await setDoc(doc(db, 'security_events', user.uid), {
              uid: user.uid,
              email,
              type: 'unknown_account',
              severity: 'critical',
              message: `Tài khoản chưa được cấp quyền đã thử đăng nhập: ${email}`.slice(0, 300),
              userAgent: typeof navigator === 'undefined'
                ? 'unknown'
                : navigator.userAgent.slice(0, 300),
              createdAt: serverTimestamp(),
            });
          } catch {
            // The account is still blocked even when the alert endpoint is unavailable.
          }
          await signOut(auth).catch(() => undefined);
          if (active) {
            setFirebaseUser(null);
            setAuthReady(true);
            setAuthError(
              `CẢNH BÁO BẢO MẬT: ${email} chưa được cấp quyền. Hệ thống đã từ chối đăng nhập và ghi dấu vết.`,
            );
          }
          return;
        }

        if (existing.exists()) {
          const record = existing.data();
          const grantedRole = record.role;
          if (typeof grantedRole === 'string' && grantedRole in ROLE_LABELS) {
            profileRole = grantedRole as UserRole;
          }
          if (typeof record.department === 'string') department = record.department;
          if (typeof record.displayName === 'string') displayName = record.displayName;

          if (access.forceOwnerRole && profileRole !== 'owner') {
            profileRole = 'owner';
            department = 'Ban Giám Đốc – Dư-Nhựa phế liệu';
            await setDoc(userRef, {
              uid: user.uid,
              displayName,
              role: 'owner',
              department,
              email: normalizeAccountEmail(user.email),
              accessStatus: 'active',
              createdAt: record.createdAt,
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          profileRole = 'owner';
          department = 'Ban Giám Đốc – Dư-Nhựa phế liệu';
          await setDoc(userRef, {
            uid: user.uid,
            displayName,
            role: 'owner',
            department,
            email: normalizeAccountEmail(user.email),
            accessStatus: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        if (active) {
          setFirebaseUser(user);
          setAuthReady(true);
          setAuthError('');
        }
      } catch (error) {
        await signOut(auth).catch(() => undefined);
        if (active) {
          setFirebaseUser(null);
          setAuthReady(true);
          setAuthError('Không xác minh được quyền tài khoản. Hệ thống đã đăng xuất để bảo vệ dữ liệu.');
        }
        if (import.meta.env.DEV) console.warn('Không tải được quyền Firestore', error);
        return;
      }
      if (active) {
        setUserProfile({
          uid: user.uid,
          displayName,
          email: user.email || '',
          role: profileRole,
          department,
          accessStatus: 'active',
          createdAt: TODAY_STR,
          updatedAt: TODAY_STR,
        });
      }
    });
    return () => { active = false; unsub(); };
  }, []);

  // Owners receive a live, append-only feed of rejected or suspicious access attempts.
  useEffect(() => {
    if (envMode !== 'production' || !firebaseUser || userProfile.role !== 'owner') {
      securityFeedReadyRef.current = false;
      seenSecurityAlertIdsRef.current = new Set();
      setSecurityAlerts([]);
      return;
    }

    const securityQuery = query(
      collection(db, 'security_events'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    return onSnapshot(
      securityQuery,
      (snapshot) => {
        const alerts: SecurityAlert[] = snapshot.docs.map((entry) => {
          const data = entry.data();
          return {
            id: entry.id,
            email: typeof data.email === 'string' ? data.email : 'không xác định',
            type: typeof data.type === 'string' ? data.type : 'security_event',
            severity: data.severity === 'medium' || data.severity === 'high'
              ? data.severity
              : 'critical',
            message: typeof data.message === 'string'
              ? data.message
              : 'Phát hiện sự kiện bảo mật cần kiểm tra.',
          };
        });
        setSecurityAlerts(alerts);

        if (!securityFeedReadyRef.current) {
          seenSecurityAlertIdsRef.current = new Set(alerts.map((alert) => alert.id));
          securityFeedReadyRef.current = true;
          return;
        }
        for (const alert of alerts) {
          if (!seenSecurityAlertIdsRef.current.has(alert.id)) {
            seenSecurityAlertIdsRef.current.add(alert.id);
            pushToast('Cảnh báo truy cập bất thường', alert.message, 'error');
          }
        }
      },
      () => {
        setAuthError('Không tải được nhật ký cảnh báo bảo mật. Vui lòng kiểm tra Firestore Rules.');
      },
    );
  }, [envMode, firebaseUser, userProfile.role]);

  // Reconcile the role whenever switching to Production, even if DEMO role was changed.
  useEffect(() => {
    if (envMode !== 'production' || !firebaseUser) return;
    let live = true;
    getDoc(doc(db, 'users', firebaseUser.uid))
      .then((snap) => {
        if (!live) return;
        const candidate = snap.exists() ? snap.data().role : undefined;
        const role: UserRole = typeof candidate === 'string' && candidate in ROLE_LABELS
          ? candidate as UserRole : 'worker';
        setUserProfile((profile) => ({ ...profile, role }));
      })
      .catch(() => {
        if (live) {
          setUserProfile((profile) => ({ ...profile, role: 'worker' }));
          setAuthError('Không tải được quyền Production từ Firestore.');
        }
      });
    return () => { live = false; };
  }, [envMode, firebaseUser]);

  // Attach Firestore listeners ONLY when in 'production' mode and user is signed in
  useEffect(() => {
    if (!authReady || !firebaseUser || envMode !== 'production') {
      return;
    }

    const txQuery = query(
      collection(db, 'cash_transactions'),
      where('ownerId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        const list: CashTransaction[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            code: data.code,
            type: data.type,
            amount: Number(data.amount) || 0,
            counterparty: data.counterparty,
            category: data.category,
            accountType: data.accountType,
            description: data.description,
            dateStr: data.dateStr,
            status: data.status,
            cancelReason: data.cancelReason,
            createdAt: TODAY_STR,
            updatedAt: TODAY_STR,
          };
        });
        setProdTransactions(list);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'cash_transactions')
    );

    const attQuery = query(
      collection(db, 'attendance_events'),
      where('ownerId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubAtt = onSnapshot(
      attQuery,
      (snap) => {
        const list: AttendanceRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            employeeCode: data.employeeCode,
            employeeName: data.employeeName,
            department: data.department,
            shiftName: data.shiftName,
            eventType: data.eventType,
            method: data.method,
            confidence: Number(data.confidence) || 100,
            approvalStatus: data.approvalStatus || 'approved',
            fallbackReason: data.fallbackReason,
            approvedBy: data.approvedBy,
            reviewReason: data.reviewReason,
            reviewedAt: data.reviewedAt,
            workDateStr:
              data.workDateStr || (data.dateStr ? data.dateStr.split(' ')[0] : TODAY_STR),
            isOvernight: Boolean(data.isOvernight),
            adjustedNote: data.adjustedNote,
            dateStr: data.dateStr ? data.dateStr.split(' ')[0] : TODAY_STR,
            timeStr: data.dateStr ? data.dateStr.split(' ')[1] || '07:00' : '07:00',
            createdAt: TODAY_STR,
          };
        });
        setProdAttendance(list);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'attendance_events')
    );

    const tkQuery = query(
      collection(db, 'weigh_tickets'),
      where('ownerId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubTk = onSnapshot(
      tkQuery,
      (snap) => {
        const list: WeighTicket[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            ticketCode: data.ticketCode,
            ticketType: data.ticketType,
            partnerName: data.partnerName,
            rubberType: data.rubberType,
            grossKg: Number(data.grossKg) || 0,
            tareKg: Number(data.tareKg) || 0,
            deductionKg: Number(data.deductionKg) || 0,
            netKg: Number(data.netKg) || 0,
            unitPrice: Number(data.unitPrice) || 0,
            totalAmount: Number(data.totalAmount) || 0,
            paidAmount: Number(data.paidAmount) || 0,
            debtAmount: Number(data.debtAmount) || 0,
            dateStr: data.dateStr,
            createdAt: TODAY_STR,
          };
        });
        setProdTickets(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'weigh_tickets')
    );

    const logQuery = query(
      collection(db, 'activity_logs'),
      where('ownerId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubLog = onSnapshot(
      logQuery,
      (snap) => {
        const list: ActivityLogRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            actorName: data.actorName,
            actorUid: data.actorUid,
            actorRole: (data.actorRole as UserRole) || 'owner',
            timestampStr: data.timestampStr,
            moduleName: (data.moduleName as ActivityModuleType) || 'Thu – Chi',
            actionType: data.actionType,
            targetCode: data.targetCode,
            previousValue: data.previousValue,
            newValue: data.newValue,
            reason: data.reason,
            resultStatus: data.resultStatus || 'Thành công',
            createdAt: TODAY_STR,
          };
        });
        setProdActivityLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'activity_logs')
    );

    return () => {
      unsubTx();
      unsubAtt();
      unsubTk();
      unsubLog();
    };
  }, [authReady, firebaseUser, envMode]);

  // Select active datasets based on environment mode (strictly no mixing!)
  const activeTransactions =
    envMode === 'demo' ? demoTransactions : prodTransactions;
  const activeAttendance =
    envMode === 'demo' ? demoAttendance : prodAttendance;
  const activeTickets = envMode === 'demo' ? demoTickets : prodTickets;
  const activeActivityLogs =
    envMode === 'demo' ? demoActivityLogs : prodActivityLogs;

  const activeSettings: AppSettings = useMemo(() => {
    if (envMode === 'production') {
      return {
        ...settings,
        openingCashBalance: 0,
        openingBankBalance: 0,
        openingRawRubberKg: 0,
        openingShreddedRubberKg: 0,
      };
    }
    return settings;
  }, [envMode, settings]);

  // Dynamically calculate Dashboard KPIs
  const metrics = useMemo(
    () =>
      calculateDashboardMetrics(
        activeTransactions,
        activeAttendance,
        activeTickets,
        activeSettings,
        TODAY_STR
      ),
    [activeTransactions, activeAttendance, activeTickets, activeSettings]
  );

  // Filtered transactions for Sổ Thu Chi
  const filteredTransactions = useMemo(() => {
    return activeTransactions.filter((tx) => {
      if (accountFilter !== 'all' && tx.accountType !== accountFilter) {
        return false;
      }
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = tx.code.toLowerCase().includes(q);
        const matchCounterparty = tx.counterparty.toLowerCase().includes(q);
        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        if (!matchCode && !matchCounterparty && !matchDesc && !matchCat) {
          return false;
        }
      }
      return true;
    });
  }, [
    activeTransactions,
    accountFilter,
    typeFilter,
    categoryFilter,
    searchQuery,
  ]);

  const getServerTimestampDisplay = () => {
    return formatServerTimeHCM(new Date()).fullTimestampStr;
  };

  const handlePermissionDenied = (actionLabel: string) => {
    pushToast(
      'Không đủ quyền thực hiện',
      `Vai trò ${ROLE_LABELS[userProfile.role].name} không được phép thực hiện thao tác: ${actionLabel}.`,
      'warning'
    );
  };

  // Module hooks: all callbacks below are explicitly DEMO-only and separated from Firebase.
  const recordDemoModuleLog = (action: string, targetCode: string, summary: string) => {
    if (envMode !== 'demo') return;
    const now = new Date().toISOString();
    setDemoActivityLogs(prev => [{
      id: `demo-module-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      ownerId:'demo-owner', actorName:userProfile.displayName, actorUid:userProfile.uid,
      actorRole:userProfile.role, timestampStr:formatServerTimeHCM(new Date()).fullTimestampStr,
      moduleName: action.includes('lương') || action.includes('nhân sự') || action.includes('hồ sơ') ? 'Nhân sự' : action.includes('bảo trì') ? 'Phân loại & Băm nhựa' : 'Hệ thống',
      actionType:action, targetCode, previousValue:'—', newValue:summary, reason:'Kiểm thử DEMO',
      resultStatus:'Thành công (DEMO)',createdAt:now
    },...prev]);
  };
  const recordDemoPayrollExpense = (payment: {
    id:string; employeeCode:string;employeeName:string;amount:number;account:'cash'|'bank';month:string;
  }): boolean => {
    if (envMode !== 'demo' || userProfile.role !== 'owner' ||
        !Number.isSafeInteger(payment.amount) || payment.amount <= 0 ||
        demoTransactions.some(tx=>tx.code===payment.id)) return false;
    const now=new Date().toISOString();
    const tx:CashTransaction={
      id:payment.id,ownerId:'demo-owner',code:payment.id,type:'expense',
      amount:payment.amount,counterparty:payment.employeeName,category:'Chi trả lương & phụ cấp',
      accountType:payment.account,description:`Thanh toán lương DEMO kỳ ${payment.month} cho ${payment.employeeCode}`,
      dateStr:formatServerTimeHCM(new Date()).fullTimestampStr,status:'active',createdAt:now,updatedAt:now
    };
    setDemoTransactions(prev=>prev.some(x=>x.code===payment.id)?prev:[tx,...prev]);
    recordDemoModuleLog('Chi lương DEMO',payment.id,`${payment.employeeName}: ${formatCurrencyVND(payment.amount)}`);
    pushToast('Đã tạo phiếu chi DEMO',`${payment.employeeName} • ${formatCurrencyVND(payment.amount)}`,'success');
    return true;
  };

  // Handlers for saving data in Demo vs Production
  const handleSaveTransaction = async (
    newTx: Omit<CashTransaction, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      pushToast(
        'Không thể lưu do mất kết nối',
        'Vui lòng kiểm tra kết nối mạng trước khi thực hiện giao dịch.',
        'error'
      );
      throw new Error('Không thể lưu do mất kết nối mạng.');
    }

    if (!canManageCashFlow(userProfile.role)) {
      handlePermissionDenied('Thêm giao dịch thu chi');
      throw new Error('Không đủ quyền thực hiện thao tác thu chi.');
    }

    const actionLabel =
      newTx.type === 'income'
        ? 'Thêm khoản thu'
        : newTx.type === 'expense'
          ? 'Thêm khoản chi'
          : 'Thêm chuyển quỹ';
    const accountLabel =
      newTx.accountType === 'cash' ? 'Quỹ Tiền Mặt' : 'Ngân Hàng';
    const signPrefix =
      newTx.type === 'income' ? '+' : newTx.type === 'expense' ? '-' : '';
    const formattedAmount = `${signPrefix}${formatCurrencyVND(newTx.amount)}`;
    const tsStr = getServerTimestampDisplay();

    if (envMode === 'demo') {
      const created: CashTransaction = {
        ...newTx,
        id: `demo-tx-${Date.now()}`,
        ownerId: 'demo-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const logEntry: ActivityLogRecord = {
        id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        timestampStr: tsStr,
        moduleName: 'Thu – Chi',
        actionType: actionLabel,
        targetCode: created.code,
        previousValue: '0 ₫ (Chưa có giao dịch)',
        newValue: `${formattedAmount} · ${accountLabel} · ${created.counterparty}`,
        reason: created.description,
        resultStatus: 'Thành công',
        createdAt: new Date().toISOString(),
      };
      setDemoTransactions((prev) => [created, ...prev]);
      setDemoActivityLogs((prev) => [logEntry, ...prev]);

      pushToast(
        'Thêm giao dịch thành công',
        `Đã ghi nhận ${created.code} (${formattedAmount}) vào ${accountLabel}.`,
        'success'
      );
      return;
    }

    if (!firebaseUser) {
      pushToast(
        'Chưa đăng nhập hệ thống thật',
        'Vui lòng đăng nhập tài khoản Google để ghi dữ liệu vào hệ thống thật (Production).',
        'error'
      );
      throw new Error(
        'Vui lòng đăng nhập tài khoản Google để ghi dữ liệu vào hệ thống thật (Production).'
      );
    }

    const path = 'cash_transactions';
    try {
      const batch = writeBatch(db);
      const txRef = doc(collection(db, 'cash_transactions'));
      const logRef = doc(collection(db, 'activity_logs'));

      batch.set(txRef, {
        ownerId: firebaseUser.uid,
        code: newTx.code.slice(0, 32),
        type: newTx.type,
        amount: Math.round(newTx.amount),
        counterparty: newTx.counterparty.slice(0, 120),
        category: newTx.category.slice(0, 80),
        accountType: newTx.accountType,
        description: newTx.description.slice(0, 300),
        dateStr: newTx.dateStr.slice(0, 25),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(logRef, {
        ownerId: firebaseUser.uid,
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`.slice(
          0,
          120
        ),
        actorUid: firebaseUser.uid.slice(0, 128),
        actorRole: userProfile.role,
        timestampStr: tsStr.slice(0, 30),
        moduleName: 'Thu – Chi',
        actionType: actionLabel.slice(0, 80),
        targetCode: newTx.code.slice(0, 40),
        previousValue: '0 ₫ (Chưa có giao dịch)',
        newValue: `${formattedAmount} · ${accountLabel} · ${newTx.counterparty}`.slice(
          0,
          300
        ),
        reason: newTx.description.slice(0, 200),
        resultStatus: 'Thành công',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      pushToast(
        'Thêm giao dịch thành công',
        `Máy chủ đã xác nhận lưu ${newTx.code} (${formattedAmount}).`,
        'success'
      );
    } catch (err) {
      pushToast(
        'Không thể lưu giao dịch',
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
        'error'
      );
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleUpdateTransaction = async (
    tx: CashTransaction,
    updates: TransactionUpdatePayload
  ) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      pushToast(
        'Không thể lưu do mất kết nối',
        'Vui lòng kiểm tra kết nối mạng trước khi cập nhật giao dịch.',
        'error'
      );
      throw new Error('Không thể lưu do mất kết nối mạng.');
    }

    if (!canManageCashFlow(userProfile.role)) {
      handlePermissionDenied('Cập nhật giao dịch thu chi');
      throw new Error('Không đủ quyền thực hiện cập nhật giao dịch.');
    }

    const oldAccountLabel =
      tx.accountType === 'cash' ? 'Quỹ Tiền Mặt' : 'Ngân Hàng';
    const newAccountLabel =
      updates.accountType === 'cash' ? 'Quỹ Tiền Mặt' : 'Ngân Hàng';
    const signPrefix =
      tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '';
    const prevSummary = `${signPrefix}${formatCurrencyVND(tx.amount)} · ${oldAccountLabel} · ${tx.counterparty}`;
    const newSummary = `${signPrefix}${formatCurrencyVND(updates.amount)} · ${newAccountLabel} · ${updates.counterparty}`;
    const actionLabel =
      tx.type === 'income'
        ? 'Sửa khoản thu'
        : tx.type === 'expense'
          ? 'Sửa khoản chi'
          : 'Sửa chuyển quỹ';
    const toastTitle =
      tx.type === 'income'
        ? 'Đã cập nhật khoản thu'
        : tx.type === 'expense'
          ? 'Đã cập nhật khoản chi'
          : 'Đã cập nhật phiếu chuyển quỹ';
    const tsStr = getServerTimestampDisplay();

    if (envMode === 'demo') {
      setDemoTransactions((prev) =>
        prev.map((item) =>
          item.id === tx.id
            ? {
                ...item,
                amount: Math.round(updates.amount),
                counterparty: updates.counterparty,
                category: updates.category,
                accountType: updates.accountType,
                description: updates.description,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      const logEntry: ActivityLogRecord = {
        id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        timestampStr: tsStr,
        moduleName: 'Thu – Chi',
        actionType: actionLabel,
        targetCode: tx.code,
        previousValue: prevSummary,
        newValue: newSummary,
        reason: updates.reason,
        resultStatus: 'Thành công',
        createdAt: new Date().toISOString(),
      };
      setDemoActivityLogs((prev) => [logEntry, ...prev]);

      pushToast(
        toastTitle,
        `Mã ${tx.code}: ${formatCurrencyVND(tx.amount)} → ${formatCurrencyVND(updates.amount)} (Đã tự động tính lại số dư).`,
        'success'
      );
      return;
    }

    if (!firebaseUser) {
      throw new Error('Vui lòng đăng nhập để cập nhật giao dịch.');
    }

    const path = `cash_transactions/${tx.id}`;
    try {
      const batch = writeBatch(db);
      const txRef = doc(db, 'cash_transactions', tx.id);
      const logRef = doc(collection(db, 'activity_logs'));

      batch.update(txRef, {
        amount: Math.round(updates.amount),
        counterparty: updates.counterparty.slice(0, 120),
        category: updates.category.slice(0, 80),
        accountType: updates.accountType,
        description: updates.description.slice(0, 300),
        updatedAt: serverTimestamp(),
      });

      batch.set(logRef, {
        ownerId: firebaseUser.uid,
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`.slice(
          0,
          120
        ),
        actorUid: firebaseUser.uid.slice(0, 128),
        actorRole: userProfile.role,
        timestampStr: tsStr.slice(0, 30),
        moduleName: 'Thu – Chi',
        actionType: actionLabel.slice(0, 80),
        targetCode: tx.code.slice(0, 40),
        previousValue: prevSummary.slice(0, 300),
        newValue: newSummary.slice(0, 300),
        reason: updates.reason.slice(0, 200),
        resultStatus: 'Thành công',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      pushToast(
        toastTitle,
        `Máy chủ đã cập nhật ${tx.code}: ${formatCurrencyVND(tx.amount)} → ${formatCurrencyVND(updates.amount)}.`,
        'success'
      );
    } catch (err) {
      pushToast(
        'Không thể cập nhật giao dịch',
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
        'error'
      );
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleCancelTransactionByObj = async (
    tx: CashTransaction,
    reason: string
  ) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      pushToast(
        'Không thể lưu do mất kết nối',
        'Vui lòng kiểm tra kết nối mạng trước khi hủy giao dịch.',
        'error'
      );
      throw new Error('Không thể lưu do mất kết nối mạng.');
    }

    if (!canManageCashFlow(userProfile.role)) {
      handlePermissionDenied('Hủy giao dịch thu chi');
      throw new Error('Không đủ quyền hủy giao dịch.');
    }

    const accountLabel =
      tx.accountType === 'cash' ? 'Quỹ Tiền Mặt' : 'Ngân Hàng';
    const signPrefix =
      tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '';
    const prevSummary = `${signPrefix}${formatCurrencyVND(tx.amount)} (Đang hiệu lực · ${accountLabel})`;
    const newSummary = `0 ₫ (Đã hủy giao dịch · Hoàn trả số dư ${accountLabel})`;
    const tsStr = getServerTimestampDisplay();

    if (envMode === 'demo') {
      setDemoTransactions((prev) =>
        prev.map((item) =>
          item.id === tx.id
            ? {
                ...item,
                status: 'cancelled',
                cancelReason: reason,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      const logEntry: ActivityLogRecord = {
        id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        timestampStr: tsStr,
        moduleName: 'Thu – Chi',
        actionType: 'Hủy giao dịch',
        targetCode: tx.code,
        previousValue: prevSummary,
        newValue: newSummary,
        reason,
        resultStatus: 'Thành công',
        createdAt: new Date().toISOString(),
      };
      setDemoActivityLogs((prev) => [logEntry, ...prev]);

      pushToast(
        'Đã hủy giao dịch',
        `Phiếu ${tx.code} (${formatCurrencyVND(tx.amount)}) đã hủy và hoàn lại số dư ${accountLabel}.`,
        'success'
      );
      return;
    }

    if (!firebaseUser) {
      throw new Error('Vui lòng đăng nhập để hủy giao dịch.');
    }

    const path = `cash_transactions/${tx.id}`;
    try {
      const batch = writeBatch(db);
      const txRef = doc(db, 'cash_transactions', tx.id);
      const logRef = doc(collection(db, 'activity_logs'));

      batch.update(txRef, {
        status: 'cancelled',
        cancelReason: reason.slice(0, 200),
        updatedAt: serverTimestamp(),
      });

      batch.set(logRef, {
        ownerId: firebaseUser.uid,
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`.slice(
          0,
          120
        ),
        actorUid: firebaseUser.uid.slice(0, 128),
        actorRole: userProfile.role,
        timestampStr: tsStr.slice(0, 30),
        moduleName: 'Thu – Chi',
        actionType: 'Hủy giao dịch',
        targetCode: tx.code.slice(0, 40),
        previousValue: prevSummary.slice(0, 300),
        newValue: newSummary.slice(0, 300),
        reason: reason.slice(0, 200),
        resultStatus: 'Thành công',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      pushToast(
        'Đã hủy giao dịch',
        `Máy chủ đã xác nhận hủy phiếu ${tx.code} (${formatCurrencyVND(tx.amount)}).`,
        'success'
      );
    } catch (err) {
      pushToast(
        'Không thể hủy giao dịch',
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
        'error'
      );
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleRestoreTransactionByObj = async (
    tx: CashTransaction,
    reason: string
  ) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      pushToast(
        'Không thể lưu do mất kết nối',
        'Vui lòng kiểm tra kết nối mạng trước khi khôi phục giao dịch.',
        'error'
      );
      throw new Error('Không thể lưu do mất kết nối mạng.');
    }

    if (!canRestoreTransaction(userProfile.role)) {
      handlePermissionDenied(
        'Khôi phục giao dịch đã hủy (Chỉ Chủ xưởng và Quản lý được phép)'
      );
      throw new Error('Không đủ quyền khôi phục giao dịch.');
    }

    const accountLabel =
      tx.accountType === 'cash' ? 'Quỹ Tiền Mặt' : 'Ngân Hàng';
    const signPrefix =
      tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '';
    const prevSummary = `0 ₫ (Đã hủy: ${tx.cancelReason || 'Không rõ'})`;
    const newSummary = `${signPrefix}${formatCurrencyVND(tx.amount)} (Khôi phục hiệu lực · ${accountLabel})`;
    const tsStr = getServerTimestampDisplay();

    if (envMode === 'demo') {
      setDemoTransactions((prev) =>
        prev.map((item) =>
          item.id === tx.id
            ? {
                ...item,
                status: 'active',
                cancelReason: undefined,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      const logEntry: ActivityLogRecord = {
        id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        timestampStr: tsStr,
        moduleName: 'Thu – Chi',
        actionType: 'Khôi phục giao dịch',
        targetCode: tx.code,
        previousValue: prevSummary,
        newValue: newSummary,
        reason,
        resultStatus: 'Thành công',
        createdAt: new Date().toISOString(),
      };
      setDemoActivityLogs((prev) => [logEntry, ...prev]);

      pushToast(
        'Đã khôi phục giao dịch',
        `Phiếu ${tx.code} (${formatCurrencyVND(tx.amount)}) đã có hiệu lực trở lại.`,
        'success'
      );
      return;
    }

    if (!firebaseUser) {
      throw new Error('Vui lòng đăng nhập để khôi phục giao dịch.');
    }

    const path = `cash_transactions/${tx.id}`;
    try {
      const batch = writeBatch(db);
      const txRef = doc(db, 'cash_transactions', tx.id);
      const logRef = doc(collection(db, 'activity_logs'));

      batch.update(txRef, {
        status: 'active',
        cancelReason: '',
        updatedAt: serverTimestamp(),
      });

      batch.set(logRef, {
        ownerId: firebaseUser.uid,
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`.slice(
          0,
          120
        ),
        actorUid: firebaseUser.uid.slice(0, 128),
        actorRole: userProfile.role,
        timestampStr: tsStr.slice(0, 30),
        moduleName: 'Thu – Chi',
        actionType: 'Khôi phục giao dịch',
        targetCode: tx.code.slice(0, 40),
        previousValue: prevSummary.slice(0, 300),
        newValue: newSummary.slice(0, 300),
        reason: reason.slice(0, 200),
        resultStatus: 'Thành công',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      pushToast(
        'Đã khôi phục giao dịch',
        `Máy chủ đã khôi phục phiếu ${tx.code} (${formatCurrencyVND(tx.amount)}).`,
        'success'
      );
    } catch (err) {
      pushToast(
        'Không thể khôi phục giao dịch',
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
        'error'
      );
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleSaveAttendance = async (
    newAtt: Omit<AttendanceRecord, 'id' | 'ownerId' | 'createdAt'>
  ) => {
    if (envMode === 'production') {
      // The registry is still local DEMO data, and the face verifier is simulated.
      // Prevent attributing official hours to an unverified employee identity.
      pushToast('Chưa thể chấm công Production', 'Cần đồng bộ hồ sơ nhân viên, ca làm và xác thực danh tính với Firestore trước khi ghi công thật.', 'warning');
      throw new Error('Chấm công Production bị khóa an toàn cho đến khi tích hợp hồ sơ nhân viên thật.');
    }
    const tsStr = getServerTimestampDisplay();
    const isFallback = newAtt.method === 'fallback_manual';
    const eventLabel =
      newAtt.eventType === 'check_in'
        ? 'VÀO CA'
        : newAtt.eventType === 'check_out'
          ? 'RA CA'
          : newAtt.eventType === 'leave'
            ? 'NGHỈ PHÉP'
            : 'NGHỈ GIỮA CA';
    const actionLabel = isFallback
      ? `Gửi yêu cầu chấm công dự phòng (${eventLabel})`
      : `Chấm công khuôn mặt ${eventLabel}`;

    if (envMode === 'demo') {
      const created: AttendanceRecord = {
        ...newAtt,
        approvalStatus:
          newAtt.approvalStatus ||
          (isFallback ? 'pending_approval' : 'approved'),
        id: `demo-att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        createdAt: new Date().toISOString(),
      };
      const logEntry: ActivityLogRecord = {
        id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        timestampStr: tsStr,
        moduleName: 'Chấm công',
        actionType: actionLabel,
        targetCode: created.employeeCode,
        previousValue: `Ca: ${created.shiftName}`,
        newValue: isFallback
          ? `${eventLabel} lúc ${created.timeStr} (${created.dateStr}) · Trạng thái: Chờ duyệt`
          : `${eventLabel} lúc ${created.timeStr} (${created.dateStr}) · Khớp 1:1 (${created.confidence}%)`,
        reason:
          created.fallbackReason ||
          `Xác minh khuôn mặt 1:1 thành công (${created.shiftName})`,
        resultStatus: 'Thành công',
        createdAt: new Date().toISOString(),
      };
      setDemoAttendance((prev) => [created, ...prev]);
      setDemoActivityLogs((prev) => [logEntry, ...prev]);

      pushToast(
        isFallback
          ? 'Đã gửi yêu cầu chấm công dự phòng (Chờ duyệt)'
          : `Chấm công ${eventLabel} thành công`,
        isFallback
          ? `${created.employeeName} (${created.employeeCode}) – Yêu cầu đang chờ Quản lý phê duyệt.`
          : `${created.employeeName} (${created.employeeCode}) lúc ${created.timeStr} (${created.dateStr}).`,
        isFallback ? 'info' : 'success'
      );
      return;
    }

    if (!firebaseUser) {
      throw new Error(
        'Vui lòng đăng nhập trước khi chấm công trên dữ liệu thật.'
      );
    }

    const path = 'attendance_events';
    try {
      const batch = writeBatch(db);
      const attRef = doc(collection(db, path));
      const logRef = doc(collection(db, 'activity_logs'));

      const payload: Record<string, unknown> = {
        ownerId: firebaseUser.uid,
        employeeCode: newAtt.employeeCode.slice(0, 32),
        employeeName: newAtt.employeeName.slice(0, 100),
        department: newAtt.department.slice(0, 80),
        shiftName: newAtt.shiftName.slice(0, 60),
        eventType: newAtt.eventType,
        method: newAtt.method,
        confidence: newAtt.confidence,
        approvalStatus:
          newAtt.approvalStatus ||
          (isFallback ? 'pending_approval' : 'approved'),
        workDateStr: (newAtt.workDateStr || newAtt.dateStr).slice(0, 15),
        isOvernight: Boolean(newAtt.isOvernight),
        dateStr: `${newAtt.dateStr} ${newAtt.timeStr}`.slice(0, 25),
        createdAt: serverTimestamp(),
      };
      if (newAtt.fallbackReason) {
        payload.fallbackReason = newAtt.fallbackReason.slice(0, 200);
      }
      if (newAtt.approvedBy) {
        payload.approvedBy = newAtt.approvedBy.slice(0, 100);
      }

      batch.set(attRef, payload);
      batch.set(logRef, {
        ownerId: firebaseUser.uid,
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`.slice(
          0,
          120
        ),
        actorUid: firebaseUser.uid.slice(0, 128),
        actorRole: userProfile.role,
        timestampStr: tsStr.slice(0, 30),
        moduleName: 'Chấm công',
        actionType: actionLabel.slice(0, 80),
        targetCode: newAtt.employeeCode.slice(0, 40),
        previousValue: `Ca: ${newAtt.shiftName}`.slice(0, 300),
        newValue: `${eventLabel} lúc ${newAtt.timeStr} (${newAtt.dateStr})`.slice(
          0,
          300
        ),
        reason: (
          newAtt.fallbackReason || 'Xác minh khuôn mặt 1:1 thành công'
        ).slice(0, 200),
        resultStatus: 'Thành công',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      pushToast(
        isFallback
          ? 'Đã gửi yêu cầu chấm công dự phòng'
          : `Chấm công ${eventLabel} thành công`,
        `${newAtt.employeeName} (${newAtt.employeeCode}) lúc ${newAtt.timeStr}.`,
        isFallback ? 'info' : 'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      throw err instanceof Error
        ? err
        : new Error('Máy chủ chưa xác nhận lưu chấm công. Dấu vết đã được giữ để truy lại.');
    }
  };

  const handleReviewFallbackRequest = async (
    record: AttendanceRecord,
    decision: 'approved' | 'rejected',
    reviewReason: string
  ) => {
    if (!canApproveFallbackAttendance(userProfile.role)) {
      handlePermissionDenied('Duyệt hoặc từ chối yêu cầu chấm công dự phòng');
      return;
    }

    const tsStr = getServerTimestampDisplay();
    const actionLabel =
      decision === 'approved'
        ? 'Duyệt chấm công dự phòng'
        : 'Từ chối chấm công dự phòng';

    if (envMode === 'demo') {
      setDemoAttendance((prev) =>
        prev.map((item) =>
          item.id === record.id
            ? {
                ...item,
                approvalStatus: decision,
                reviewReason,
                reviewedAt: tsStr,
                approvedBy: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
              }
            : item
        )
      );

      const logEntry: ActivityLogRecord = {
        id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        timestampStr: tsStr,
        moduleName: 'Chấm công',
        actionType: actionLabel,
        targetCode: record.employeeCode,
        previousValue: `Chờ duyệt (${record.eventType === 'check_in' ? 'VÀO CA' : 'RA CA'} ${record.timeStr} · ${record.dateStr})`,
        newValue:
          decision === 'approved'
            ? `Đã duyệt hợp lệ (${record.eventType === 'check_in' ? 'VÀO CA' : 'RA CA'} ${record.timeStr})`
            : `Đã từ chối (${record.timeStr})`,
        reason: reviewReason,
        resultStatus: 'Thành công',
        createdAt: new Date().toISOString(),
      };
      setDemoActivityLogs((prev) => [logEntry, ...prev]);

      pushToast(
        decision === 'approved'
          ? 'Đã phê duyệt chấm công dự phòng'
          : 'Đã từ chối chấm công dự phòng',
        `${record.employeeName} (${record.employeeCode}) – Lý do: ${reviewReason}`,
        decision === 'approved' ? 'success' : 'warning'
      );
      return;
    }

    if (!firebaseUser) return;
    try {
      const batch = writeBatch(db);
      const attRef = doc(db, 'attendance_events', record.id);
      const logRef = doc(collection(db, 'activity_logs'));

      batch.update(attRef, {
        approvalStatus: decision,
        reviewReason: reviewReason.slice(0, 200),
        reviewedAt: tsStr.slice(0, 30),
        approvedBy: `${userProfile.displayName}`.slice(0, 100),
      });

      batch.set(logRef, {
        ownerId: firebaseUser.uid,
        actorName: `${userProfile.displayName}`.slice(0, 120),
        actorUid: firebaseUser.uid.slice(0, 128),
        actorRole: userProfile.role,
        timestampStr: tsStr.slice(0, 30),
        moduleName: 'Chấm công',
        actionType: actionLabel,
        targetCode: record.employeeCode.slice(0, 40),
        previousValue: `Chờ duyệt (${record.timeStr})`.slice(0, 300),
        newValue:
          decision === 'approved'
            ? `Đã duyệt (${record.timeStr})`
            : `Đã từ chối (${record.timeStr})`,
        reason: reviewReason.slice(0, 200),
        resultStatus: 'Thành công',
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      pushToast(
        decision === 'approved'
          ? 'Đã duyệt chấm công dự phòng'
          : 'Đã từ chối chấm công dự phòng',
        `${record.employeeName} (${record.employeeCode})`,
        decision === 'approved' ? 'success' : 'warning'
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `attendance_events/${record.id}`
      );
    }
  };

  const handleAdjustAttendanceRow = async (
    row: DailyTimesheetRow,
    newCheckInTime: string,
    newCheckOutTime: string,
    reason: string
  ) => {
    if (!canEditAttendanceTime(userProfile.role)) {
      handlePermissionDenied('Điều chỉnh giờ công nhân viên');
      return;
    }

    const tsStr = getServerTimestampDisplay();
    const prevSummary = `Vào: ${row.checkInTime} · Ra: ${row.checkOutTime}`;
    const newSummary = `Vào: ${newCheckInTime} · Ra: ${newCheckOutTime}`;

    if (envMode === 'demo') {
      setDemoAttendance((prev) => {
        const updated = [...prev];
        if (row.checkInRecordId) {
          const idx = updated.findIndex((r) => r.id === row.checkInRecordId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              timeStr: newCheckInTime,
              adjustedNote: `Quản lý điều chỉnh giờ (${reason})`,
            };
          }
        }
        if (row.checkOutRecordId) {
          const idx = updated.findIndex((r) => r.id === row.checkOutRecordId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              timeStr: newCheckOutTime,
              adjustedNote: `Quản lý điều chỉnh giờ (${reason})`,
            };
          }
        } else if (newCheckOutTime && newCheckOutTime !== '—') {
          updated.unshift({
            id: `demo-att-adj-${Date.now()}`,
            ownerId: 'demo-user',
            employeeCode: row.employeeCode,
            employeeName: row.employeeName,
            department: row.department,
            shiftName: row.shiftName,
            eventType: 'check_out',
            method: 'fallback_manual',
            approvalStatus: 'approved',
            confidence: 100,
            workDateStr: row.workDateStr,
            isOvernight: row.isOvernightShift,
            adjustedNote: `Quản lý bổ sung giờ ra (${reason})`,
            dateStr: row.workDateStr,
            timeStr: newCheckOutTime,
            createdAt: new Date().toISOString(),
          });
        }
        return updated;
      });

      const logEntry: ActivityLogRecord = {
        id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        timestampStr: tsStr,
        moduleName: 'Chấm công',
        actionType: 'Sửa giờ chấm công',
        targetCode: `${row.employeeCode} (${row.workDateStr})`,
        previousValue: prevSummary,
        newValue: newSummary,
        reason,
        resultStatus: 'Thành công',
        createdAt: new Date().toISOString(),
      };
      setDemoActivityLogs((prev) => [logEntry, ...prev]);

      pushToast(
        'Đã điều chỉnh giờ chấm công',
        `${row.employeeName} (${row.workDateStr}): ${prevSummary} → ${newSummary}`,
        'success'
      );
    }
  };

  const handleSaveShiftConfig = (updatedShift: ShiftDefinition) => {
    if (envMode === 'production') {
      pushToast('Chưa đồng bộ ca làm', 'Không lưu ca làm vào localStorage ở Production. Chờ cấu hình Firestore an toàn.', 'warning');
      return;
    }
    if (!canEditAttendanceTime(userProfile.role)) {
      handlePermissionDenied('Cấu hình ca làm việc');
      return;
    }

    const tsStr = getServerTimestampDisplay();
    setShifts((prev) => {
      const exists = prev.some((s) => s.id === updatedShift.id);
      if (exists) {
        return prev.map((s) => (s.id === updatedShift.id ? updatedShift : s));
      }
      return [...prev, updatedShift];
    });

    const logEntry: ActivityLogRecord = {
      id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      ownerId: 'demo-user',
      actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      timestampStr: tsStr,
      moduleName: 'Chấm công',
      actionType: 'Cập nhật cấu hình ca',
      targetCode: updatedShift.id,
      previousValue: 'Cấu hình ca trước đó',
      newValue: `${updatedShift.name} (${updatedShift.startTime}-${updatedShift.endTime} · Chuẩn ${updatedShift.hoursCount}h)`,
      reason: 'Chủ xưởng / Quản lý cập nhật định mức giờ công ca làm việc',
      resultStatus: 'Thành công',
      createdAt: new Date().toISOString(),
    };
    setDemoActivityLogs((prev) => [logEntry, ...prev]);

    pushToast(
      'Đã lưu cấu hình ca làm việc',
      `${updatedShift.name} – Định mức: ${updatedShift.hoursCount} giờ/ca.`,
      'success'
    );
  };

  const handleSaveWeighTicket = async (
    newTk: Omit<WeighTicket, 'id' | 'ownerId' | 'createdAt'>,
    alsoCreateCashTx?: {
      type: 'income' | 'expense';
      amount: number;
      accountType: AccountType;
    }
  ) => {
    const tsStr = getServerTimestampDisplay();
    if (envMode === 'demo') {
      const created: WeighTicket = {
        ...newTk,
        id: `demo-tk-${Date.now()}`,
        ownerId: 'demo-user',
        createdAt: new Date().toISOString(),
      };
      setDemoTickets((prev) => [created, ...prev]);

      const logEntry: ActivityLogRecord = {
        id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        ownerId: 'demo-user',
        actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
        actorUid: userProfile.uid,
        actorRole: userProfile.role,
        timestampStr: tsStr,
        moduleName: 'Cân nhựa',
        actionType:
          newTk.ticketType === 'purchase_in'
            ? 'Lập phiếu cân nhập nhựa phế liệu'
            : 'Lập phiếu cân xuất nhựa đã băm',
        targetCode: created.ticketCode,
        previousValue: `Đối tác: ${created.partnerName}`,
        newValue: `${created.netKg.toLocaleString('vi-VN')} kg ${created.rubberType} · Thành tiền: ${formatCurrencyVND(created.totalAmount)}`,
        reason:
          created.notes ||
          `Cân xe ${created.vehiclePlate || 'N/A'} (${created.delivererName || created.partnerName})`,
        resultStatus: 'Thành công',
        createdAt: new Date().toISOString(),
      };
      setDemoActivityLogs((prev) => [logEntry, ...prev]);

      pushToast(
        newTk.ticketType === 'purchase_in'
          ? 'Đã lưu phiếu cân nhập nhựa phế liệu'
          : 'Đã lưu phiếu cân xuất nhựa băm',
        `Mã ${created.ticketCode}: ${created.netKg.toLocaleString('vi-VN')} kg ${created.rubberType} (${formatCurrencyVND(created.totalAmount)}).`,
        'success'
      );

      if (alsoCreateCashTx && alsoCreateCashTx.amount > 0) {
        await handleSaveTransaction({
          code:
            alsoCreateCashTx.type === 'expense'
              ? `PC-${newTk.ticketCode}`
              : `PT-${newTk.ticketCode}`,
          type: alsoCreateCashTx.type,
          amount: alsoCreateCashTx.amount,
          counterparty: newTk.partnerName,
          category:
            alsoCreateCashTx.type === 'expense'
              ? 'Chi mua nhựa phế liệu'
              : 'Thu tiền bán nhựa băm thành phẩm',
          accountType: alsoCreateCashTx.accountType,
          description: `Thanh toán tại phiếu cân nhựa ${newTk.ticketCode} (${newTk.netKg} kg ${newTk.rubberType})`,
          dateStr: newTk.dateStr,
          status: 'active',
        });
      }
      return;
    }

    if (!firebaseUser) {
      throw new Error(
        'Vui lòng đăng nhập để lưu phiếu cân nhựa vào cơ sở dữ liệu thật.'
      );
    }

    const path = 'weigh_tickets';
    try {
      await addDoc(collection(db, path), {
        ownerId: firebaseUser.uid,
        ticketCode: newTk.ticketCode.slice(0, 32),
        ticketType: newTk.ticketType,
        partnerName: newTk.partnerName.slice(0, 120),
        delivererName: (newTk.delivererName || '').slice(0, 120),
        vehiclePlate: (newTk.vehiclePlate || '').slice(0, 32),
        rubberType: newTk.rubberType.slice(0, 80),
        grossKg: newTk.grossKg,
        tareKg: newTk.tareKg,
        deductionKg: newTk.deductionKg,
        netKg: newTk.netKg,
        unitPrice: newTk.unitPrice,
        totalAmount: newTk.totalAmount,
        paidAmount: newTk.paidAmount,
        debtAmount: newTk.debtAmount,
        notes: (newTk.notes || '').slice(0, 300),
        photoUrl: (newTk.photoUrl || '').slice(0, 300),
        dateStr: newTk.dateStr.slice(0, 25),
        createdAt: serverTimestamp(),
      });

      if (alsoCreateCashTx && alsoCreateCashTx.amount > 0) {
        await handleSaveTransaction({
          code:
            alsoCreateCashTx.type === 'expense'
              ? `PC-${newTk.ticketCode}`
              : `PT-${newTk.ticketCode}`,
          type: alsoCreateCashTx.type,
          amount: alsoCreateCashTx.amount,
          counterparty: newTk.partnerName,
          category:
            alsoCreateCashTx.type === 'expense'
              ? 'Chi mua nhựa phế liệu'
              : 'Thu tiền bán nhựa băm thành phẩm',
          accountType: alsoCreateCashTx.accountType,
          description: `Thanh toán phiếu cân nhựa ${newTk.ticketCode}`,
          dateStr: newTk.dateStr,
          status: 'active',
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  // Quản lý danh mục Loại Nhựa (Thêm / Sửa đơn giá / Ẩn-Hiện)
  const handleAddPlasticType = (e: React.FormEvent) => {
    e.preventDefault();
    if (envMode !== 'demo') { pushToast('Danh mục Production chưa đồng bộ','Không ghi chỉnh sửa demo vào dữ liệu thật.','warning');return; }
    if (!canManageCashFlow(userProfile.role)) {
      handlePermissionDenied('Thêm hoặc chỉnh sửa danh mục Loại nhựa');
      return;
    }
    const cleanName = newPlasticName.trim();
    const cleanCode = (newPlasticCode.trim() || cleanName).toUpperCase();
    if (!cleanName) {
      pushToast('Thiếu tên loại nhựa', 'Vui lòng nhập tên loại nhựa mới.', 'warning');
      return;
    }
    const created: PlasticTypeItem = {
      id: `plastic-${Date.now()}`,
      code: cleanCode,
      name: cleanName,
      category: 'Nhựa phân loại',
      defaultPriceKg: Math.max(0, Number(newPlasticPrice) || 12000),
      impurityHintPercent: Math.max(0, Number(newPlasticImpurity) || 3),
      description:
        newPlasticDesc.trim() ||
        `Nhựa phế liệu phân loại (${cleanName}) tại xưởng Dư-Nhựa`,
      isHidden: false,
    };
    setPlasticTypes((prev) => [...prev, created]);
    setNewPlasticCode('');
    setNewPlasticName('');
    setNewPlasticDesc('');
    pushToast(
      'Đã thêm loại nhựa mới',
      `Loại nhựa "${created.name}" (Đơn giá gợi ý: ${formatCurrencyVND(created.defaultPriceKg)}/kg) đã sẵn sàng khi lập phiếu cân.`,
      'success'
    );
  };

  const handleToggleHidePlasticType = (item: PlasticTypeItem) => {
    if (envMode !== 'demo') { pushToast('Chưa hỗ trợ Production','Danh mục nhựa còn lưu trong trình duyệt.','warning');return; }
    if (!canManageCashFlow(userProfile.role)) {
      handlePermissionDenied('Ẩn hoặc hiện danh mục Loại nhựa');
      return;
    }
    setPlasticTypes((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, isHidden: !p.isHidden } : p))
    );
    pushToast(
      item.isHidden ? 'Đã hiển thị lại loại nhựa' : 'Đã tạm ẩn loại nhựa',
      `Loại nhựa "${item.name}" đã được ${item.isHidden ? 'kích hoạt lại' : 'ẩn khỏi danh sách chọn nhanh'}.`,
      'info'
    );
  };

  const handleSavePlasticPrice = (item: PlasticTypeItem) => {
    if (envMode !== 'demo') { pushToast('Chưa hỗ trợ Production','Đơn giá tham khảo chỉ lưu DEMO.','warning');return; }
    const nextPrice = Math.max(0, Number(editingPlasticPrice) || item.defaultPriceKg);
    setPlasticTypes((prev) =>
      prev.map((p) =>
        p.id === item.id ? { ...p, defaultPriceKg: nextPrice } : p
      )
    );
    setEditingPlasticId(null);
    pushToast(
      'Đã cập nhật đơn giá loại nhựa',
      `${item.name}: ${formatCurrencyVND(nextPrice)}/kg.`,
      'success'
    );
  };

  // 1. Tính toán danh sách bản ghi sẽ thay đổi khi chuẩn hóa từ thuật ngữ mủ cao su sang nhựa phế liệu (Xem trước Before/After)
  const migrationPreviewDiffs = useMemo(() => {
    const diffs: Array<{
      id: string;
      recordType: string;
      code: string;
      fieldName: string;
      beforeVal: string;
      afterVal: string;
    }> = [];

    demoTransactions.forEach((tx) => {
      const nextCounterparty = migrateLegacyRubberText(tx.counterparty);
      if (nextCounterparty !== tx.counterparty) {
        diffs.push({
          id: `tx-cp-${tx.id}`,
          recordType: 'Sổ Thu – Chi',
          code: tx.code,
          fieldName: 'counterparty (Đối tượng)',
          beforeVal: tx.counterparty,
          afterVal: nextCounterparty,
        });
      }
      const nextCategory = migrateLegacyRubberText(tx.category);
      if (nextCategory !== tx.category) {
        diffs.push({
          id: `tx-cat-${tx.id}`,
          recordType: 'Sổ Thu – Chi',
          code: tx.code,
          fieldName: 'category (Danh mục)',
          beforeVal: tx.category,
          afterVal: nextCategory,
        });
      }
      const nextDesc = migrateLegacyRubberText(tx.description);
      if (nextDesc !== tx.description) {
        diffs.push({
          id: `tx-desc-${tx.id}`,
          recordType: 'Sổ Thu – Chi',
          code: tx.code,
          fieldName: 'description (Nội dung)',
          beforeVal: tx.description,
          afterVal: nextDesc,
        });
      }
    });

    demoTickets.forEach((tk) => {
      const nextPartner = migrateLegacyRubberText(tk.partnerName);
      if (nextPartner !== tk.partnerName) {
        diffs.push({
          id: `tk-pt-${tk.id}`,
          recordType: 'Phiếu cân / Mẻ băm',
          code: tk.ticketCode,
          fieldName: 'partnerName (Đối tác)',
          beforeVal: tk.partnerName,
          afterVal: nextPartner,
        });
      }
      const nextType = migrateLegacyRubberText(tk.rubberType);
      if (nextType !== tk.rubberType) {
        diffs.push({
          id: `tk-rt-${tk.id}`,
          recordType: 'Phiếu cân / Mẻ băm',
          code: tk.ticketCode,
          fieldName: 'rubberType (Loại nhựa)',
          beforeVal: tk.rubberType,
          afterVal: nextType,
        });
      }
    });

    demoActivityLogs.forEach((lg) => {
      const nextMod =
        lg.moduleName === 'Cân mủ'
          ? 'Cân nhựa'
          : lg.moduleName === 'Sản xuất'
            ? 'Phân loại & Băm nhựa'
            : lg.moduleName === 'Kho'
              ? 'Kho nhựa'
              : lg.moduleName;
      if (nextMod !== lg.moduleName) {
        diffs.push({
          id: `lg-mod-${lg.id}`,
          recordType: 'Nhật ký hoạt động',
          code: lg.targetCode,
          fieldName: 'moduleName (Phân hệ)',
          beforeVal: lg.moduleName,
          afterVal: nextMod,
        });
      }
    });

    return diffs;
  }, [demoTransactions, demoTickets, demoActivityLogs]);

  // 2. Xuất bản sao lưu JSON toàn hệ thống trước khi chuẩn hóa
  const handleExportFullBackupJson = () => {
    if (envMode !== 'demo') { pushToast('Chưa hỗ trợ sao lưu Firestore', 'Chức năng này chỉ sao lưu dữ liệu DEMO của trình duyệt; hãy dùng công cụ sao lưu Firebase phù hợp cho dữ liệu thật.', 'warning'); return; }
    const backupPayload = {
      appBrand: 'Dư-Nhựa phế liệu',
      exportedAt: new Date().toISOString(),
      transactions: demoTransactions,
      weighTickets: demoTickets,
      attendance: demoAttendance,
      employees,
      shifts,
      plasticTypes,
      machines,
      inventoryItems,
      stockMovements: demoStockMovements,
      payrollPeriodsDemo: (()=>{try{return JSON.parse(localStorage.getItem('dunhua_demo_payroll_periods_v2')||'[]')}catch{return []}})(),
      maintenanceDemo: (()=>{try{return JSON.parse(localStorage.getItem('dunhua_demo_maintenance_v1')||'[]')}catch{return []}})(),
      activityLogs: demoActivityLogs,
    };
    try {
      window.localStorage.setItem(
        MIGRATION_SNAPSHOT_KEY,
        JSON.stringify(backupPayload)
      );
      setHasMigrationSnapshot(true);
    } catch {
      // Ignore storage quota error
    }
    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `SaoLuu_DuNhuaPheLieu_${TODAY_STR.replace(/\//g, '-')}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast(
      'Đã sao lưu dữ liệu thành công',
      'Bản sao lưu JSON đã được tải về máy và lưu vào bộ nhớ khôi phục an toàn.',
      'success'
    );
  };

  // 3. Mở cửa sổ kiểm tra 5 bước trước khi chuẩn hóa dữ liệu cũ
  const handleMigrateLegacyRubberData = () => {
    setMigrationConfirmed(false);
    setShowMigrationModal(true);
  };

  // 4. Thực thi chuẩn hóa sau khi người dùng đã xem trước và xác nhận riêng
  const handleExecuteSafeMigration = () => {
    // Phase 4E: a historical rubber grade is NOT automatically a plastic polymer.
    // Keep the review/export dialog, disable all blind rewriting until verified mapping exists.
    pushToast('Đã tạm khóa chuyển đổi tự động',
      'Không thể suy ra PET/HDPE/PP từ nhãn mủ cao su. Hãy đối chiếu chứng từ từng phiếu, xuất sao lưu và làm migration có kiểm soát.',
      'warning');
    return;
  };

  // 5. Khôi phục dữ liệu từ bản chụp trước khi chuẩn hóa
  const handleRestoreFromMigrationSnapshot = () => {
    if (envMode !== 'demo') { pushToast('Chặn khôi phục dữ liệu thật', 'Chỉ khôi phục bản DEMO, không ghi đè Firestore.', 'warning'); return; }
    try {
      const raw = window.localStorage.getItem(MIGRATION_SNAPSHOT_KEY);
      if (!raw) {
        pushToast(
          'Không tìm thấy bản sao lưu',
          'Chưa có bản sao lưu trước chuẩn hóa trong trình duyệt.',
          'warning'
        );
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.transactions)) {
        setDemoTransactions(parsed.transactions);
      }
      if (Array.isArray(parsed.weighTickets)) {
        setDemoTickets(parsed.weighTickets);
      }
      if (Array.isArray(parsed.activityLogs)) {
        setDemoActivityLogs(parsed.activityLogs);
      }
      setShowMigrationModal(false);
      pushToast(
        'Đã khôi phục dữ liệu gốc thành công',
        'Dữ liệu Sổ Thu – Chi, Phiếu cân và Nhật ký đã được hoàn nguyên về trạng thái trước chuẩn hóa.',
        'info'
      );
    } catch {
      pushToast(
        'Lỗi khi đọc bản sao lưu',
        'Không thể khôi phục từ bản chụp.',
        'error'
      );
    }
  };

  // Lập mẻ Phân loại & Băm nhựa mới
  const handleCreateShreddingBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (envMode !== 'demo') { pushToast('Mẻ băm Production chưa sẵn sàng','Chưa có lưu mẻ băm vào Firestore theo phân quyền xưởng.','warning'); return; }
    const inKg = Math.max(0, Number(batchInputKg) || 0);
    const outKg = Math.max(0, Number(batchOutputKg) || 0);
    const scrKg = Math.max(0, Number(batchScrapKg) || 0);
    if (inKg <= 0 || outKg <= 0 || outKg + scrKg > inKg) {
      pushToast(
        'Số liệu mẻ băm chưa hợp lệ',
        'Khối lượng đầu vào phải lớn hơn 0 và tổng (Nhựa sau băm + Phế phẩm) không vượt quá Đầu vào.',
        'warning'
      );
      return;
    }
    const bal = calculateProductionBalance(inKg, outKg, scrKg);
    const code = `MBN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(demoTickets.length + 1).padStart(2, '0')}`;
    const tsStr = getServerTimestampDisplay();
    const createdBatch: WeighTicket = {
      id: `batch-${Date.now()}`,
      ownerId: 'demo-owner',
      ticketCode: code,
      ticketType: 'production_batch',
      partnerName: `${batchWorker} – ${batchMachine}`,
      delivererName: batchWorker,
      vehiclePlate: batchMachine.split(' ')[0] || 'MB-01',
      rubberType: batchPlasticType,
      grossKg: inKg,
      tareKg: 0,
      deductionKg: scrKg + bal.lossKg,
      netKg: outKg,
      outputKg: outKg,
      scrapKg: scrKg,
      lossKg: bal.lossKg,
      recoveryRatePercent: bal.recoveryRatePercent,
      machineName: batchMachine,
      shiftName: batchShift,
      operatorName: batchWorker,
      unitPrice: 0,
      totalAmount: 0,
      paidAmount: 0,
      debtAmount: 0,
      notes: batchNotes.trim(),
      dateStr: `${batchDate} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: new Date().toISOString(),
    };

    setDemoTickets((prev) => [createdBatch, ...prev]);

    // Tự động cập nhật Kho nhựa (trừ Nhựa chờ băm, cộng Nhựa đã băm và Phế phẩm)
    setInventoryItems((prev) =>
      prev.map((item) => {
        if (item.category === 'Nhựa chờ băm') {
          const nextOut = item.outWeightKg + inKg;
          const nextStock = Math.max(0, item.stockWeightKg - inKg);
          return { ...item, outWeightKg: nextOut, stockWeightKg: nextStock, updatedAt: tsStr };
        }
        if (item.category === 'Nhựa đã băm') {
          const nextIn = item.inWeightKg + outKg;
          const nextStock = item.stockWeightKg + outKg;
          return { ...item, inWeightKg: nextIn, stockWeightKg: nextStock, updatedAt: tsStr };
        }
        if (item.category === 'Phế phẩm' && scrKg > 0) {
          const nextIn = item.inWeightKg + scrKg;
          const nextStock = item.stockWeightKg + scrKg;
          return { ...item, inWeightKg: nextIn, stockWeightKg: nextStock, updatedAt: tsStr };
        }
        return item;
      })
    );

    const logEntry: ActivityLogRecord = {
      id: `demo-log-${Date.now()}`,
      ownerId: 'demo-owner',
      actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      timestampStr: tsStr,
      moduleName: 'Phân loại & Băm nhựa',
      actionType: 'Ghi nhận mẻ băm nhựa',
      targetCode: code,
      previousValue: `Đầu vào: ${inKg.toLocaleString('vi-VN')} kg ${batchPlasticType}`,
      newValue: `Sau băm: ${outKg.toLocaleString('vi-VN')} kg (${bal.recoveryRatePercent}%) · Phế phẩm: ${scrKg} kg · Hao hụt: ${bal.lossKg} kg`,
      reason: `${batchMachine} · ${batchShift} · CN: ${batchWorker}`,
      resultStatus: 'Thành công',
      createdAt: new Date().toISOString(),
    };
    setDemoActivityLogs((prev) => [logEntry, ...prev]);
    setShowBatchForm(false);
    pushToast(
      'Đã ghi nhận mẻ phân loại & băm nhựa',
      `Mã ${code}: Thu hồi ${outKg.toLocaleString('vi-VN')} kg (${bal.recoveryRatePercent}%), hao hụt ${bal.lossKg} kg.`,
      'success'
    );
  };

  const handleUpdateMachineStatus = (
    mac: ShredderMachine,
    newStatus: ShredderMachine['status']
  ) => {
    if (envMode !== 'demo') { pushToast('Máy Production chưa sẵn sàng','Trạng thái máy chưa được đồng bộ Firestore.','warning');return; }
    setMachines((prev) =>
      prev.map((m) => (m.id === mac.id ? { ...m, status: newStatus } : m))
    );
    pushToast(
      'Đã cập nhật trạng thái máy băm',
      `${mac.name}: ${mac.status} → ${newStatus}.`,
      'info'
    );
  };

  const handleSaveInventoryMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (envMode !== 'demo') { pushToast('Kho Production chưa sẵn sàng', 'Chưa có backend đồng bộ kho đáng tin cậy. Chỉ dùng ở DEMO.', 'warning'); return; }
    const qty = Math.max(0, Number(invMoveKg) || 0);
    if (qty <= 0) {
      pushToast('Khối lượng chưa hợp lệ', 'Vui lòng nhập số lượng lớn hơn 0.', 'warning');
      return;
    }
    const target = inventoryItems.find((i) => i.id === invTargetId);
    if (!target) return;
    if (invMoveType === 'out' && qty > target.stockWeightKg) {
      pushToast(
        'Vượt quá tồn kho hiện tại',
        `Mặt hàng "${target.name}" chỉ còn tồn ${target.stockWeightKg.toLocaleString('vi-VN')} ${target.unit}.`,
        'error'
      );
      return;
    }
    const tsStr = getServerTimestampDisplay();
    let posted;
    try {
      posted = postStockMovement(target,demoStockMovements,{
        id:`KHO-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        itemId:target.id,type:invMoveType,quantity:qty,sourceType:'manual',
        at:new Date().toISOString(),note:invMoveNote.trim()
      });
    } catch (err) {
      pushToast('Không lưu được biến động kho',err instanceof Error?err.message:'Dữ liệu không hợp lệ','error');
      return;
    }
    setInventoryItems(prev=>prev.map(item=>item.id===target.id?posted.item:item));
    setDemoStockMovements(prev=>[posted.movement,...prev]);

    const logEntry: ActivityLogRecord = {
      id: `demo-log-${Date.now()}`,
      ownerId: 'demo-owner',
      actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
      actorUid: userProfile.uid,
      actorRole: userProfile.role,
      timestampStr: tsStr,
      moduleName: 'Kho nhựa',
      actionType: invMoveType === 'in' ? 'Nhập kho nhựa / vật tư' : 'Xuất kho nhựa / vật tư',
      targetCode: target.code,
      previousValue: `Tồn trước: ${target.stockWeightKg.toLocaleString('vi-VN')} ${target.unit}`,
      newValue: `${invMoveType === 'in' ? '+' : '-'}${qty.toLocaleString('vi-VN')} ${target.unit} (${target.category})`,
      reason: invMoveNote.trim(),
      resultStatus: 'Thành công',
      createdAt: new Date().toISOString(),
    };
    setDemoActivityLogs((prev) => [logEntry, ...prev]);
    setShowInventoryForm(false);
    pushToast(
      invMoveType === 'in' ? 'Đã ghi nhận Nhập kho nhựa' : 'Đã ghi nhận Xuất kho nhựa',
      `${target.name}: ${invMoveType === 'in' ? '+' : '-'}${qty.toLocaleString('vi-VN')} ${target.unit}.`,
      'success'
    );
  };

  // Export CSV / Excel helper
  const handleExportCSV = () => {
    const headers = [
      'Mã phiếu',
      'Ngày giờ',
      'Loại',
      'Quỹ',
      'Danh mục',
      'Đối tượng',
      'Số tiền (VNĐ)',
      'Nội dung',
      'Trạng thái',
    ];
    const rows = filteredTransactions.map((t) => [
      t.code,
      t.dateStr,
      t.type === 'income' ? 'Thu' : t.type === 'expense' ? 'Chi' : 'Chuyển quỹ',
      t.accountType === 'cash' ? 'Tiền mặt' : 'Ngân hàng',
      t.category,
      `"${t.counterparty.replace(/"/g, '""')}"`,
      String(t.amount),
      `"${t.description.replace(/"/g, '""')}"`,
      t.status === 'active' ? 'Hợp lệ' : `Đã hủy (${t.cancelReason || ''})`,
    ]);
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `SoThuChi_DuNhua_${TODAY_STR.replace(/\//g, '-')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Google Login Handler
  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      let previousAttempts: number[] = [];
      try {
        const saved = window.localStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) previousAttempts = parsed.map(Number);
      } catch {
        previousAttempts = [];
      }
      const throttle = evaluateSignInThrottle(previousAttempts);
      if (!throttle.allowed) {
        const retryMinutes = Math.max(1, Math.ceil(throttle.retryAfterMs / 60_000));
        setAuthError(
          `Phát hiện thao tác đăng nhập lặp lại quá nhanh. Tạm khóa trên thiết bị này ${retryMinutes} phút để chống spam.`,
        );
        return;
      }
      try {
        window.localStorage.setItem(
          LOGIN_ATTEMPT_STORAGE_KEY,
          JSON.stringify(throttle.attempts),
        );
      } catch {
        // Firebase Auth still applies its own server-side abuse protection.
      }
      await signInWithPopup(auth, googleProvider);
      setEnvMode('production');
    } catch (err) {
      setAuthError(
        import.meta.env.DEV && err instanceof Error
          ? `Đăng nhập Google không thành công: ${err.message}`
          : 'Đăng nhập Google không thành công hoặc đã bị hệ thống bảo mật từ chối.',
      );
    }
  };

  // Start camera for 3-angle + liveness face enrollment (never black screen)
  const startEnrollmentCamera = async () => {
    setEnrollCameraError('');
    setEnrollHasLiveVideo(false);
    setEnrollStep(1);
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
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        enrollStreamRef.current = stream;
        const videoEl = enrollVideoRef.current;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.muted = true;
          videoEl.playsInline = true;
          await videoEl.play().catch(() => undefined);
          if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
            setEnrollHasLiveVideo(true);
          }
        }
        return;
      } catch {
        setEnrollHasLiveVideo(false);
        return;
      }
    }
  };

  const closeEnrollmentModal = () => {
    if (enrollStreamRef.current) {
      enrollStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      enrollStreamRef.current = null;
    }
    if (enrollVideoRef.current) {
      enrollVideoRef.current.srcObject = null;
    }
    setEnrollHasLiveVideo(false);
    setEnrollingEmp(null);
    setEnrollStep(0);
    setEnrollConsent(false);
    setEnrollCameraError('');
  };

  const handleChangeRole = (role: UserRole) => {
    if (envMode !== 'demo') {
      pushToast('Không thể đổi vai trò', 'Production chỉ sử dụng quyền đã cấp trong Firestore.', 'warning');
      return;
    }
    setUserProfile((u) => ({ ...u, role }));
    try {
      window.localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
    } catch {
      // Ignore storage error
    }
    pushToast(
      `Đã chuyển sang vai trò: ${ROLE_LABELS[role].name}`,
      ROLE_LABELS[role].permissionsSummary,
      'info'
    );
  };

  const hasFinancialAccess = canManageCashFlow(userProfile.role);

  return (
    <>
      <ResponsiveTableEnhancer />
      <OfflineIndicator />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <React.Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-slate-500">Đang tải chức năng…</div>}>
      <AppShell
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        envMode={envMode}
        onChangeEnvMode={(mode) => {
          setEnvMode(mode);
          if (mode === 'production') {
            // Privileges are re-read from Firestore, never from the DEMO role switch.
            setUserProfile((prev) => ({ ...prev, role: 'worker' }));
          }
        }}
        settings={settings}
        onToggleDarkMode={() =>
          setSettings((s) => ({ ...s, darkMode: !s.darkMode }))
        }
        userProfile={userProfile}
        onChangeRole={handleChangeRole}
        firebaseUser={firebaseUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={() => signOut(auth)}
        notificationCount={Math.max(
          1,
          activeTickets.filter((t) => t.debtAmount > 0).length + securityAlerts.length,
        )}
      >
        {envMode === 'production' && ['hr', 'attendance', 'production', 'inventory'].includes(activeTab) && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            Production: hồ sơ nhân sự, ca làm, máy móc và tồn kho chưa được đồng bộ đầy đủ từ Firestore. Không dùng dữ liệu DEMO hiển thị ở các phân hệ này để ra quyết định thực tế. Chấm công Production tạm khóa đến khi có định danh nhân viên tin cậy.
          </div>
        )}
        {authError && (
          <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
            {authError}
          </div>
        )}
        {envMode === 'production' && userProfile.role === 'owner' && securityAlerts.length > 0 && (
          <div
            role="alert"
            data-testid="security-alert-banner"
            className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-xs text-rose-800 font-semibold"
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p>Cảnh báo bảo mật: có {securityAlerts.length} sự kiện cần kiểm tra.</p>
                <p className="mt-1 font-normal">
                  Gần nhất: {securityAlerts[0].message} · Mã vết {securityAlerts[0].id}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 1. TRANG CHỦ ĐƠN GIẢN (4 Ô TỔNG QUAN, 3 NÚT NHANH, 5 GIAO DỊCH)   */}
        {/* ================================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-6" data-testid="page-home">
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 sm:px-6 flex items-center justify-center overflow-hidden">
              <img
                src="/logo-horizontal.svg"
                alt="Dư-Nhựa phế liệu – Xưởng phân loại và băm nhựa"
                className="w-full max-w-[520px] h-auto"
                width="1200"
                height="320"
                fetchPriority="high"
              />
            </section>
            {/* 3 NÚT THAO TÁC NHANH NỔI BẬT (THU TIỀN, CHI TIỀN, CHẤM CÔNG) */}
            <section
              aria-label="Thao tác nhanh"
              data-testid="quick-actions-section"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 no-print"
            >
              <div className="mb-3.5">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Thao tác nhanh
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {hasFinancialAccess
                    ? 'Ghi nhanh phiếu Thu, phiếu Chi hoặc mở máy Chấm công trực tiếp'
                    : 'Chế độ nhân viên / công nhân: Nhấn nút CHẤM CÔNG bên dưới để ghi nhận VÀO CA hoặc RA CA'}
                </p>
              </div>

              <div
                className={`grid gap-3.5 ${
                  hasFinancialAccess
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-1'
                }`}
              >
                {hasFinancialAccess && (
                  <>
                    {/* 1. THU TIỀN – biểu tượng dấu cộng, màu xanh lá */}
                    <button
                      type="button"
                      data-testid="quick-btn-income"
                      onClick={() => setActiveModal('income')}
                      className="flex items-center justify-center gap-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-4 px-5 font-extrabold text-base sm:text-lg shadow-sm transition-all cursor-pointer min-h-[60px]"
                    >
                      <span className="p-1.5 rounded-lg bg-white/20 shrink-0">
                        <Plus className="w-6 h-6 stroke-[2.75]" />
                      </span>
                      <span className="tracking-wide">THU TIỀN</span>
                    </button>

                    {/* 2. CHI TIỀN – biểu tượng dấu trừ, màu đỏ */}
                    <button
                      type="button"
                      data-testid="quick-btn-expense"
                      onClick={() => setActiveModal('expense')}
                      className="flex items-center justify-center gap-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white py-4 px-5 font-extrabold text-base sm:text-lg shadow-sm transition-all cursor-pointer min-h-[60px]"
                    >
                      <span className="p-1.5 rounded-lg bg-white/20 shrink-0">
                        <Minus className="w-6 h-6 stroke-[2.75]" />
                      </span>
                      <span className="tracking-wide">CHI TIỀN</span>
                    </button>
                  </>
                )}

                {/* 3. CHẤM CÔNG – biểu tượng quét khuôn mặt, màu xanh dương */}
                <button
                  type="button"
                  data-testid="quick-btn-attendance"
                  onClick={() => setActiveModal('attendance')}
                  className={`flex items-center justify-center gap-3 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white py-4 px-5 font-extrabold text-base sm:text-lg shadow-sm transition-all cursor-pointer min-h-[60px] ${
                    !hasFinancialAccess ? 'w-full col-span-full' : ''
                  }`}
                >
                  <span className="p-1.5 rounded-lg bg-white/20 shrink-0">
                    <ScanFace className="w-6 h-6 stroke-[2.25]" />
                  </span>
                  <span className="tracking-wide">CHẤM CÔNG</span>
                </button>
              </div>
            </section>

            {/* 4 Ô TỔNG QUAN TÀI CHÍNH (ẨN KHI TÀI KHOẢN LÀ CÔNG NHÂN KHÔNG CÓ QUYỀN THU CHI) */}
            {hasFinancialAccess ? (
              <>
                <section
                  aria-label="4 ô tổng quan tài chính"
                  data-testid="home-kpi-grid"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  {/* Ô 1: Tổng thu tháng */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Tổng thu tháng
                    </span>
                    <p
                      data-testid="kpi-monthly-income"
                      className="mt-2 text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400"
                    >
                      {formatCurrencyVND(metrics.monthlyIncome)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Thu hôm nay: {formatCurrencyVND(metrics.todayIncome)}
                    </p>
                  </div>

                  {/* Ô 2: Tổng chi tháng */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Tổng chi tháng
                    </span>
                    <p
                      data-testid="kpi-monthly-expense"
                      className="mt-2 text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-rose-700 dark:text-rose-400"
                    >
                      {formatCurrencyVND(metrics.monthlyExpense)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Chi hôm nay: {formatCurrencyVND(metrics.todayExpense)}
                    </p>
                  </div>

                  {/* Ô 3: Số dư tiền mặt */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Số dư tiền mặt
                    </span>
                    <p
                      data-testid="kpi-cash-balance"
                      className="mt-2 text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white"
                    >
                      {formatCurrencyVND(metrics.cashBalance)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Quỹ tiền mặt thực tế tại xưởng
                    </p>
                  </div>

                  {/* Ô 4: Số dư ngân hàng */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Số dư ngân hàng
                    </span>
                    <p
                      data-testid="kpi-bank-balance"
                      className="mt-2 text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#0F2942] dark:text-sky-400"
                    >
                      {formatCurrencyVND(metrics.bankBalance)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tài khoản ngân hàng nhà xưởng
                    </p>
                  </div>
                </section>

                {/* TỐI ĐA 5 GIAO DỊCH GẦN ĐÂY */}
                <section
                  aria-label="5 giao dịch gần đây"
                  data-testid="home-recent-transactions"
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Giao dịch gần đây (Tối đa 5 giao dịch)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tự động cập nhật từ sổ quỹ thu chi
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('cashbook')}
                      className="text-xs font-bold text-[#0F2942] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Xem toàn bộ Thu – Chi →
                    </button>
                  </div>

                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 pr-3 font-semibold">Mã phiếu</th>
                          <th className="py-2.5 px-3 font-semibold">Ngày giờ</th>
                          <th className="py-2.5 px-3 font-semibold">Loại · Quỹ</th>
                          <th className="py-2.5 px-3 font-semibold">
                            Đối tượng & Nội dung
                          </th>
                          <th className="py-2.5 pl-3 text-right font-semibold">
                            Số tiền (VNĐ)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-sm">
                        {activeTransactions.slice(0, 5).map((tx) => (
                          <tr
                            key={tx.id}
                            data-testid={`home-tx-row-${tx.code}`}
                            onClick={() => {
                              setSelectedTx(tx);
                              setSelectedTxMode('view');
                            }}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                              tx.status === 'cancelled'
                                ? 'opacity-50 line-through'
                                : ''
                            }`}
                          >
                            <td className="py-3 pr-3 font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {tx.code}
                            </td>
                            <td className="py-3 px-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                              {tx.dateStr}
                            </td>
                            <td className="py-3 px-3 text-xs whitespace-nowrap">
                              <span
                                className={`font-bold ${
                                  tx.type === 'income'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : tx.type === 'transfer'
                                      ? 'text-sky-700 dark:text-sky-400'
                                      : 'text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {tx.type === 'income'
                                  ? 'Thu tiền'
                                  : tx.type === 'transfer'
                                    ? 'Chuyển quỹ'
                                    : 'Chi tiền'}
                              </span>
                              <span className="text-slate-400 mx-1">·</span>
                              <span className="text-slate-600 dark:text-slate-300">
                                {tx.accountType === 'cash'
                                  ? 'Tiền mặt'
                                  : 'Ngân hàng'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs font-bold text-slate-900 dark:text-white">
                                {tx.counterparty}{' '}
                                <span className="font-normal text-slate-500">
                                  ({tx.category})
                                </span>
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {tx.description}
                              </p>
                            </td>
                            <td
                              className={`py-3 pl-3 text-right font-mono font-bold whitespace-nowrap ${
                                tx.type === 'income'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : tx.type === 'transfer'
                                    ? 'text-sky-700 dark:text-sky-400'
                                    : 'text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {tx.type === 'income'
                                ? '+'
                                : tx.type === 'expense'
                                  ? '-'
                                  : ''}
                              {formatCurrencyVND(tx.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              /* GIAO DIỆN TRANG CHỦ DÀNH CHO TÀI KHOẢN CÔNG NHÂN (KHÔNG HIỂN THỊ DỮ LIỆU TÀI CHÍNH) */
              <section
                data-testid="worker-home-notice"
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Trạng Thái Chấm Công Hôm Nay ({TODAY_STR})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Tài khoản công nhân được bảo mật ẩn số liệu tài chính nhà xưởng. Nhấn nút CHẤM CÔNG phía trên để ghi nhận VÀO CA / RA CA.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Đã vào ca: {metrics.workersCheckedInToday}/{employees.length} người
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {activeAttendance.slice(0, 5).map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800 last:border-none"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {att.employeeName} ({att.employeeCode})
                        </span>
                        <span className="text-slate-500 ml-2">
                          · {att.department}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                        {att.eventType === 'check_in' ? 'VÀO CA' : 'RA CA'} lúc{' '}
                        {att.timeStr}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. THU – CHI (SỔ QUỸ THU CHI & CÔNG NỢ)                           */}
        {/* ================================================================= */}
        {activeTab === 'cashbook' && (
          <div className="space-y-6" data-testid="page-cashbook">
            {!hasFinancialAccess ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-6 text-center space-y-2">
                <Lock className="w-8 h-8 text-amber-600 mx-auto" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Khu vực dành cho Chủ xưởng, Quản lý và Kế toán
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Vai trò hiện tại ({ROLE_LABELS[userProfile.role].name}) không có quyền xem hoặc chỉnh sửa sổ quỹ Thu – Chi.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Sổ Quỹ Thu – Chi & Quản Lý Giao Dịch
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Số dư cuối kỳ = Đầu kỳ + Thu tiền - Chi tiền + Chuyển vào - Chuyển ra. Giao dịch hủy phải ghi rõ lý do kiểm toán.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => setActiveModal('income')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-600 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Ghi Phiếu Thu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal('expense')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-700 text-white text-xs font-bold hover:bg-rose-600 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Ghi Phiếu Chi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal('transfer')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>Chuyển Quỹ</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Xuất Excel (CSV)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>In Sổ Quỹ</span>
                    </button>
                  </div>
                </div>

                {/* 4 Ô Số Dư & Thống Kê Tự Động Tính Lại Trong Sổ Thu Chi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <span className="text-xs font-semibold text-slate-500">
                      Số dư tiền mặt hiện tại
                    </span>
                    <p
                      data-testid="cashbook-cash-balance"
                      className="mt-1.5 text-lg sm:text-xl font-extrabold font-mono text-slate-900 dark:text-white"
                    >
                      {formatCurrencyVND(metrics.cashBalance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <span className="text-xs font-semibold text-slate-500">
                      Số dư ngân hàng hiện tại
                    </span>
                    <p
                      data-testid="cashbook-bank-balance"
                      className="mt-1.5 text-lg sm:text-xl font-extrabold font-mono text-[#0F2942] dark:text-sky-400"
                    >
                      {formatCurrencyVND(metrics.bankBalance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <span className="text-xs font-semibold text-slate-500">
                      Tổng thu trong tháng
                    </span>
                    <p
                      data-testid="cashbook-monthly-income"
                      className="mt-1.5 text-lg sm:text-xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400"
                    >
                      {formatCurrencyVND(metrics.monthlyIncome)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <span className="text-xs font-semibold text-slate-500">
                      Tổng chi trong tháng
                    </span>
                    <p
                      data-testid="cashbook-monthly-expense"
                      className="mt-1.5 text-lg sm:text-xl font-extrabold font-mono text-rose-700 dark:text-rose-400"
                    >
                      {formatCurrencyVND(metrics.monthlyExpense)}
                    </p>
                  </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      aria-label="Tìm kiếm nội dung giao dịch"
                      placeholder="Tìm mã phiếu, tên người, nội dung..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <select
                    aria-label="Lọc theo quỹ"
                    value={accountFilter}
                    onChange={(e) =>
                      setAccountFilter(e.target.value as 'all' | AccountType)
                    }
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="all">
                      Tất cả các quỹ (Tiền mặt + Ngân hàng)
                    </option>
                    <option value="cash">Chỉ Quỹ Tiền Mặt</option>
                    <option value="bank">Chỉ Tài Khoản Ngân Hàng</option>
                  </select>

                  <select
                    aria-label="Lọc theo loại phiếu"
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(
                        e.target.value as
                          | 'all'
                          | 'income'
                          | 'expense'
                          | 'transfer'
                      )
                    }
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="all">Tất cả loại giao dịch</option>
                    <option value="income">Phiếu Thu Tiền</option>
                    <option value="expense">Phiếu Chi Tiền</option>
                    <option value="transfer">Chuyển Quỹ Nội Bộ</option>
                  </select>

                  <select
                    aria-label="Lọc theo danh mục"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="all">Tất cả danh mục thu chi</option>
                    {[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transactions Table */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table
                      className="w-full text-left border-collapse"
                      data-testid="cashbook-table"
                    >
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                          <th className="py-3 px-4 font-semibold">Mã phiếu</th>
                          <th className="py-3 px-3 font-semibold">Ngày giờ</th>
                          <th className="py-3 px-3 font-semibold">
                            Quỹ & Danh mục
                          </th>
                          <th className="py-3 px-3 font-semibold">
                            Người nộp / nhận
                          </th>
                          <th className="py-3 px-3 font-semibold">
                            Nội dung & Chứng từ
                          </th>
                          <th className="py-3 px-4 text-right font-semibold">
                            Số tiền
                          </th>
                          <th className="py-3 px-4 text-right font-semibold no-print">
                            Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        {filteredTransactions.map((tx) => (
                          <tr
                            key={tx.id}
                            data-testid={`cashbook-row-${tx.code}`}
                            onClick={() => {
                              setSelectedTx(tx);
                              setSelectedTxMode('view');
                            }}
                            className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                              tx.status === 'cancelled' ? 'opacity-60' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {tx.code}
                            </td>
                            <td className="py-3 px-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                              {tx.dateStr}
                            </td>
                            <td className="py-3 px-3 text-xs">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                {tx.category}
                              </p>
                              <p className="text-slate-500">
                                {tx.accountType === 'cash'
                                  ? 'Quỹ Tiền Mặt'
                                  : 'Ngân Hàng'}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-xs font-semibold text-slate-900 dark:text-white">
                              {tx.counterparty}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                              <p>{tx.description}</p>
                              {tx.attachmentNote && (
                                <p className="font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                                  Đính kèm: {tx.attachmentNote}
                                </p>
                              )}
                              {tx.status === 'cancelled' && (
                                <p className="text-rose-600 font-semibold mt-0.5">
                                  Đã hủy phiếu – Lý do: {tx.cancelReason}
                                </p>
                              )}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                                tx.status === 'cancelled'
                                  ? 'line-through text-slate-400'
                                  : tx.type === 'income'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : tx.type === 'transfer'
                                      ? 'text-sky-700 dark:text-sky-400'
                                      : 'text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {tx.type === 'income'
                                ? '+'
                                : tx.type === 'expense'
                                  ? '-'
                                  : ''}
                              {formatCurrencyVND(tx.amount)}
                            </td>
                            <td
                              className="py-3 px-4 text-right whitespace-nowrap no-print"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTx(tx);
                                    setSelectedTxMode('view');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Chi tiết</span>
                                </button>
                                {tx.status === 'active' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedTx(tx);
                                        setSelectedTxMode('edit');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-900 text-xs font-semibold text-[#0F2942] dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>Sửa</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedTx(tx);
                                        setSelectedTxMode('confirm_cancel');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      <span>Hủy</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTx(tx);
                                      setSelectedTxMode('confirm_restore');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Khôi phục</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredTransactions.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-8 text-center text-xs text-slate-500"
                            >
                              Không tìm thấy giao dịch thu chi nào khớp bộ lọc.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. CHẤM CÔNG (BẢNG CÔNG, DUYỆT DỰ PHÒNG & CA LÀM VIỆC)            */}
        {/* ================================================================= */}
        {activeTab === 'attendance' && (
          <AttendanceModule
            attendance={activeAttendance}
            attemptTraces={attendanceAttemptTraces}
            employees={envMode === 'demo' ? employees : []}
            shifts={envMode === 'demo' ? shifts : []}
            userRole={userProfile.role}
            loggedInEmployeeCode="CN-001"
            onOpenQuickAttendance={() => setActiveModal('attendance')}
            onReviewFallbackRequest={handleReviewFallbackRequest}
            onAdjustAttendanceRow={handleAdjustAttendanceRow}
            onSaveShiftConfig={handleSaveShiftConfig}
            onPermissionDenied={handlePermissionDenied}
          />
        )}

        {/* ================================================================= */}
        {/* 4. NHÂN SỰ (HỒ SƠ CÔNG NHÂN & ĐĂNG KÝ KHUÔN MẶT 8 BƯỚC)           */}
        {/* ================================================================= */}
        {activeTab === 'hr' && (
          <div className="space-y-6" data-testid="page-hr">
            <EmployeeManagerDemo
              employees={envMode === 'demo' ? employees : []}
              shifts={envMode === 'demo' ? shifts : []}
              mode={envMode} role={userProfile.role}
              onSave={setEmployees} onNote={recordDemoModuleLog}
            />
            <PayrollWorkflowDemo
              employees={envMode === 'demo' ? employees : []}
              attendance={activeAttendance}
              shifts={envMode === 'demo' ? shifts : []}
              mode={envMode} role={userProfile.role}
              onCashPayment={recordDemoPayrollExpense} onAudit={recordDemoModuleLog}
            />
            <PayrollPreview
              employees={envMode === 'demo' ? employees : []}
              attendance={activeAttendance}
              shifts={envMode === 'demo' ? shifts : []}
              envMode={envMode}
              role={userProfile.role}
            />
            {envMode === 'production' && (
              <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 text-amber-950 p-4 text-sm font-semibold">
                Hồ sơ nhân viên, ca làm và đăng ký khuôn mặt hiện là dữ liệu trên trình duyệt. Chưa đồng bộ vào Firestore; không sử dụng để quản lý nhân sự thật hoặc ghi nhận sinh trắc học. Tính lương phía dưới chỉ mở trong DEMO.
              </div>
            )}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Danh Sách Hồ Sơ Nhân Sự & Quản Lý Dữ Liệu Khuôn Mặt (1:1)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chỉ Chủ xưởng, Quản lý và Nhân sự mới có quyền đăng ký, cập
                    nhật hoặc thu hồi mẫu khuôn mặt. Không lưu ảnh thô trong
                    nhật ký chung.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    data-testid="hr-rbac-badge"
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                      canManageFaceEnrollment(userProfile.role)
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}
                  >
                    {canManageFaceEnrollment(userProfile.role)
                      ? 'Được quyền Đăng ký / Thu hồi mẫu khuôn mặt'
                      : 'Công nhân không có quyền tự đăng ký / sửa mẫu khuôn mặt'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModal('attendance')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F2942] text-white text-xs font-bold cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Chấm công ngay</span>
                  </button>
                </div>
              </div>

              {/* Chính sách lưu trữ & bảo vệ dữ liệu sinh trắc học */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <strong className="text-slate-900 dark:text-white block">
                    1. Kiến trúc xác minh 1:1 & Chi phí $0:
                  </strong>
                  <span>
                    Hiện chỉ có mã mẫu thử ngẫu nhiên, chưa tích hợp vector
                    sinh trắc học và kiểm tra người thật đáng tin cậy.
                    Không sử dụng để xác minh chính thức.
                  </span>
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white block">
                    2. Chính sách lưu trữ & Xóa dữ liệu:
                  </strong>
                  <span>
                    Lưu trữ tối đa 12 tháng kể từ ngày ký đồng ý hoặc xóa vĩnh
                    viễn ngay lập tức khi nhân viên nghỉ việc / thu hồi đồng ý.
                  </span>
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white block">
                    3. Phương án thay thế không sinh trắc:
                  </strong>
                  <span>
                    Nhân viên không đồng ý dùng khuôn mặt được quyền sử dụng
                    Yêu cầu chấm công dự phòng có Quản lý xác nhận hàng ngày.
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table
                  className="w-full text-left border-collapse"
                  data-testid="hr-employees-table"
                >
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                      <th className="py-2.5 pr-3 font-semibold">Mã NV</th>
                      <th className="py-2.5 px-3 font-semibold">Họ và tên</th>
                      <th className="py-2.5 px-3 font-semibold">
                        Bộ phận & Vị trí
                      </th>
                      <th className="py-2.5 px-3 font-semibold">Ca làm việc</th>
                      <th className="py-2.5 px-3 font-semibold">
                        Chính sách lương
                      </th>
                      <th className="py-2.5 px-3 font-semibold">
                        Trạng thái mẫu khuôn mặt & Lưu trữ
                      </th>
                      <th className="py-2.5 pl-3 text-right font-semibold">
                        Quản lý sinh trắc học
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {(envMode === 'demo' ? employees : []).map((emp) => (
                      <tr
                        key={emp.code}
                        data-testid={`hr-row-${emp.code}`}
                      >
                        <td className="py-3 pr-3 font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {emp.code}
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-slate-900 dark:text-white">
                          {emp.fullName}
                          <p className="font-normal text-slate-500">
                            {emp.phone}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {emp.department}
                          </p>
                          <p className="text-slate-500">{emp.position}</p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                          {emp.shiftName}
                        </td>
                        <td className="py-3 px-3 text-xs font-mono">
                          {emp.salaryType}: {formatCurrencyVND(emp.baseRate)}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {emp.faceEnrolled ? (
                            <div>
                              <span
                                data-testid={`hr-face-status-${emp.code}`}
                                className="font-bold text-emerald-700 dark:text-emerald-400"
                              >
                                Đã đăng ký ({emp.enrolledAngles}/3 góc mô phỏng)
                              </span>
                              <p className="font-mono text-[11px] text-slate-500">
                                Mã mẫu: {emp.biometricTemplateHash || 'EMB-ACTIVE'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Hạn lưu: {emp.dataRetentionUntil || '12 tháng'}
                              </p>
                            </div>
                          ) : (
                            <span
                              data-testid={`hr-face-status-${emp.code}`}
                              className="font-semibold text-amber-700 dark:text-amber-400"
                            >
                              Chưa đăng ký khuôn mặt (Dùng dự phòng)
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          {canManageFaceEnrollment(userProfile.role) ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                data-testid={`btn-enroll-face-${emp.code}`}
                                onClick={() => {
                                  if (envMode === 'production') {
                                    pushToast('Chưa có AI xác minh khuôn mặt thật', 'Đăng ký mẫu sinh trắc học mô phỏng chỉ hoạt động trong DEMO. Hãy dùng chấm công dự phòng.', 'warning');
                                    return;
                                  }
                                  setEnrollingEmp(emp);
                                  setEnrollConsent(false);
                                  setEnrollStep(0);
                                  setEnrollCameraError('');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                {emp.faceEnrolled
                                  ? 'Cập nhật khuôn mặt'
                                  : 'Đăng ký khuôn mặt'}
                              </button>
                              {emp.faceEnrolled && (
                                <button
                                  type="button"
                                  data-testid={`btn-revoke-face-${emp.code}`}
                                  onClick={() => {
                                    if (envMode === 'production') {
                                      pushToast('Không thể sửa mẫu DEMO trong Production', 'Chưa có dịch vụ quản lý mẫu sinh trắc học thật.', 'warning');
                                      return;
                                    }
                                    const tsStr = getServerTimestampDisplay();
                                    setEmployees((prev) =>
                                      prev.map((item) =>
                                        item.code === emp.code
                                          ? {
                                              ...item,
                                              faceEnrolled: false,
                                              enrolledAngles: 0,
                                              biometricTemplateHash: undefined,
                                              consentSignedAt: undefined,
                                              dataRetentionUntil: undefined,
                                            }
                                          : item
                                      )
                                    );
                                    const logEntry: ActivityLogRecord = {
                                      id: `demo-log-${Date.now()}`,
                                      ownerId: 'demo-user',
                                      actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
                                      actorUid: userProfile.uid,
                                      actorRole: userProfile.role,
                                      timestampStr: tsStr,
                                      moduleName: 'Nhân sự',
                                      actionType: 'Xóa mẫu khuôn mặt',
                                      targetCode: emp.code,
                                      previousValue: `Đã đăng ký (${emp.biometricTemplateHash || 'EMB'})`,
                                      newValue:
                                        'Đã xóa mẫu sinh trắc học & thu hồi đồng ý',
                                      reason:
                                        'Thu hồi đồng ý / Xóa dữ liệu sinh trắc học theo quy định bảo mật',
                                      resultStatus: 'Thành công',
                                      createdAt: new Date().toISOString(),
                                    };
                                    setDemoActivityLogs((prev) => [
                                      logEntry,
                                      ...prev,
                                    ]);
                                    pushToast(
                                      'Đã xóa mẫu dữ liệu khuôn mặt',
                                      `Đã xóa hoàn toàn vector sinh trắc của ${emp.fullName} (${emp.code}).`,
                                      'info'
                                    );
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 cursor-pointer"
                                >
                                  Xóa mẫu
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              data-testid={`btn-enroll-locked-${emp.code}`}
                              onClick={() =>
                                handlePermissionDenied(
                                  'Đăng ký hoặc cập nhật mẫu khuôn mặt nhân viên'
                                )
                              }
                              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 cursor-not-allowed"
                            >
                              Khóa (Chỉ Quản lý/NS)
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Quy trình 8 Bước Đăng ký khuôn mặt */}
            {enrollingEmp && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
                role="dialog"
                aria-modal="true"
                data-testid="face-enrollment-modal"
              >
                <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Đăng Ký Mẫu Khuôn Mặt – {enrollingEmp.fullName} (
                        {enrollingEmp.code})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Bộ phận: {enrollingEmp.department} · Ca:{' '}
                        {enrollingEmp.shiftName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeEnrollmentModal}
                      className="text-xs font-semibold text-slate-500 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                    <p className="font-bold text-slate-900 dark:text-white">
                      Bước 1–3: Thông báo mục đích sử dụng & Đồng ý bảo vệ dữ
                      liệu cá nhân:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        <strong>Mục đích duy nhất:</strong> Xác minh danh tính
                        1:1 khi chấm công VÀO CA / RA CA tại xưởng{' '}
                        <strong>Dư-Nhựa phế liệu</strong>.
                      </li>
                      <li>
                        <strong>Bảo mật & Không lưu ảnh thô:</strong> Chỉ lưu mã
                        băm đặc trưng (Template Hash), tuyệt đối không lưu ảnh
                        chụp khuôn mặt trong Nhật ký hoạt động.
                      </li>
                      <li>
                        <strong>Thời hạn lưu trữ & Quyền thu hồi:</strong> Lưu
                        tối đa 12 tháng hoặc xóa ngay khi nghỉ việc. Nhân viên có
                        quyền từ chối và dùng chấm công dự phòng.
                      </li>
                    </ul>
                    <label className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-400 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        data-testid="enroll-consent-checkbox"
                        checked={enrollConsent}
                        onChange={(e) => setEnrollConsent(e.target.checked)}
                      />
                      <span>
                        Nhân viên {enrollingEmp.fullName} đã đọc, hiểu rõ và
                        đồng ý cho phép xử lý dữ liệu khuôn mặt
                      </span>
                    </label>
                  </div>

                  {enrollCameraError && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                      {enrollCameraError}
                    </div>
                  )}

                  {enrollStep === 0 ? (
                    <button
                      type="button"
                      data-testid="btn-start-enrollment-camera"
                      disabled={!enrollConsent}
                      onClick={startEnrollmentCamera}
                      className="w-full py-2.5 rounded-lg bg-[#0F2942] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                    >
                      Bước 4: Cấp Quyền Mở Camera & Bắt Đầu Chụp 3 Góc + Kiểm
                      Tra Chất Lượng
                    </button>
                  ) : (
                    <div className="space-y-3 text-center">
                      <div className="relative w-full h-56 rounded-xl bg-gradient-to-br from-sky-900 via-[#0F2942] to-emerald-950 border-2 border-emerald-500 overflow-hidden flex flex-col justify-between p-3">
                        <video
                          ref={enrollVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`absolute inset-0 w-full h-full object-cover ${
                            enrollHasLiveVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
                          }`}
                        />
                        {!enrollHasLiveVideo && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-28 h-36 rounded-full border-2 border-dashed border-emerald-300/90 bg-sky-400/15 flex flex-col items-center justify-center gap-1 shadow-inner">
                              <ScanFace className="w-10 h-10 text-emerald-300" />
                              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">
                                Góc {enrollStep}/3
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="relative z-10 flex items-center justify-between text-[11px] font-bold text-white bg-slate-900/65 px-2.5 py-1 rounded-lg">
                          <span className="text-emerald-300">
                            Độ sáng khung hình: 94% · Rõ nét
                          </span>
                          <span className="font-mono text-amber-300">
                            Góc chụp {enrollStep}/3
                          </span>
                        </div>
                        <div className="relative z-10 p-2.5 rounded-lg bg-slate-900/75 border border-emerald-400/40 text-xs text-white">
                          <p className="font-bold text-emerald-300">
                            {enrollStep === 1 &&
                              'Bước 5 (Góc 1/3): Hướng dẫn nhân viên NHÌN THẲNG vào khung nhận diện'}
                            {enrollStep === 2 &&
                              'Bước 5 (Góc 2/3): Hướng dẫn nhân viên QUAY NHẸ SANG TRÁI (15°)'}
                            {enrollStep === 3 &&
                              'Bước 5–6 (Góc 3/3 + Liveness): QUAY NHẸ SANG PHẢI & NHÁY MẮT xác nhận thực thể sống'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid="btn-capture-enroll-step"
                        onClick={() => {
                          if (enrollStep < 3) {
                            setEnrollStep((s) => (s + 1) as 1 | 2 | 3);
                          } else {
                            const tsStr = getServerTimestampDisplay();
                            const newHash = `EMB-SHA256-${enrollingEmp.code.replace('-', '')}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
                            setEmployees((prev) =>
                              prev.map((item) =>
                                item.code === enrollingEmp.code
                                  ? {
                                      ...item,
                                      faceEnrolled: true,
                                      enrolledAngles: 3,
                                      biometricTemplateHash: newHash,
                                      consentSignedAt: tsStr,
                                      dataRetentionUntil:
                                        '12 tháng (Xóa ngay khi nghỉ việc)',
                                    }
                                  : item
                              )
                            );

                            const logEntry: ActivityLogRecord = {
                              id: `demo-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                              ownerId: 'demo-user',
                              actorName: `${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`,
                              actorUid: userProfile.uid,
                              actorRole: userProfile.role,
                              timestampStr: tsStr,
                              moduleName: 'Nhân sự',
                              actionType: 'Đăng ký mẫu thử DEMO',
                              targetCode: enrollingEmp.code,
                              previousValue: enrollingEmp.faceEnrolled
                                ? `Đã đăng ký (${enrollingEmp.biometricTemplateHash})`
                                : 'Chưa đăng ký khuôn mặt',
                              newValue: 'Đã thực hiện mô phỏng 3 góc; chưa có mẫu sinh trắc thật',
                              reason: `Nhân viên ${enrollingEmp.fullName} đã ký đồng ý bảo vệ dữ liệu sinh trắc học`,
                              resultStatus: 'Thành công',
                              createdAt: new Date().toISOString(),
                            };
                            setDemoActivityLogs((prev) => [logEntry, ...prev]);

                            pushToast(
                              'Đã hoàn thành đăng ký mô phỏng DEMO',
                              `Mã mẫu thử (${newHash}) cho ${enrollingEmp.fullName} (${enrollingEmp.code}).`,
                              'success'
                            );
                            closeEnrollmentModal();
                          }
                        }}
                        className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                      >
                        {enrollStep < 3
                          ? `Xác nhận đạt chất lượng góc ${enrollStep}/3 & Tiếp tục`
                          : 'Bước 7–8: Hoàn tất trích xuất mẫu 1:1 & Lưu bảo mật'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 5. CÂN NHỰA (PHIẾU CÂN THU MUA NHỰA PHẾ LIỆU & XUẤT BÁN)          */}
        {/* ================================================================= */}
        {activeTab === 'weighing' && (
          <div className="space-y-6" data-testid="page-weighing">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Quản Lý Phiếu Cân Nhựa Phế Liệu & Xuất Bán Mảnh Nhựa Đã Băm
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Trọng lượng thực nhận = Trọng lượng tổng − Trọng lượng bì · Khối lượng tính tiền = Thực nhận − Trừ tạp chất · Thành tiền = KL tính tiền × Đơn giá.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-open-weigh-in"
                  onClick={() => setActiveModal('purchase_in')}
                  className="px-4 py-2 rounded-lg bg-[#0F2942] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  + Lập Phiếu Cân Nhập Nhựa
                </button>
                <button
                  type="button"
                  data-testid="btn-open-weigh-out"
                  onClick={() => setActiveModal('sales_out')}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-600 cursor-pointer"
                >
                  + Xuất Bán Nhựa Đã Băm
                </button>
                <button
                  type="button"
                  data-testid="btn-toggle-plastic-types"
                  onClick={() => setShowPlasticTypeManager((v) => !v)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  Danh Mục Loại Nhựa (
                  {plasticTypes.filter((p) => !p.isHidden).length}/
                  {plasticTypes.length})
                </button>
                <button
                  type="button"
                  data-testid="btn-migrate-legacy-plastic"
                  onClick={handleMigrateLegacyRubberData}
                  className="px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs font-bold text-amber-900 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                >
                  Chuẩn Hóa Dữ Liệu Cũ → Nhựa
                </button>
              </div>
            </div>

            {/* 4 Ô Tổng Hợp Nhanh Trạm Cân Nhựa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <span className="text-xs font-semibold text-slate-500">
                  Nhựa phế liệu thu mua hôm nay
                </span>
                <p className="mt-1.5 text-lg font-extrabold font-mono text-slate-900 dark:text-white">
                  {formatWeight(
                    activeTickets
                      .filter((t) => t.ticketType === 'purchase_in')
                      .reduce((s, t) => s + t.netKg, 0),
                    settings.weightUnit,
                    settings.weightDecimals
                  )}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  PET, HDPE, PP, LDPE, Nhựa cứng...
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <span className="text-xs font-semibold text-slate-500">
                  Mảnh nhựa đã băm xuất bán
                </span>
                <p className="mt-1.5 text-lg font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                  {formatWeight(
                    activeTickets
                      .filter((t) => t.ticketType === 'sales_out')
                      .reduce((s, t) => s + t.netKg, 0),
                    settings.weightUnit,
                    settings.weightDecimals
                  )}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Mảnh nhựa sạch đóng bao 25kg/50kg
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <span className="text-xs font-semibold text-slate-500">
                  Công nợ phải trả vựa nhựa
                </span>
                <p className="mt-1.5 text-lg font-extrabold font-mono text-rose-700 dark:text-rose-400">
                  {formatCurrencyVND(metrics.totalPayables)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tự động cộng khi cân nhập chưa trả đủ
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <span className="text-xs font-semibold text-slate-500">
                  Công nợ phải thu khách mua nhựa
                </span>
                <p className="mt-1.5 text-lg font-extrabold font-mono text-amber-700 dark:text-amber-400">
                  {formatCurrencyVND(metrics.totalReceivables)}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tự động cộng khi xuất nhựa băm khách nợ
                </p>
              </div>
            </div>

            {/* Khu vực Quản lý Danh mục Loại Nhựa (Thêm / Sửa đơn giá / Ẩn-Hiện) */}
            {showPlasticTypeManager && (
              <div
                data-testid="plastic-type-manager"
                className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-slate-900 p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Quản Lý Danh Mục Loại Nhựa Phế Liệu (Thêm, Sửa Đơn Giá, Ẩn/Hiện)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Hỗ trợ đầy đủ: PET, HDPE, LDPE, PP, PE, PS, Nhựa cứng, Nhựa mềm, Nhựa hỗn hợp, Loại khác.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlasticTypeManager(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Thu gọn ×
                  </button>
                </div>

                {/* Form thêm loại nhựa mới */}
                <form
                  onSubmit={handleAddPlasticType}
                  className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800"
                >
                  <input
                    type="text"
                    placeholder="Mã (VD: ABS)"
                    value={newPlasticCode}
                    onChange={(e) => setNewPlasticCode(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Tên loại nhựa mới *"
                    value={newPlasticName}
                    onChange={(e) => setNewPlasticName(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="Giá gợi ý (đ/kg)"
                    value={newPlasticPrice}
                    onChange={(e) => setNewPlasticPrice(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Mô tả đặc điểm nhựa..."
                    value={newPlasticDesc}
                    onChange={(e) => setNewPlasticDesc(e.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2 cursor-pointer"
                  >
                    + Thêm Loại Nhựa
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {plasticTypes.map((pt) => (
                    <div
                      key={pt.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        pt.isHidden
                          ? 'border-slate-200 bg-slate-100/60 opacity-60 dark:border-slate-800 dark:bg-slate-800/30'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {pt.name}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {pt.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {pt.description}
                      </p>
                      {editingPlasticId === pt.id ? (
                        <div className="flex items-center gap-1 pt-1">
                          <input
                            type="number"
                            value={editingPlasticPrice}
                            onChange={(e) =>
                              setEditingPlasticPrice(e.target.value)
                            }
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePlasticPrice(pt)}
                            className="px-2 py-1 rounded bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Lưu
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrencyVND(pt.defaultPriceKg)}/kg
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlasticId(pt.id);
                                setEditingPlasticPrice(
                                  String(pt.defaultPriceKg)
                                );
                              }}
                              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-semibold hover:bg-slate-100 cursor-pointer"
                            >
                              Sửa giá
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleHidePlasticType(pt)}
                              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-semibold hover:bg-slate-100 cursor-pointer"
                            >
                              {pt.isHidden ? 'Hiện' : 'Ẩn'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bảng Danh Sách Phiếu Cân Nhựa Đầy Đủ Trường */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table
                  className="w-full min-w-[1280px] text-left border-collapse"
                  data-testid="weighing-table"
                >
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-4 font-semibold">
                        Mã phiếu & Ngày giờ cân
                      </th>
                      <th className="py-3 px-3 font-semibold">Nghiệp vụ</th>
                      <th className="py-3 px-3 font-semibold">
                        Nhà cung cấp / Người giao / Xe
                      </th>
                      <th className="py-3 px-3 font-semibold">Loại nhựa</th>
                      <th className="py-3 px-3 text-right font-semibold">
                        TL Tổng / Bì / Thực nhận
                      </th>
                      <th className="py-3 px-3 text-right font-semibold">
                        Trừ tạp chất & KL tính tiền
                      </th>
                      <th className="py-3 px-3 text-right font-semibold">
                        Đơn giá & Thành tiền
                      </th>
                      <th className="py-3 px-3 text-right font-semibold">
                        Còn nợ
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        Ghi chú & Ảnh phiếu
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {activeTickets
                      .filter((tk) => tk.ticketType !== 'production_batch')
                      .map((tk) => {
                        const actualReceivedKg = Math.max(
                          0,
                          tk.grossKg - tk.tareKg
                        );
                        return (
                          <tr
                            key={tk.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {tk.ticketCode}
                              <p className="font-normal text-slate-500">
                                {tk.dateStr}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-xs font-semibold whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md ${
                                  tk.ticketType === 'purchase_in'
                                    ? 'bg-sky-50 text-[#0F2942] border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                                }`}
                              >
                                {tk.ticketType === 'purchase_in'
                                  ? 'Nhập mua nhựa phế liệu'
                                  : 'Xuất bán nhựa đã băm'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs min-w-[240px] max-w-[280px]">
                              <p title={tk.partnerName} className="font-bold text-slate-900 dark:text-white truncate">
                                {tk.partnerName}
                              </p>
                              <p className="text-slate-600 dark:text-slate-400">
                                Người giao:{' '}
                                <strong>
                                  {tk.delivererName || 'Tài xế giao hàng'}
                                </strong>
                                {tk.vehiclePlate
                                  ? ` · Xe: ${tk.vehiclePlate}`
                                  : ''}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-xs">
                              <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                {tk.rubberType}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <div>
                                Tổng: {tk.grossKg.toLocaleString('vi-VN')} kg ·
                                Bì: {tk.tareKg.toLocaleString('vi-VN')} kg
                              </div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                Thực nhận:{' '}
                                {actualReceivedKg.toLocaleString('vi-VN')} kg
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap">
                              <div className="text-amber-700 dark:text-amber-400">
                                Trừ tạp chất: -
                                {(tk.deductionKg || 0).toLocaleString('vi-VN')}{' '}
                                kg
                              </div>
                              <div className="font-extrabold text-emerald-700 dark:text-emerald-400">
                                KL tính tiền:{' '}
                                {formatWeight(
                                  tk.netKg,
                                  settings.weightUnit,
                                  settings.weightDecimals
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap">
                              <div className="text-slate-500">
                                {tk.unitPrice > 0
                                  ? `${formatCurrencyVND(tk.unitPrice)}/kg`
                                  : '—'}
                              </div>
                              <div className="font-extrabold text-slate-900 dark:text-white">
                                {tk.totalAmount > 0
                                  ? formatCurrencyVND(tk.totalAmount)
                                  : '—'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-xs font-bold whitespace-nowrap">
                              {tk.debtAmount > 0 ? (
                                <span className="text-rose-700 dark:text-rose-400">
                                  {formatCurrencyVND(tk.debtAmount)}
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  Đã tất toán
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                              <p className="line-clamp-2">
                                {tk.notes ||
                                  'Đã kiểm tra phân loại & trừ tạp chất tại bàn cân'}
                              </p>
                              {tk.photoUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewPhotoUrl(tk.photoUrl || null)
                                  }
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#0F2942] dark:text-sky-400 hover:underline cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Xem ảnh phiếu cân</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal xem ảnh phiếu cân đính kèm */}
            {previewPhotoUrl && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
                role="dialog"
                aria-modal="true"
              >
                <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Ảnh Chứng Từ Phiếu Cân Nhựa Phế Liệu
                    </h3>
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoUrl(null)}
                      className="text-xs font-bold text-slate-500 cursor-pointer"
                    >
                      Đóng ×
                    </button>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4 flex items-center justify-center">
                    <img
                      src={previewPhotoUrl}
                      alt="Ảnh phiếu cân nhựa"
                      className="max-h-64 object-contain rounded"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 6. PHÂN LOẠI & BĂM NHỰA (MẺ BĂM, THỐNG KÊ CA/MÁY & BẢO TRÌ)       */}
        {/* ================================================================= */}
        {activeTab === 'production' && (
          <div className="space-y-6" data-testid="page-production">
            <FactoryOpsDemo tickets={activeTickets} machines={envMode === 'demo' ? machines : []}
              mode={envMode} onLog={recordDemoModuleLog} />
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Quản Lý Phân Loại & Băm Nhựa Phế Liệu Theo Ca / Máy Băm
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sản lượng nhựa đã băm hôm nay:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                      {formatWeight(
                        metrics.rubberShreddedTodayKg,
                        settings.weightUnit,
                        settings.weightDecimals
                      )}
                    </strong>{' '}
                    · Tự động tính Phế phẩm, Hao hụt và Tỷ lệ thu hồi mảnh nhựa sạch.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="btn-toggle-batch-form"
                  onClick={() => setShowBatchForm((v) => !v)}
                  className="px-4 py-2 rounded-lg bg-[#0F2942] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  {showBatchForm
                    ? 'Thu gọn biểu mẫu'
                    : '+ Ghi Nhận Mẻ Phân Loại & Băm Nhựa'}
                </button>
              </div>

              {/* Form Lập Mẻ Phân Loại & Băm Nhựa Mới */}
              {showBatchForm && (
                <form
                  onSubmit={handleCreateShreddingBatch}
                  data-testid="shredding-batch-form"
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4"
                >
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Nhập Thông Tin Mẻ Phân Loại & Băm Nhựa Mới
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ngày sản xuất
                      </label>
                      <input
                        type="text"
                        value={batchDate}
                        onChange={(e) => setBatchDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ca làm việc
                      </label>
                      <select
                        value={batchShift}
                        onChange={(e) => setBatchShift(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                      >
                        {shifts.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Công nhân thực hiện
                      </label>
                      <select
                        value={batchWorker}
                        onChange={(e) => setBatchWorker(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                      >
                        {employees.map((emp) => (
                          <option key={emp.code} value={emp.fullName}>
                            {emp.fullName} ({emp.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Máy băm vận hành
                      </label>
                      <select
                        value={batchMachine}
                        onChange={(e) => setBatchMachine(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                      >
                        {machines.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Loại nhựa đầu vào
                      </label>
                      <select
                        value={batchPlasticType}
                        onChange={(e) => setBatchPlasticType(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                      >
                        {plasticTypes
                          .filter((p) => !p.isHidden)
                          .map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        KL đầu vào (kg) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={batchInputKg}
                        onChange={(e) => setBatchInputKg(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        KL nhựa sau băm (kg) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={batchOutputKg}
                        onChange={(e) => setBatchOutputKg(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Phế phẩm tách ra (kg)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={batchScrapKg}
                        onChange={(e) => setBatchScrapKg(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Hao hụt tự tính (kg)
                      </label>
                      <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-rose-700 dark:text-rose-400">
                        {Math.max(
                          0,
                          (Number(batchInputKg) || 0) -
                            (Number(batchOutputKg) || 0) -
                            (Number(batchScrapKg) || 0)
                        ).toLocaleString('vi-VN')}{' '}
                        kg
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <input
                      type="text"
                      value={batchNotes}
                      onChange={(e) => setBatchNotes(e.target.value)}
                      placeholder="Ghi chú mẻ băm (kích thước lưới sàng, độ ẩm, chất lượng mảnh nhựa)..."
                      className="flex-1 min-w-[240px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      data-testid="btn-save-shredding-batch"
                      className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Lưu Mẻ Băm & Cập Nhật Kho Nhựa
                    </button>
                  </div>
                </form>
              )}

              {/* Bảng Thống Kê Sản Lượng Băm Nhựa Theo Ngày, Ca, Máy */}
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left border-collapse"
                  data-testid="production-batches-table"
                >
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-3 font-semibold">
                        Mã mẻ & Ngày sản xuất
                      </th>
                      <th className="py-3 px-3 font-semibold">
                        Ca làm việc & Công nhân
                      </th>
                      <th className="py-3 px-3 font-semibold">
                        Máy băm & Loại nhựa đầu vào
                      </th>
                      <th className="py-3 px-3 text-right font-semibold">
                        KL đầu vào
                      </th>
                      <th className="py-3 px-3 text-right font-semibold">
                        KL nhựa sau băm
                      </th>
                      <th className="py-3 px-3 text-right font-semibold">
                        Phế phẩm / Hao hụt
                      </th>
                      <th className="py-3 px-3 text-right font-semibold">
                        Tỷ lệ thu hồi
                      </th>
                      <th className="py-3 px-3 font-semibold">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {activeTickets
                      .filter((t) => t.ticketType === 'production_batch')
                      .map((batch) => {
                        const bal = calculateProductionBalance(
                          batch.grossKg,
                          batch.outputKg ?? batch.netKg,
                          batch.scrapKg ?? 0
                        );
                        return (
                          <tr key={batch.id}>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {batch.ticketCode}
                              <p className="font-normal text-slate-500">
                                {batch.dateStr}
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">
                                {batch.shiftName || 'Ca sáng (06:30 - 14:30)'}
                              </p>
                              <p className="text-slate-500">
                                CN:{' '}
                                {batch.operatorName ||
                                  batch.delivererName ||
                                  'Nguyễn Văn Hùng'}
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-bold text-slate-900 dark:text-white">
                                {batch.machineName || batch.partnerName}
                              </p>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
                                Nhựa: {batch.rubberType}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {formatWeight(
                                batch.grossKg,
                                settings.weightUnit,
                                settings.weightDecimals
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                              {formatWeight(
                                batch.outputKg ?? batch.netKg,
                                settings.weightUnit,
                                settings.weightDecimals
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                              <div className="text-amber-700 dark:text-amber-400">
                                Phế phẩm: {batch.scrapKg ?? 0} kg
                              </div>
                              <div className="text-rose-700 dark:text-rose-400 font-semibold">
                                Hao hụt: {bal.lossKg} kg
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold">
                                {bal.recoveryRatePercent}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-xs">
                              {batch.notes ||
                                'Băm mảnh nhựa sạch đạt chuẩn đóng bao'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Theo Dõi Tình Trạng Máy Băm & Lịch Bảo Trì Dao Băm */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-[#0F2942] dark:text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Theo Dõi Tình Trạng Máy Băm Nhựa & Bảo Trì Lưỡi Dao
                    </h3>
                    <p className="text-xs text-slate-500">
                      Quản lý công suất vận hành, số giờ chạy lũy kế và lịch mài/thay bộ dao băm SKD11.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {machines.map((mac) => (
                  <div
                    key={mac.id}
                    data-testid={`machine-card-${mac.code}`}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-[#0F2942] text-white">
                        {mac.code}
                      </span>
                      <select
                        aria-label={`Trạng thái ${mac.code}`}
                        value={mac.status}
                        onChange={(e) =>
                          handleUpdateMachineStatus(
                            mac,
                            e.target.value as ShredderMachine['status']
                          )
                        }
                        className={`rounded-md px-2.5 py-1 text-xs font-bold border cursor-pointer ${
                          mac.status === 'Đang chạy'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : mac.status === 'Chờ bảo trì' ||
                                mac.status === 'Đang bảo trì'
                              ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-sky-100 text-sky-800 border-sky-300'
                        }`}
                      >
                        <option value="Đang chạy">Đang chạy</option>
                        <option value="Sẵn sàng">Sẵn sàng</option>
                        <option value="Chờ bảo trì">Chờ bảo trì</option>
                        <option value="Đang bảo trì">Đang bảo trì</option>
                      </select>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {mac.name}
                    </p>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <p>
                        <strong>Bộ dao:</strong> {mac.bladeType}
                      </p>
                      <p>
                        <strong>Công suất:</strong>{' '}
                        <span className="font-mono font-bold">
                          {mac.capacityKgPerHour} kg/giờ
                        </span>{' '}
                        · Đã chạy:{' '}
                        <span className="font-mono font-bold">
                          {mac.totalHoursRun} giờ
                        </span>
                      </p>
                      <p>
                        <strong>Bảo trì gần nhất:</strong>{' '}
                        {mac.lastMaintenanceDate}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200">
                      <strong>Lịch bảo trì tiếp theo:</strong>{' '}
                      {mac.nextMaintenanceNote}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 7. KHO NHỰA (6 NHÓM TỒN KHO NHỰA PHẾ LIỆU, ĐÃ BĂM & VẬT TƯ)        */}
        {/* ================================================================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-6" data-testid="page-inventory">
            <StockLedgerPanel items={envMode === 'demo' ? inventoryItems : []}
              movements={envMode === 'demo' ? demoStockMovements : []} mode={envMode} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Quản Lý Kho Nhựa Phế Liệu, Nhựa Đã Băm & Vật Tư Nhà Xưởng
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi 6 nhóm kho tiêu chuẩn: Nhựa phế liệu chưa phân loại · Nhựa đã phân loại · Nhựa chờ băm · Nhựa đã băm · Phế phẩm · Vật tư.
                </p>
              </div>
              <button
                type="button"
                data-testid="btn-toggle-inventory-form"
                onClick={() => setShowInventoryForm((v) => !v)}
                className="px-4 py-2 rounded-lg bg-[#0F2942] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                {showInventoryForm
                  ? 'Thu gọn biểu mẫu'
                  : '+ Ghi Nhận Nhập / Xuất Kho Nhựa'}
              </button>
            </div>

            {/* 6 Ô Tổng Hợp Theo 6 Nhóm Kho Nhựa Bắt Buộc */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {PLASTIC_INVENTORY_CATEGORIES.map((cat) => {
                const catItems = inventoryItems.filter(
                  (i) => i.category === cat
                );
                const totalIn = catItems.reduce((s, i) => s + i.inWeightKg, 0);
                const totalOut = catItems.reduce(
                  (s, i) => s + i.outWeightKg,
                  0
                );
                const totalStock = catItems.reduce(
                  (s, i) => s + i.stockWeightKg,
                  0
                );
                const unitLabel = cat === 'Vật tư' ? 'Cái/Bộ' : settings.weightUnit;
                const isSelected = inventoryCategoryFilter === cat;
                return (
                  <div
                    key={cat}
                    onClick={() =>
                      setInventoryCategoryFilter(isSelected ? 'all' : cat)
                    }
                    className={`rounded-xl border p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/30 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {cat}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {catItems.length} mặt hàng
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-extrabold font-mono text-[#0F2942] dark:text-emerald-400">
                      {cat === 'Vật tư'
                        ? `${totalStock.toLocaleString('vi-VN')} ${unitLabel}`
                        : formatWeight(
                            totalStock,
                            settings.weightUnit,
                            settings.weightDecimals
                          )}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>
                        Nhập: +{totalIn.toLocaleString('vi-VN')}{' '}
                        {cat === 'Vật tư' ? 'Cái' : 'kg'}
                      </span>
                      <span>
                        Xuất: -{totalOut.toLocaleString('vi-VN')}{' '}
                        {cat === 'Vật tư' ? 'Cái' : 'kg'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Biểu mẫu Ghi nhận Nhập / Xuất Kho Nhựa trực tiếp */}
            {showInventoryForm && (
              <form
                onSubmit={handleSaveInventoryMovement}
                data-testid="inventory-movement-form"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3"
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cập Nhật Nhập / Xuất Kho Nhựa & Vật Tư
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Loại nghiệp vụ kho
                    </label>
                    <select
                      value={invMoveType}
                      onChange={(e) =>
                        setInvMoveType(e.target.value as 'in' | 'out')
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                    >
                      <option value="in">Nhập kho (+)</option>
                      <option value="out">Xuất kho (-)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mặt hàng kho nhựa / vật tư
                    </label>
                    <select
                      value={invTargetId}
                      onChange={(e) => setInvTargetId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                    >
                      {inventoryItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          [{it.category}] {it.name} (Tồn:{' '}
                          {it.stockWeightKg.toLocaleString('vi-VN')} {it.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Số lượng (kg / Cái) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={invMoveKg}
                      onChange={(e) => setInvMoveKg(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    type="text"
                    value={invMoveNote}
                    onChange={(e) => setInvMoveNote(e.target.value)}
                    placeholder="Ghi chú nguyên nhân nhập/xuất kho..."
                    className="flex-1 min-w-[220px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Xác Nhận Cập Nhật Kho
                  </button>
                </div>
              </form>
            )}

            {/* Bảng Chi Tiết 6 Nhóm Kho Nhựa (Nhập – Xuất – Tồn Kho) */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-[#0F2942] dark:text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Bảng Tổng Hợp Nhập – Xuất – Tồn Kho Nhựa & Vật Tư
                  </h3>
                </div>
                {inventoryCategoryFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setInventoryCategoryFilter('all')}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Hiển thị tất cả 6 nhóm kho →
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table
                  className="w-full text-left border-collapse text-xs"
                  data-testid="inventory-items-table"
                >
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 pr-3 font-semibold">Mã kho</th>
                      <th className="py-2.5 px-3 font-semibold">
                        Nhóm kho (6 nhóm)
                      </th>
                      <th className="py-2.5 px-3 font-semibold">
                        Tên mặt hàng & Vị trí lưu kho
                      </th>
                      <th className="py-2.5 px-3 font-semibold">Loại nhựa</th>
                      <th className="py-2.5 px-3 text-right font-semibold">
                        Tổng Nhập
                      </th>
                      <th className="py-2.5 px-3 text-right font-semibold">
                        Tổng Xuất
                      </th>
                      <th className="py-2.5 pl-3 text-right font-semibold">
                        Tồn Kho Hiện Tại
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {inventoryItems
                      .filter(
                        (item) =>
                          inventoryCategoryFilter === 'all' ||
                          item.category === inventoryCategoryFilter
                      )
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 pr-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {item.code}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {item.name}
                            </p>
                            <p className="text-slate-500">
                              Vị trí: {item.location} · Cập nhật:{' '}
                              {item.updatedAt}
                            </p>
                            {item.note && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {item.note}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                            {item.plasticType}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            +{item.inWeightKg.toLocaleString('vi-VN')}{' '}
                            {item.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-rose-700 dark:text-rose-400 whitespace-nowrap">
                            -{item.outWeightKg.toLocaleString('vi-VN')}{' '}
                            {item.unit}
                          </td>
                          <td className="py-3 pl-3 text-right font-mono font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                            {item.unit === 'kg'
                              ? formatWeight(
                                  item.stockWeightKg,
                                  settings.weightUnit,
                                  settings.weightDecimals
                                )
                              : `${item.stockWeightKg.toLocaleString('vi-VN')} ${item.unit}`}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lịch sử biến động từ Phiếu cân nhựa & Mẻ băm nhựa */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Thẻ Kho & Lịch Sử Chứng Từ Nhập – Xuất – Băm Nhựa Gần Đây
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 pr-3 font-semibold">Mã chứng từ</th>
                      <th className="py-2.5 px-3 font-semibold">Ngày giờ</th>
                      <th className="py-2.5 px-3 font-semibold">
                        Loại biến động kho nhựa
                      </th>
                      <th className="py-2.5 px-3 font-semibold">
                        Chủng loại nhựa
                      </th>
                      <th className="py-2.5 pl-3 text-right font-semibold">
                        Khối lượng thực tế
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {activeTickets.map((tk) => (
                      <tr key={tk.id}>
                        <td className="py-2.5 pr-3 font-mono font-bold">
                          {tk.ticketCode}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {tk.dateStr}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {tk.ticketType === 'purchase_in'
                            ? 'Nhập kho nhựa phế liệu (+)'
                            : tk.ticketType === 'production_batch'
                              ? 'Phân loại & Băm thành mảnh nhựa sạch'
                              : 'Xuất kho bán nhựa đã băm (-)'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-800 dark:text-emerald-300">
                          {tk.rubberType}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono font-bold">
                          {formatWeight(
                            tk.netKg,
                            settings.weightUnit,
                            settings.weightDecimals
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 8. BÁO CÁO (BIỂU ĐỒ THU CHI, CÔNG NỢ & NGHIỆM THU)                */}
        {/* ================================================================= */}
        {activeTab === 'reports' && (
          <div className="space-y-6" data-testid="page-reports">
            <OperationsSummary tickets={activeTickets} transactions={activeTransactions}
              items={envMode === 'demo' ? inventoryItems : []} mode={envMode} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Biểu đồ dòng tiền */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-800">
                  Báo Cáo Dòng Tiền & Cơ Cấu Quỹ Xưởng Dư-Nhựa Phế Liệu
                </h2>
                <div className="mt-4 space-y-4">
                  {(() => {
                    const maxVal = Math.max(
                      metrics.monthlyIncome,
                      metrics.monthlyExpense,
                      metrics.cashBalance,
                      metrics.bankBalance,
                      1
                    );
                    const bars = [
                      {
                        label: 'Tổng Thu Tháng Này',
                        value: metrics.monthlyIncome,
                        pct: Math.round((metrics.monthlyIncome / maxVal) * 100),
                        color: 'bg-emerald-600',
                      },
                      {
                        label: 'Tổng Chi Tháng Này',
                        value: metrics.monthlyExpense,
                        pct: Math.round(
                          (metrics.monthlyExpense / maxVal) * 100
                        ),
                        color: 'bg-rose-600',
                      },
                      {
                        label: 'Số Dư Quỹ Tiền Mặt',
                        value: metrics.cashBalance,
                        pct: Math.round((metrics.cashBalance / maxVal) * 100),
                        color: 'bg-sky-600',
                      },
                      {
                        label: 'Số Dư Quỹ Ngân Hàng',
                        value: metrics.bankBalance,
                        pct: Math.round((metrics.bankBalance / maxVal) * 100),
                        color: 'bg-[#0F2942] dark:bg-indigo-500',
                      },
                    ];

                    return bars.map((b) => (
                      <div key={b.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {b.label}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrencyVND(b.value)}
                          </span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${b.color}`}
                            style={{ width: `${Math.max(4, b.pct)}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Báo cáo công nợ phải thu / phải trả */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-800">
                  Báo Cáo Công Nợ Mua Nhựa Phế Liệu & Bán Nhựa Đã Băm
                </h2>
                <div className="grid grid-cols-2 gap-3 my-3">
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Tổng phải thu khách mua nhựa
                    </span>
                    <p className="text-base font-mono font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">
                      {formatCurrencyVND(metrics.totalReceivables)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Tổng phải trả vựa nhựa phế liệu
                    </span>
                    <p className="text-base font-mono font-extrabold text-rose-700 dark:text-rose-400 mt-0.5">
                      {formatCurrencyVND(metrics.totalPayables)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5 mt-3">
                  {activeTickets
                    .filter((t) => t.debtAmount > 0)
                    .map((debtTk) => (
                      <div
                        key={debtTk.id}
                        className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 last:border-none"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {debtTk.partnerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {debtTk.ticketCode} · Loại nhựa: {debtTk.rubberType}{' '}
                            · Ngày: {debtTk.dateStr}
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400">
                          {formatCurrencyVND(debtTk.debtAmount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Báo cáo nghiệm thu hệ thống */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Báo Cáo Nghiệm Thu Hệ Thống Dư-Nhựa Phế Liệu & Trạng Thái Thực Thi
                </h2>
              </div>
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p>
                  <strong>1. Thương hiệu & Bộ Logo Phong Thủy:</strong> Đã nâng cấp toàn diện sang <strong>Dư-Nhựa phế liệu – Quản lý xưởng phân loại, băm nhựa phế liệu</strong> kèm 3 phương án Logo phong thủy (Phương án A là bộ nhận diện chính thức) và 14 file SVG/PNG/ICO chuẩn PWA.
                </p>
                <p>
                  <strong>2. Nghiệp vụ Nhựa Phế Liệu & Bảo Toàn Dữ Liệu:</strong> Đầy đủ 10 phân hệ trên Sidebar (#0F2942), Cân nhựa phế liệu (PET, HDPE, LDPE, PP, PE, PS, Nhựa cứng, Nhựa mềm, Nhựa hỗn hợp, Loại khác), Phân loại & Băm nhựa, Kho nhựa 6 nhóm, giữ nguyên 100% số dư Sổ Thu – Chi và lịch sử Cloud Firestore.
                </p>
                <p>
                  <strong>3. Camera Chấm Công Khuôn Mặt:</strong> Đã khắc phục triệt để lỗi khung hình đen bằng kiến trúc luôn gắn thẻ <code className="font-mono">&lt;video&gt;</code> trong DOM, kiểm tra luồng khung hình thực tế và cung cấp khung quang học sáng rõ kèm 6 nút điều khiển và Chấm công dự phòng.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 9. NHẬT KÝ HOẠT ĐỘNG (AUDIT LOG)                                   */}
        {/* ================================================================= */}
        {activeTab === 'activity_log' && (
          <ActivityLogView
            logs={activeActivityLogs}
            userRole={userProfile.role}
            onPermissionDenied={handlePermissionDenied}
          />
        )}

        {/* ================================================================= */}
        {/* 10. CÀI ĐẶT (ĐƠN VỊ ĐO, PHÂN QUYỀN, LOGO PWA & SQL MIGRATION)     */}
        {/* ================================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6" data-testid="page-settings">
            <ReleaseReadiness />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <Settings className="w-5 h-5 text-[#0F2942] dark:text-emerald-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Thiết Lập Đơn Vị Đo Lường Nhựa & Phân Quyền Nhà Xưởng
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="cfg-unit"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Đơn vị khối lượng nhựa hiển thị
                    </label>
                    <select
                      id="cfg-unit"
                      value={settings.weightUnit}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          weightUnit: e.target.value as 'kg' | 'tan',
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="kg">Kilôgam (kg)</option>
                      <option value="tan">Tấn (tấn)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="cfg-decimals"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Số chữ số thập phân khối lượng
                    </label>
                    <select
                      id="cfg-decimals"
                      value={settings.weightDecimals}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          weightDecimals: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value={0}>0 chữ số thập phân (Làm tròn)</option>
                      <option value={1}>1 chữ số thập phân (0,0)</option>
                      <option value={2}>2 chữ số thập phân (0,00)</option>
                      <option value={3}>3 chữ số thập phân (0,000)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <label
                    htmlFor="cfg-role"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Mô phỏng kiểm thử phân quyền 5 vai trò tại xưởng Dư-Nhựa phế liệu
                  </label>
                  <select
                    id="cfg-role"
                    disabled={envMode === 'production'}
                    title={envMode === 'production' ? 'Vai trò thực tế do Firestore cấp, không thể đổi tại đây' : 'Kiểm thử quyền DEMO'}
                    value={userProfile.role}
                    onChange={(e) =>
                      handleChangeRole(e.target.value as UserRole)
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r].name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Phạm vi quyền hạn:{' '}
                    {ROLE_LABELS[userProfile.role].permissionsSummary}
                  </p>
                </div>
              </div>

              {/* Kết nối tài khoản đám mây Firebase */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-800">
                  Tài Khoản & Đồng Bộ Cơ Sở Dữ Liệu Cloud Firestore
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {firebaseUser
                    ? `Đang đăng nhập với tài khoản: ${firebaseUser.email}`
                    : 'Bạn đang ở chế độ xem nhanh. Đăng nhập Google để lưu trữ dữ liệu thật trên Cloud Firestore.'}
                </p>
                <div className="flex items-center gap-3">
                  {!firebaseUser ? (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-600 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Đăng nhập Google</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => signOut(auth)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-700 text-white text-xs font-bold hover:bg-rose-600 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bộ nhận diện thương hiệu & Icon PWA */}
            <BrandAssetShowcase />

            {/* Collapsible Advanced SQL Migration & Deployment Guide */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database className="w-5 h-5 text-[#0F2942] dark:text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      SQL Migration (Nghiệp Vụ Nhựa Phế Liệu) & Hướng Dẫn Triển Khai
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tài liệu kỹ thuật nâng cao (có thể thu gọn)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedConfig((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
                >
                  <span>
                    {showAdvancedConfig
                      ? 'Thu gọn tài liệu'
                      : 'Mở xem SQL & Hướng dẫn'}
                  </span>
                  {showAdvancedConfig ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {showAdvancedConfig && (
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Nội dung SQL Migration (Hệ thống Dư-Nhựa phế liệu):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0F2942] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        {copiedSql
                          ? 'Đã sao chép SQL!'
                          : 'Sao chép SQL Migration'}
                      </span>
                    </button>
                  </div>
                  <pre className="max-h-80 overflow-y-auto rounded-lg bg-slate-950 text-slate-200 p-4 text-xs font-mono leading-relaxed">
                    {SQL_MIGRATION_SCRIPT}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </AppShell>

      {/* TRANSACTION DETAIL / EDIT / CANCEL / RESTORE MODAL */}
      <TransactionDetailModal
        transaction={selectedTx}
        initialMode={selectedTxMode}
        userRole={userProfile.role}
        onClose={() => setSelectedTx(null)}
        onUpdateTransaction={handleUpdateTransaction}
        onCancelTransaction={handleCancelTransactionByObj}
        onRestoreTransaction={handleRestoreTransactionByObj}
        onPermissionDenied={handlePermissionDenied}
      />

      {/* SAFE 5-STEP LEGACY DATA NORMALIZATION & BACKUP MODAL */}
      {showMigrationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          data-testid="migration-safety-modal"
        >
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Công Cụ Chuẩn Hóa Dữ Liệu Cũ Sang Nhựa Phế Liệu (Quy Trình An Toàn 5 Bước)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tuyệt đối không tự động ghi đè khi chưa xem trước, sao lưu và xác nhận riêng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMigrationModal(false)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {/* Bước 1 & 3: Xem trước từng bản ghi & Chỉ rõ các trường sẽ thay đổi */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span>
                  1. Xem trước bản ghi &amp; trường sẽ thay đổi ({migrationPreviewDiffs.length} trường phát hiện thuật ngữ cũ):
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Giữ nguyên 100% số tiền, khối lượng &amp; ngày giờ
                </span>
              </div>

              {migrationPreviewDiffs.length === 0 ? (
                <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                  <strong>Toàn bộ dữ liệu hiện tại đã chuẩn hóa 100% sang thuật ngữ Nhựa phế liệu!</strong> Không phát hiện bản ghi nào còn chứa từ khóa cũ (<em>Mủ nước, Mủ chén, Mủ dây, Cân mủ...</em>). Bạn vẫn có thể tải bản sao lưu JSON hoặc khôi phục từ bản chụp trước đó bên dưới.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {migrationPreviewDiffs.map((item) => (
                    <div key={item.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                      <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                        <span>
                          [{item.recordType}] Mã: <strong className="font-mono">{item.code}</strong>
                        </span>
                        <span className="font-mono text-[11px] text-sky-700 dark:text-sky-400">
                          Trường: {item.fieldName}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                          <strong>Trước:</strong> {item.beforeVal}
                        </div>
                        <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                          <strong>Sau:</strong> {item.afterVal}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bước 2 & 5: Sao lưu JSON & Khôi phục Snapshot */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <strong>2. Sao lưu &amp; Phương án khôi phục:</strong>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tải file JSON sao lưu toàn bộ dữ liệu hoặc khôi phục lại trạng thái trước khi chuẩn hóa.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-export-backup-json"
                  onClick={handleExportFullBackupJson}
                  className="px-3 py-2 rounded-lg bg-[#0F2942] text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  Tải Bản Sao Lưu (.JSON)
                </button>
                {hasMigrationSnapshot && (
                  <button
                    type="button"
                    data-testid="btn-restore-migration-snapshot"
                    onClick={handleRestoreFromMigrationSnapshot}
                    className="px-3 py-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 cursor-pointer"
                  >
                    Khôi Phục Từ Bản Chụp Trước Đó
                  </button>
                )}
              </div>
            </div>

            {/* Bước 4: Xác nhận riêng trước khi thực thi */}
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer text-xs text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                data-testid="checkbox-confirm-migration"
                checked={migrationConfirmed}
                onChange={(e) => setMigrationConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                <strong>Tôi xác nhận đã xem trước danh sách trường thay đổi</strong> và đồng ý chuẩn hóa thuật ngữ sang <strong>Dư-Nhựa phế liệu</strong> (hệ thống tự động tạo bản chụp khôi phục trước khi cập nhật).
              </span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowMigrationModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                data-testid="btn-confirm-safe-migration"
                disabled={!migrationConfirmed}
                onClick={handleExecuteSafeMigration}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                Thực Hiện Chuẩn Hóa An Toàn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ACTION MODALS */}
      <QuickModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        employees={employees}
        shifts={shifts}
        userRole={userProfile.role}
        envMode={envMode}
        loggedInUserName={`${userProfile.displayName} (${ROLE_LABELS[userProfile.role].name})`}
        loggedInEmployeeCode="CN-001"
        existingAttendance={activeAttendance}
        onAttendanceTrace={handleAttendanceTrace}
        currentShreddedStockKg={metrics.shreddedInventoryKg}
        onSaveTransaction={handleSaveTransaction}
        onSaveAttendance={handleSaveAttendance}
        onSaveWeighTicket={handleSaveWeighTicket}
      />
      </React.Suspense>
    </>
  );
}

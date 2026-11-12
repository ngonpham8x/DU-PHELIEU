import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Boxes,
  CalendarCheck,
  Factory,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Settings,
  Sun,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type {
  AppSettings,
  EnvironmentMode,
  UserProfile,
  UserRole,
} from '../types/factory';
import { ROLE_LABELS, TODAY_STR } from '../data/demoSeed';
import { PWAInstallButton } from './PWAInstallButton';

export type NavTab =
  | 'home'
  | 'cashbook'
  | 'attendance'
  | 'hr'
  | 'weighing'
  | 'production'
  | 'inventory'
  | 'reports'
  | 'activity_log'
  | 'settings';

export interface SidebarMenuItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SIDEBAR_MENU_ITEMS: SidebarMenuItem[] = [
  { id: 'home', label: 'Trang chủ', icon: LayoutDashboard },
  { id: 'cashbook', label: 'Thu – Chi', icon: Wallet },
  { id: 'attendance', label: 'Chấm công', icon: CalendarCheck },
  { id: 'hr', label: 'Nhân sự', icon: Users },
  { id: 'weighing', label: 'Cân nhựa', icon: Scale },
  { id: 'production', label: 'Phân loại & Băm nhựa', icon: Factory },
  { id: 'inventory', label: 'Kho nhựa', icon: Boxes },
  { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
  { id: 'activity_log', label: 'Nhật ký hoạt động', icon: History },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

const SIDEBAR_STORAGE_KEY = 'vandu_sidebar_collapsed';

interface AppShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  envMode: EnvironmentMode;
  onChangeEnvMode: (mode: EnvironmentMode) => void;
  settings: AppSettings;
  onToggleDarkMode: () => void;
  userProfile: UserProfile;
  onChangeRole: (role: UserRole) => void;
  firebaseUser: User | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  notificationCount: number;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onSelectTab,
  envMode,
  onChangeEnvMode,
  settings,
  onToggleDarkMode,
  userProfile,
  onChangeRole,
  firebaseUser,
  onGoogleSignIn,
  onGoogleSignOut,
  notificationCount,
  children,
}) => {
  // Desktop sidebar collapsed state persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer open state (< 768px)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // Notification popover state
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
    } catch {
      // Ignore storage quota errors
    }
  }, [isCollapsed]);

  // Close mobile drawer automatically on viewport resize >= 768px
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentMenu =
    SIDEBAR_MENU_ITEMS.find((m) => m.id === activeTab) || SIDEBAR_MENU_ITEMS[0];

  const handleSelectMenu = (tab: NavTab) => {
    onSelectTab(tab);
    setIsMobileOpen(false);
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* MOBILE OVERLAY BACKDROP (< 768px) */}
      {isMobileOpen && (
        <div
          data-testid="mobile-sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* PRIMARY LEFT SIDEBAR (#0F2942) - FULL VIEWPORT HEIGHT */}
      <aside
        id="vandu-primary-sidebar"
        data-testid="primary-sidebar"
        data-collapsed={isCollapsed ? 'true' : 'false'}
        aria-label="Thanh điều hướng chính Dư-Nhựa phế liệu"
        className={`fixed md:sticky top-0 left-0 z-50 h-screen shrink-0 flex flex-col bg-[#0F2942] text-white border-r border-slate-800/80 select-none transition-all duration-200 ease-in-out no-print ${
          isMobileOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-[64px]' : 'md:w-[240px]'}`}
      >
        {/* TOP BRANDING & COLLAPSE BUTTON */}
        <div
          className="relative h-16 shrink-0 flex items-center justify-center border-b border-white/10 px-4"
        >
          <button
            type="button"
            onClick={() => handleSelectMenu('home')}
            title="Dư-Nhựa phế liệu – Quản lý xưởng phân loại, băm nhựa phế liệu"
            aria-label="Về trang chủ Dư-Nhựa phế liệu"
            className="flex items-center justify-center cursor-pointer shrink-0 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-white/20"
          >
            <img
              src="/icon.svg"
              alt="Biểu tượng Dư-Nhựa phế liệu"
              width={44}
              height={44}
              className="w-11 h-11 rounded-full object-contain shrink-0"
            />
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            data-testid="mobile-sidebar-close"
            onClick={() => setIsMobileOpen(false)}
            className="absolute right-4 md:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 10 NAVIGATION ITEMS */}
        <nav
          aria-label="Danh mục chức năng"
          className="flex-1 overflow-y-auto py-3 px-2 space-y-1"
        >
          {SIDEBAR_MENU_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`sidebar-item-${item.id}`}
                onClick={() => handleSelectMenu(item.id)}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative w-full flex items-center gap-3 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isCollapsed
                    ? 'md:justify-center md:px-0 px-3'
                    : 'px-3 justify-start'
                } ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <IconComponent
                  className={`w-5 h-5 shrink-0 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-300 group-hover:text-white'
                  }`}
                />
                <span
                  className={`truncate ${
                    isCollapsed ? 'md:hidden inline' : 'inline'
                  }`}
                >
                  {item.label}
                </span>

                {/* Custom hover tooltip when sidebar is collapsed on desktop */}
                {isCollapsed && (
                  <span
                    role="tooltip"
                    className="hidden md:group-hover:block fixed left-[70px] z-50 px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-bold whitespace-nowrap shadow-lg border border-slate-700 pointer-events-none"
                  >
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* BOTTOM SIDEBAR TOGGLE BUTTON (DESKTOP) */}
        <div className="p-2 border-t border-white/10 shrink-0 hidden md:block">
          <button
            type="button"
            data-testid="sidebar-collapse-toggle"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
            aria-label={isCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
            className={`w-full flex items-center gap-2.5 rounded-lg py-2.5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center px-0' : 'justify-start'
            }`}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <>
                <PanelLeftClose className="w-5 h-5 shrink-0 text-emerald-400" />
                <span className="truncate">Thu gọn menu</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* RIGHT CONTENT WRAPPER (HEADER + MAIN VIEWPORT) */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* TOP HEADER ABOVE CONTENT (NO HORIZONTAL MENU) */}
        <header
          data-testid="top-content-header"
          className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 no-print"
        >
          {/* Left of Header: Mobile Hamburger + Desktop Sidebar Toggle + Page Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              data-testid="mobile-hamburger-btn"
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              data-testid="header-sidebar-toggle"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="hidden md:inline-flex p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              aria-label={
                isCollapsed ? 'Mở rộng menu bên trái' : 'Thu gọn menu bên trái'
              }
              title={
                isCollapsed ? 'Mở rộng menu bên trái' : 'Thu gọn menu bên trái'
              }
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            <div className="min-w-0 shrink-0">
              <h1
                data-testid="header-page-title"
                className="text-sm sm:text-lg font-extrabold text-[#0F2942] dark:text-white whitespace-nowrap"
              >
                {currentMenu.label}
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Ngày làm việc: {TODAY_STR}
              </p>
            </div>
          </div>

          {/* Right of Header: Environment Status, Notifications, Account/Role, PWA Install */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {/* Environment Mode Status Switcher (DEMO vs Production) */}
            <div
              role="group"
              aria-label="Trạng thái môi trường"
              className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <button
                type="button"
                data-testid="env-btn-demo"
                onClick={() => onChangeEnvMode('demo')}
                className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  envMode === 'demo'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                DEMO
              </button>
              <button
                type="button"
                data-testid="env-btn-production"
                onClick={() => onChangeEnvMode('production')}
                className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  envMode === 'production'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Prod
              </button>
            </div>

            {/* Role Selector (for RBAC verification & account context) */}
            <div className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-500 hidden lg:inline" />
              <select
                id="quick-role-select"
                data-testid="quick-role-select"
                aria-label="Vai trò tài khoản"
                disabled={envMode === 'production'}
                title={envMode === 'production' ? 'Quyền thực tế được Firestore cấp' : 'Chuyển vai trò chỉ để kiểm thử DEMO'}
                value={userProfile.role}
                onChange={(e) => onChangeRole(e.target.value as UserRole)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs font-bold text-[#0F2942] dark:text-emerald-400 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed max-w-[88px] sm:max-w-[150px] truncate"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notifications Button */}
            <div className="relative">
              <button
                type="button"
                data-testid="header-notifications-btn"
                onClick={() => setShowNotifications((s) => !s)}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                aria-label="Thông báo nhà xưởng"
                title="Thông báo nhà xưởng"
              >
                <Bell className="w-4 h-4" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3.5 z-50 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span>Thông báo hệ thống ({notificationCount})</span>
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    • Môi trường hiện tại:{' '}
                    <strong>
                      {envMode === 'demo'
                        ? 'Dữ liệu mẫu DEMO'
                        : 'Dữ liệu thật (Cloud Firestore)'}
                    </strong>
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    • Vai trò đang chọn:{' '}
                    <strong>{ROLE_LABELS[userProfile.role].name}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="hidden sm:inline-flex p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              aria-label={
                settings.darkMode
                  ? 'Chuyển sang giao diện Sáng'
                  : 'Chuyển sang giao diện Tối'
              }
            >
              {settings.darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Logged-in Account Action */}
            {firebaseUser ? (
              <button
                type="button"
                onClick={onGoogleSignOut}
                title={`Đăng xuất (${firebaseUser.email || ''})`}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span className="max-w-[110px] truncate">
                  {firebaseUser.displayName || firebaseUser.email}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tài khoản</span>
              </button>
            )}

            {/* PWA Install Button */}
            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>
          </div>
        </header>

        {/* MAIN PAGE CONTENT */}
        <main
          data-testid="main-content-area"
          className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 space-y-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (isInstallable) {
            await install();
          } else {
            setShowGuideModal(true);
          }
        }}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        aria-label="Cài ứng dụng Dư-Nhựa phế liệu ra màn hình chính"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Cài ứng dụng</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <h3
                  id="pwa-guide-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Cài đặt Dư-Nhựa phế liệu ra màn hình chính
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Đóng hướng dẫn cài đặt"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {isIOS ? (
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Trên iPhone / iPad (Safari):
                  </p>
                  <p>
                    1. Nhấn biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh
                    công cụ dưới cùng của trình duyệt Safari.
                  </p>
                  <p>
                    2. Cuộn xuống và chọn{' '}
                    <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 space-y-1.5">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Trên điện thoại Android (Chrome):
                    </p>
                    <p>
                      Nhấn biểu tượng <strong>Menu (3 chấm)</strong> góc phải trên
                      cùng và chọn <strong>Cài đặt ứng dụng</strong> hoặc{' '}
                      <strong>Thêm vào màn hình chính</strong>.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 space-y-1.5">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Trên Máy tính (Chrome / Edge):
                    </p>
                    <p>
                      Nhấn biểu tượng <strong>Cài đặt Dư-Nhựa phế liệu</strong> ở bên phải
                      thanh địa chỉ trình duyệt để mở như phần mềm độc lập.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-lg bg-[#0F2942] py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Mất kết nối Internet — Đang hiển thị dữ liệu lưu đệm trên máy</span>
    </div>
  );
};

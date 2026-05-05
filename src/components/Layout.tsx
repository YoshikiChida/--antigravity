import React, { useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { useTheme } from '../store/ThemeContext';
import { useToast } from './Toast';
import {
  Building, Users, Calendar, LogOut, BarChart2, HelpCircle,
  Download, Upload, Bell, X, Moon, Sun,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  type NotificationSettings,
  loadNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
} from '../utils/notifications';

const REMIND_OPTIONS = [
  { label: '7日前', value: 7 },
  { label: '3日前', value: 3 },
  { label: '前日',  value: 1 },
  { label: '当日',  value: 0 },
];

export const Layout: React.FC = () => {
  const { data, setCurrentBranch, importData } = useAppContext();
  const { darkMode, toggleDark } = useTheme();
  const { toast } = useToast();
  const location = useLocation();
  const importInputRef = useRef<HTMLInputElement>(null);
  const mobileImportRef = useRef<HTMLInputElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(loadNotificationSettings);
  const [permStatus, setPermStatus] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [deadlineDayStr, setDeadlineDayStr] = useState(String(loadNotificationSettings().deadlineDay));

  const currentBranch = data.branches.find((b) => b.id === data.currentBranchId);

  const navItems = [
    { fullName: '交番管理',      shortName: '交番',   path: '/',          icon: Calendar   },
    { fullName: 'ダッシュボード', shortName: '統計',   path: '/dashboard', icon: BarChart2  },
    { fullName: 'コース管理',    shortName: 'コース', path: '/courses',   icon: Building   },
    { fullName: '社員管理',      shortName: '社員',   path: '/employees', icon: Users      },
    { fullName: '使い方ガイド',  shortName: 'ガイド', path: '/help',      icon: HelpCircle },
  ];

  const handleExport = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `yamato-backup-${format(new Date(), 'yyyyMMdd-HHmm')}.json`;
    link.click();
    toast('バックアップを出力しました');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (window.confirm('現在のデータをすべて上書きします。よろしいですか？')) {
        importData(text);
        toast('データをインポートしました', 'info');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleToggleEnabled = async () => {
    const newEnabled = !notifSettings.enabled;
    if (newEnabled) {
      const perm = await requestNotificationPermission();
      setPermStatus(perm);
      if (perm !== 'granted') {
        toast('通知を許可してください（ブラウザ設定 → サイト設定 → 通知）', 'warning');
        return;
      }
    }
    const next = { ...notifSettings, enabled: newEnabled };
    setNotifSettings(next);
    saveNotificationSettings(next);
  };

  const handleDeadlineDayChange = (raw: string) => {
    setDeadlineDayStr(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= 31) {
      const next = { ...notifSettings, deadlineDay: n };
      setNotifSettings(next);
      saveNotificationSettings(next);
    }
  };

  const handleDeadlineDayBlur = () => {
    const n = parseInt(deadlineDayStr, 10);
    const clamped = isNaN(n) ? 1 : Math.min(31, Math.max(1, n));
    setDeadlineDayStr(String(clamped));
    if (clamped !== notifSettings.deadlineDay) {
      const next = { ...notifSettings, deadlineDay: clamped };
      setNotifSettings(next);
      saveNotificationSettings(next);
    }
  };

  const handleToggleRemindDay = (value: number) => {
    const days = notifSettings.remindDays.includes(value)
      ? notifSettings.remindDays.filter(d => d !== value)
      : [...notifSettings.remindDays, value].sort((a, b) => b - a);
    const next = { ...notifSettings, remindDays: days };
    setNotifSettings(next);
    saveNotificationSettings(next);
  };

  if (!data.currentBranchId) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
        <Outlet />
      </div>
    );
  }

  const currentPageName = navItems.find((n) => n.path === location.pathname)?.fullName || 'システム';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex flex-col md:flex-row transition-colors duration-300">

      {/* ── 通知設定モーダル ── */}
      {notifOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-xl">
                  <Bell size={20} className="text-yellow-600" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">リマインダー設定</h3>
              </div>
              <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                <X size={20} />
              </button>
            </div>

            {'Notification' in window ? (
              <div className={`text-xs px-3 py-2 rounded-lg ${
                permStatus === 'granted'  ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : permStatus === 'denied' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
              }`}>
                {permStatus === 'granted'  ? '✅ 通知の許可済み'
                : permStatus === 'denied'  ? '❌ 通知が拒否されています（ブラウザ設定 → サイト設定 → 通知 から変更）'
                : '🔔 「有効にする」を押すと通知の許可を求めます'}
              </div>
            ) : (
              <div className="text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg">
                ❌ このブラウザは通知に対応していません
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700 dark:text-gray-200">リマインダーを有効にする</span>
              <button
                onClick={handleToggleEnabled}
                className={`relative w-12 h-6 rounded-full transition-colors ${notifSettings.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifSettings.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">毎月の提出期限日</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} max={31}
                  value={deadlineDayStr}
                  onChange={e => handleDeadlineDayChange(e.target.value)}
                  onBlur={handleDeadlineDayBlur}
                  className="w-20 border dark:border-gray-600 rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD700] bg-white dark:bg-gray-700 dark:text-gray-100"
                />
                <span className="text-gray-600 dark:text-gray-300">日</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">通知時刻</label>
              <input
                type="time"
                value={notifSettings.notifyTime ?? '09:00'}
                onChange={e => {
                  const next = { ...notifSettings, notifyTime: e.target.value };
                  setNotifSettings(next);
                  saveNotificationSettings(next);
                }}
                className="border dark:border-gray-600 rounded-lg px-3 py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD700] bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">通知タイミング</label>
              <div className="space-y-2">
                {REMIND_OPTIONS.map(({ label, value }) => (
                  <label key={value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifSettings.remindDays.includes(value)}
                      onChange={() => handleToggleRemindDay(value)}
                      className="w-4 h-4 rounded accent-[#FFD700]"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              通知はアプリを開いたときに表示されます。iOSはPWAインストールが必要です。
            </p>

            <button
              onClick={() => setNotifOpen(false)}
              className="w-full bg-[#1A1A1A] dark:bg-gray-700 text-white font-bold py-2.5 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-64 flex-col shrink-0 print:hidden bg-gradient-to-b from-gray-950 via-gray-900 to-[#1a1a1a] shadow-2xl">
        {/* Brand header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#FFD700] flex items-center justify-center shrink-0">
              <Building size={18} className="text-[#1A1A1A]" />
            </div>
            <h1 className="text-base font-black text-white tracking-tight leading-tight">
              交番管理システム
            </h1>
          </div>
          <div className="ml-[42px] text-xs font-medium text-[#FFD700]/80 truncate">
            {currentBranch?.name || '未選択'}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-[#FFD700]/15 text-[#FFD700]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-[#FFD700]/20' : 'group-hover:bg-white/10'}`}>
                  <Icon size={17} />
                </div>
                <span className="font-semibold text-sm">{item.fullName}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse-glow" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="p-3 border-t border-white/10 space-y-0.5">
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all text-sm group"
          >
            <div className="p-1.5 rounded-lg group-hover:bg-white/10 transition-colors">
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </div>
            {darkMode ? 'ライトモード' : 'ダークモード'}
          </button>

          <button
            onClick={() => setNotifOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all text-sm group"
          >
            <div className="p-1.5 rounded-lg group-hover:bg-white/10 transition-colors relative">
              <Bell size={17} />
              {notifSettings.enabled && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-gray-900" />
              )}
            </div>
            リマインダー設定
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all text-sm group"
          >
            <div className="p-1.5 rounded-lg group-hover:bg-white/10 transition-colors">
              <Download size={17} />
            </div>
            バックアップ出力
          </button>

          <label className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all text-sm cursor-pointer group">
            <div className="p-1.5 rounded-lg group-hover:bg-white/10 transition-colors">
              <Upload size={17} />
            </div>
            バックアップ読込
            <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>

          <button
            onClick={() => setCurrentBranch(null)}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-gray-500 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all text-sm group mt-1"
          >
            <div className="p-1.5 rounded-lg group-hover:bg-red-500/10 transition-colors">
              <LogOut size={17} />
            </div>
            営業所切替
          </button>
        </div>
      </aside>

      {/* ── Main Column ── */}
      <div className="flex-1 flex flex-col md:h-screen md:overflow-hidden print:h-auto print:overflow-visible print:block">

        {/* Mobile top bar */}
        <header className="md:hidden bg-gradient-to-r from-gray-950 to-gray-900 text-white px-4 py-3 landscape:py-1.5 flex items-center justify-between shrink-0 print:hidden shadow-lg">
          <span className="text-[#FFD700] font-black text-sm tracking-tight">交番管理システム</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{currentBranch?.name}</span>
            <button onClick={toggleDark} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all">
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button onClick={() => setNotifOpen(true)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all relative">
              <Bell size={17} />
              {notifSettings.enabled && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
            </button>
            <button onClick={handleExport} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all">
              <Download size={17} />
            </button>
            <label className="text-gray-400 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-white/10 transition-all">
              <Upload size={17} />
              <input ref={mobileImportRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </header>

        {/* Desktop page title */}
        <header className="hidden md:flex items-center bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-800 px-6 py-4 shrink-0 print:hidden border-b border-gray-100 dark:border-gray-800 transition-colors">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{currentPageName}</h2>
        </header>

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-auto p-4 md:p-6 pb-24 landscape:pb-12 md:pb-6 print:p-0 print:overflow-visible bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-gray-950 to-gray-900 border-t border-white/10 flex items-stretch print:hidden shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-2 landscape:py-0.5 gap-0.5 transition-colors ${
                isActive ? 'text-[#FFD700]' : 'text-gray-500 active:text-gray-300'
              }`}
            >
              <Icon size={22} />
              <span className="text-[9px] font-semibold leading-none landscape:hidden">{item.shortName}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setCurrentBranch(null)}
          className="flex-1 flex flex-col items-center justify-center py-2 landscape:py-0.5 gap-0.5 text-gray-500 active:text-gray-300 transition-colors"
        >
          <LogOut size={22} />
          <span className="text-[9px] font-semibold leading-none landscape:hidden">切替</span>
        </button>
      </nav>
    </div>
  );
};

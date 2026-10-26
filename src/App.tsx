import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Calendar,
  CalendarDays,
  UserCheck,
  GraduationCap,
  CalendarClock,
  Timer,
  FileText,
  Settings as SettingsIcon,
  Download,
  Wifi,
  WifiOff,
  AlertTriangle,
  X,
} from 'lucide-react';
import { CampusKitProvider, useCampusKit } from './context/CampusKitContext';
import { TodayView } from './components/TodayView';
import { RoutineView } from './components/RoutineView';
import { AttendView } from './components/AttendView';
import { CgpaView } from './components/CgpaView';
import { ExamsView } from './components/ExamsView';
import { StudyView } from './components/StudyView';
import { NotesView } from './components/NotesView';
import { SettingsModal } from './components/SettingsModal';
import { useOnlineStatus, usePWAInstall, useServiceWorkerStatus } from './hooks/usePWA';
import type { TabId } from './types/campuskit';

const NAV_TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'routine', label: 'Routine', icon: CalendarDays },
  { id: 'attend', label: 'Attend', icon: UserCheck },
  { id: 'cgpa', label: 'CGPA', icon: GraduationCap },
  { id: 'exams', label: 'Exams', icon: CalendarClock },
  { id: 'study', label: 'Study', icon: Timer },
  { id: 'notes', label: 'Notes', icon: FileText },
];

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    storageErrorBanner,
    clearStorageErrorBanner,
  } = useCampusKit();

  const isOnline = useOnlineStatus();
  const { isInstallable, installApp } = usePWAInstall();
  // Android hardware back button (native shell only; no-op on the web):
  // a non-Today tab goes back to Today, and back on Today exits the app.
  // The listener is re-registered when the tab changes so it always sees
  // the current tab; @capacitor/app is loaded lazily so the web bundle
  // never loads native-only code.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    import('@capacitor/app')
      .then(async ({ App }) => {
        if (cancelled) return;
        const listener = await App.addListener('backButton', () => {
          if (activeTab !== 'today') {
            setActiveTab('today');
          } else {
            void App.exitApp();
          }
        });
        remove = () => void listener.remove();
      })
      .catch(() => {
        // Back-button handling is a convenience; a missing plugin must
        // never break the app itself.
      });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [activeTab, setActiveTab]);
  // Register the service worker (side effect). This hook was previously
  // never called anywhere, so the SW never registered and offline/install
  // could not work; wiring it here fixes that. Update state is not surfaced
  // in the UI yet — sw.js calls skipWaiting() on install, so updates apply.
  useServiceWorkerStatus();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-stone-100/70 text-stone-900 transition-colors duration-200 dark:bg-stone-950 dark:text-stone-100">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 border-b border-stone-200/90 bg-white/95 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-3 sm:px-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs dark:bg-indigo-500">
              <span className="font-bold tracking-tight text-sm">CK</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-stone-900 dark:text-stone-50">
                  CampusKit
                </span>
                <span className="rounded-sm bg-indigo-50 px-1 py-0.2 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  BD
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Online / Offline Pill */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
              }`}
              title={isOnline ? 'Online mode' : 'Offline mode — 100% functional without internet'}
            >
              {isOnline ? (
                <>
                  <Wifi className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden xs:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                  <span>Offline</span>
                </>
              )}
            </span>

            {/* PWA Install Button */}
            {isInstallable && (
              <button
                type="button"
                onClick={installApp}
                aria-label="Install CampusKit app"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 active:scale-95 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}

            {/* Settings Gear Icon Button (NOT an 8th tab) */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-800 active:scale-95 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Storage Error Warning Banner */}
      {storageErrorBanner && (
        <div className="mx-auto mt-2 max-w-2xl px-3 sm:px-4">
          <div className="flex items-center justify-between rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{storageErrorBanner}</span>
            </div>
            <button
              type="button"
              onClick={clearStorageErrorBanner}
              aria-label="Dismiss warning"
              className="rounded-md p-1 hover:bg-rose-100 dark:hover:bg-rose-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto flex-1 w-full max-w-2xl px-3 pt-4 sm:px-4">
        {activeTab === 'today' && <TodayView />}
        {activeTab === 'routine' && <RoutineView />}
        {activeTab === 'attend' && <AttendView />}
        {activeTab === 'cgpa' && <CgpaView />}
        {activeTab === 'exams' && <ExamsView />}
        {activeTab === 'study' && <StudyView />}
        {activeTab === 'notes' && <NotesView />}
      </main>

      {/* Bottom Sticky Navigation Bar - STRICTLY 7 TABS */}
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-1">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center rounded-xl px-1 py-1 transition-all active:scale-95 ${
                  isActive
                    ? 'font-bold text-indigo-600 dark:text-indigo-400'
                    : 'font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
              >
                <Icon
                  className={`h-5 w-5 transition-transform ${
                    isActive ? 'scale-110' : 'opacity-80'
                  }`}
                />
                <span className="mt-0.5 text-[10px] tracking-tight">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <CampusKitProvider>
      <MainAppContent />
    </CampusKitProvider>
  );
}

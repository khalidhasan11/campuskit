import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Download,
  Upload,
  Trash2,
  Moon,
  Sun,
  Laptop,
  Clock,
  Calendar,
  ShieldCheck,
  HardDrive,
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  Bell,
  CalendarDays,
  Plus,
  GraduationCap,
} from 'lucide-react';
import { useCampusKit } from '../context/CampusKitContext';
import { Modal } from './Modal';
import {
  parseAndValidateBackupJson,
  ValidatedBackupPayload,
} from '../storage/localStore';
import { getAttachmentStorageStats } from '../storage/blobDb';
import { formatBytes, toLocalDateString } from '../utils/dateAndMath';
import type {
  ThemePreference,
  ClockFormat,
  WeekStart,
  ReminderSettings,
} from '../types/campuskit';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateSettings,
    routine,
    attendance,
    semesters,
    courses,
    deadlines,
    studySessions,
    notes,
    exportBackupJson,
    restoreFromValidatedBackup,
    clearAllAppData,
    semesterSettings,
    updateSemesterSettings,
    addHoliday,
    removeHoliday,
    requestNotificationPermission,
  } = useCampusKit();

  const [activeTab, setActiveTab] = useState<
    'general' | 'semester' | 'backup' | 'storage' | 'about'
  >('general');

  // Grading scale state
  const [customScale, setCustomScale] = useState(
    settings.gradingScaleMax ? String(settings.gradingScaleMax) : '4.00'
  );
  const [scaleError, setScaleError] = useState<string | null>(null);

  // Semester holiday state
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [holidayError, setHolidayError] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import state
  const [pendingBackup, setPendingBackup] = useState<ValidatedBackupPayload | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  // Clear data confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearInputConfirm, setClearInputConfirm] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // Storage estimation
  const [storageEstimate, setStorageEstimate] = useState<{
    usage: number;
    quota: number;
  } | null>(null);
  const [blobStats, setBlobStats] = useState<{ count: number; totalBytes: number }>({
    count: 0,
    totalBytes: 0,
  });

  useEffect(() => {
    if (isOpen) {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          if (est.usage !== undefined && est.quota !== undefined) {
            setStorageEstimate({ usage: est.usage, quota: est.quota });
          }
        });
      }
      getAttachmentStorageStats().then((res) => {
        setBlobStats(res);
      });
      setCustomScale(String(settings.gradingScaleMax ?? 4.0));
      setScaleError(null);
    }
  }, [isOpen, settings.gradingScaleMax]);

  const handleCustomScaleChange = (valStr: string) => {
    setCustomScale(valStr);
    const num = parseFloat(valStr);
    if (!Number.isFinite(num) || num < 2.0 || num > 10.0) {
      setScaleError('Scale must be between 2.00 and 10.00.');
    } else {
      setScaleError(null);
      updateSettings({ gradingScaleMax: Math.round(num * 100) / 100 });
    }
  };

  const handleToggleReminder = async (key: keyof ReminderSettings) => {
    const nextVal = !settings.reminders[key];
    if (nextVal) {
      await requestNotificationPermission();
    }
    updateSettings({
      reminders: {
        ...settings.reminders,
        [key]: nextVal,
      },
    });
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayError(null);
    const trimmedDate = newHolidayDate.trim();
    const trimmedLabel = newHolidayLabel.trim();

    if (!trimmedDate || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setHolidayError('Please select a valid date (YYYY-MM-DD).');
      return;
    }
    if (!trimmedLabel) {
      setHolidayError('Holiday name or label is required.');
      return;
    }

    addHoliday(trimmedDate, trimmedLabel);
    setNewHolidayDate('');
    setNewHolidayLabel('');
  };

  // Export JSON Backup
  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const jsonStr = await exportBackupJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campuskit-backup-${toLocalDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      alert(`Could not export backup: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Import File Selection
  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setPendingBackup(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = parseAndValidateBackupJson(text);
      setPendingBackup(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid backup archive.';
      setImportError(msg);
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  // Execute Restore
  const handleConfirmRestore = async () => {
    if (!pendingBackup) return;
    try {
      setIsImporting(true);
      await restoreFromValidatedBackup(pendingBackup, importMode);
      setPendingBackup(null);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      setImportError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  // Execute Clear All Data
  const handleExecuteClear = async () => {
    if (clearInputConfirm.trim().toUpperCase() !== 'CLEAR') return;
    setIsClearing(true);
    await clearAllAppData();
    setIsClearing(false);
    setShowClearConfirm(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CampusKit Settings" maxWidthClass="max-w-xl">
      <div className="space-y-5">
        {/* Sub-navigation tabs */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 overflow-x-auto">
          {[
            { id: 'general', label: 'Preferences' },
            { id: 'semester', label: 'Semester' },
            { id: 'backup', label: 'Backup' },
            { id: 'storage', label: 'Storage' },
            { id: 'about', label: 'About' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`min-h-[44px] flex-1 min-w-[70px] border-b-2 px-2 text-xs font-semibold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* GENERAL PREFERENCES TAB */}
        {activeTab === 'general' && (
          <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Theme Preference */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Theme
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { id: 'system', label: 'System', icon: Laptop },
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon },
                ].map((th) => {
                  const Icon = th.icon;
                  const isSelected = settings.theme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => updateSettings({ theme: th.id as ThemePreference })}
                      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition active:scale-95 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {th.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clock Format */}
            <div className="border-t border-stone-100 pt-3 dark:border-stone-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Clock Display
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { id: '12h', label: '12-Hour (1:30 PM)' },
                  { id: '24h', label: '24-Hour (13:30)' },
                ].map((clk) => {
                  const isSelected = settings.clockFormat === clk.id;
                  return (
                    <button
                      key={clk.id}
                      type="button"
                      onClick={() => updateSettings({ clockFormat: clk.id as ClockFormat })}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border p-2.5 text-xs font-medium transition active:scale-95 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}
                    >
                      {clk.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Week Start */}
            <div className="border-t border-stone-100 pt-3 dark:border-stone-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                First Day of Week
              </label>
              <p className="mt-0.5 text-[11px] text-stone-400">
                Saturday is standard for universities and colleges in Bangladesh.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { id: 'saturday', label: 'Saturday' },
                  { id: 'sunday', label: 'Sunday' },
                  { id: 'monday', label: 'Monday' },
                ].map((ws) => {
                  const isSelected = settings.weekStart === ws.id;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => updateSettings({ weekStart: ws.id as WeekStart })}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border p-2.5 text-xs font-medium transition active:scale-95 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}
                    >
                      {ws.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grading Scale Max */}
            <div className="border-t border-stone-100 pt-3 dark:border-stone-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Grading Scale Max
              </label>
              <p className="mt-0.5 text-[11px] text-stone-400">
                Configures CGPA tab calculations and What-If thresholds (default 4.00, 5.00, or custom 2.00–10.00).
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomScale('4.00');
                    setScaleError(null);
                    updateSettings({ gradingScaleMax: 4.0 });
                  }}
                  className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border p-2 text-xs font-medium transition active:scale-95 ${
                    settings.gradingScaleMax === 4.0
                      ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300'
                  }`}
                >
                  4.00 (Standard)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomScale('5.00');
                    setScaleError(null);
                    updateSettings({ gradingScaleMax: 5.0 });
                  }}
                  className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border p-2 text-xs font-medium transition active:scale-95 ${
                    settings.gradingScaleMax === 5.0
                      ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300'
                  }`}
                >
                  5.00 Scale
                </button>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="2.00"
                    max="10.00"
                    placeholder="Custom"
                    value={customScale}
                    onChange={(e) => handleCustomScaleChange(e.target.value)}
                    className="w-full min-h-[44px] px-3 text-center rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-semibold text-stone-900 dark:text-stone-100 focus:border-indigo-500"
                  />
                </div>
              </div>
              {scaleError && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {scaleError}
                </p>
              )}
            </div>

            {/* In-App Reminders */}
            <div className="border-t border-stone-100 pt-3 dark:border-stone-800 space-y-3">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  In-App Reminders
                </label>
              </div>

              {/* Mandatory Disclaimer */}
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 p-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                Reminders only work while the app is open. CampusKit cannot send notifications while the app is closed.
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 cursor-pointer">
                  <div className="pr-3">
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      Class Reminders
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Notifies when a class starts within 60 minutes
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.reminders?.classReminders ?? true}
                    onChange={() => handleToggleReminder('classReminders')}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 cursor-pointer">
                  <div className="pr-3">
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      Upcoming Deadlines
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Notifies when an unfinished exam or assignment is due tomorrow
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.reminders?.deadlineReminders ?? true}
                    onChange={() => handleToggleReminder('deadlineReminders')}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 cursor-pointer">
                  <div className="pr-3">
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      Attendance Risk Alerts
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Alerts if any course drops below its minimum required percentage
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.reminders?.attendanceRiskReminders ?? true}
                    onChange={() => handleToggleReminder('attendanceRiskReminders')}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* SEMESTER & HOLIDAYS TAB */}
        {activeTab === 'semester' && (
          <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60 space-y-3">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                <CalendarDays className="h-4 w-4" />
                Current Semester Range
              </span>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Setting semester dates enables the &ldquo;Day X of Y&rdquo; progress badge on your Today dashboard.
              </p>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Semester Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spring 2025, Fall 2024"
                  value={semesterSettings.semesterName}
                  onChange={(e) => updateSemesterSettings({ semesterName: e.target.value })}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={semesterSettings.startDate}
                    onChange={(e) => updateSemesterSettings({ startDate: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={semesterSettings.endDate}
                    onChange={(e) => updateSemesterSettings({ endDate: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
            </div>

            {/* Holidays List & Add */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Semester Holidays
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    CampusKit highlights holiday banners on your Today dashboard on matching dates.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddHoliday} className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Holiday Date *
                    </label>
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      Holiday Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Eid-ul-Fitr, Pohela Boishakh"
                      value={newHolidayLabel}
                      onChange={(e) => setNewHolidayLabel(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-xs text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>

                {holidayError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    {holidayError}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Holiday</span>
                  </button>
                </div>
              </form>

              {semesterSettings.holidays.length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-400">
                  No holidays logged yet. Add university recesses or government holidays.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {semesterSettings.holidays
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-stone-900 dark:text-stone-100">
                            {h.label}
                          </span>
                          <span className="ml-2 font-mono text-[11px] text-stone-400">
                            {h.date}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeHoliday(h.id)}
                          aria-label={`Remove ${h.label}`}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BACKUP & RESTORE TAB */}
        {activeTab === 'backup' && (
          <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Export Section */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Export Full Backup
              </h3>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Generates a single offline JSON file containing your routine, courses, attendance history, CGPA, deadlines, study logs, semester settings, and notes with photo/voice attachments.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Packaging...' : 'Export Backup JSON'}
                </button>
                {exportSuccess && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Downloaded!
                  </span>
                )}
              </div>
            </div>

            {/* Import Section */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Restore from Backup
              </h3>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                Select a previously exported CampusKit `.json` file to restore your academic data.
              </p>

              <input
                ref={importFileRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChosen}
                className="hidden"
                id="backup-file-input"
              />

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-750"
                >
                  <Upload className="h-4 w-4" />
                  Select Backup File
                </button>
                {importSuccess && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Data Restored!
                  </span>
                )}
              </div>

              {importError && (
                <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {importError}
                </div>
              )}

              {/* Pending Backup Preview & Mode Selection */}
              {pendingBackup && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-100">
                    <FileCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Valid CampusKit Archive Verified
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-stone-600 dark:text-stone-300 sm:grid-cols-4">
                    <div>Classes: {pendingBackup.routine.length}</div>
                    <div>Courses: {pendingBackup.courses?.length ?? 0}</div>
                    <div>Attendance: {pendingBackup.attendance.length}</div>
                    <div>Deadlines: {pendingBackup.deadlines.length}</div>
                    <div>Semesters: {pendingBackup.semesters.length}</div>
                    <div>Study Logs: {pendingBackup.studySessions.length}</div>
                    <div>Notes: {pendingBackup.notes.length}</div>
                    <div>Attachments: {pendingBackup.attachmentBlobs.length}</div>
                  </div>

                  <div className="mt-3 border-t border-indigo-200/60 pt-3 dark:border-indigo-900/60">
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Import Mode
                    </label>
                    <div className="mt-1.5 flex gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                        <input
                          type="radio"
                          name="import-mode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                        />
                        <span>Merge (Keep existing data)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                        <input
                          type="radio"
                          name="import-mode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                        />
                        <span className="font-semibold text-rose-700 dark:text-rose-400">
                          Replace (Wipe & Replace)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingBackup(null)}
                      className="min-h-[44px] rounded-xl px-3 text-xs font-medium text-stone-600 hover:bg-stone-200/60 dark:text-stone-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRestore}
                      disabled={isImporting}
                      className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:scale-95 disabled:opacity-50 dark:bg-indigo-500"
                    >
                      {isImporting ? 'Restoring...' : `Confirm ${importMode === 'merge' ? 'Merge' : 'Replace'}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STORAGE & RESET TAB */}
        {activeTab === 'storage' && (
          <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
            {/* Storage Estimation */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                <HardDrive className="h-4 w-4" />
                Device Storage Usage
              </span>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-white p-2.5 dark:bg-stone-800">
                  <span className="text-[11px] text-stone-400">Routine Classes</span>
                  <p className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {routine.length}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-2.5 dark:bg-stone-800">
                  <span className="text-[11px] text-stone-400">Attendance Subjects</span>
                  <p className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {attendance.length}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-2.5 dark:bg-stone-800">
                  <span className="text-[11px] text-stone-400">Notes & Memos</span>
                  <p className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {notes.length}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-2.5 dark:bg-stone-800">
                  <span className="text-[11px] text-stone-400">Media Blobs</span>
                  <p className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {blobStats.count} ({formatBytes(blobStats.totalBytes)})
                  </p>
                </div>
              </div>

              {storageEstimate && (
                <div className="mt-3 text-[11px] text-stone-500 dark:text-stone-400">
                  Total browser sandbox: {formatBytes(storageEstimate.usage)} used of{' '}
                  {formatBytes(storageEstimate.quota)} allocated.
                </div>
              )}
            </div>

            {/* Clear All Data (Danger Zone) */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </span>
              <h3 className="mt-1 text-sm font-bold text-rose-950 dark:text-rose-100">
                Clear All CampusKit Data
              </h3>
              <p className="mt-1 text-xs text-rose-900/80 dark:text-rose-200/80">
                Permanently wipes all routine schedules, attendance logs, semesters, deadlines, study timers, notes, and photos from this device.
              </p>

              {!showClearConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 shadow-xs hover:bg-rose-50 active:scale-95 dark:border-rose-800 dark:bg-stone-900 dark:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Erase All Data
                </button>
              ) : (
                <div className="mt-3 space-y-3 rounded-lg border border-rose-300 bg-white p-3 dark:border-rose-800 dark:bg-stone-900">
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                    Type &ldquo;CLEAR&rdquo; below to confirm permanent deletion:
                  </p>
                  <input
                    type="text"
                    value={clearInputConfirm}
                    onChange={(e) => setClearInputConfirm(e.target.value)}
                    placeholder="Type CLEAR"
                    className="min-h-[44px] w-full rounded-xl border border-rose-300 bg-white px-3 text-xs font-bold uppercase text-stone-900 focus:outline-hidden dark:border-rose-800 dark:bg-stone-800 dark:text-stone-100"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowClearConfirm(false);
                        setClearInputConfirm('');
                      }}
                      className="min-h-[44px] rounded-xl px-3 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteClear}
                      disabled={clearInputConfirm.trim().toUpperCase() !== 'CLEAR' || isClearing}
                      className="inline-flex min-h-[44px] items-center rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-95 disabled:opacity-40"
                    >
                      {isClearing ? 'Erasing...' : 'Permanently Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABOUT & PRIVACY TAB */}
        {activeTab === 'about' && (
          <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/60">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                CampusKit v1.1.0
              </span>
              <h3 className="mt-1 text-base font-bold text-stone-900 dark:text-stone-100">
                Free Offline Student Productivity Suite
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                Engineered for university students across Bangladesh — whether you attend Dhaka University (DU), BUET, NSU, BRAC University, SUST, Chittagong University (CU), Rajshahi University (RU), IUT, or beyond.
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
              <span className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Guaranteed Local Privacy
              </span>
              <ul className="mt-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                <li>• No backend servers, accounts, or logins.</li>
                <li>• Zero analytics, advertising, tracking, or telemetry.</li>
                <li>• Works 100% offline via local browser cache & Service Worker.</li>
                <li>• Photos & voice memos stored securely in your private browser IndexedDB.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

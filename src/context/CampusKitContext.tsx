import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AppSettings,
  AttendanceActionType,
  AttendanceSubject,
  AttendanceUndoState,
  CompletedSemester,
  CurrentCourse,
  DeadlineItem,
  NoteAttachmentMeta,
  NoteItem,
  PersistedTimerState,
  RoutineClass,
  RoutineCourse,
  SemesterHoliday,
  SemesterSettings,
  StudyPresetId,
  StudySession,
  TabId,
} from '../types/campuskit';
import {
  clearAllAttachmentBlobs,
  deleteAttachmentBlobsByIds,
  deleteAttachmentsForNote,
} from '../storage/blobDb';
import {
  DEFAULT_SEMESTER_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_TIMER_STATE,
  LocalSnapshot,
  STORAGE_KEYS,
  buildBackupArchive,
  createId,
  executeValidatedRestore,
  loadInitialSnapshot,
  readTranscriptStateFromStorage,
  ValidatedBackupPayload,
  writeStorageJson,
} from '../storage/localStore';
import {
  calendarDaysFromToday,
  computeAttendanceMetrics,
  formatLocalDateReadable,
  parseMinutesFromMidnight,
  shouldSaveCompletedTimerSession,
  toLocalDateString,
} from '../utils/dateAndMath';

export const STUDY_PRESETS: Record<
  StudyPresetId,
  { id: StudyPresetId; label: string; minutes: number; mode: 'focus' | 'break' }
> = {
  'focus-25': { id: 'focus-25', label: 'Focus 25', minutes: 25, mode: 'focus' },
  'focus-50': { id: 'focus-50', label: 'Focus 50', minutes: 50, mode: 'focus' },
  'break-5': { id: 'break-5', label: 'Break 5', minutes: 5, mode: 'break' },
  'break-15': { id: 'break-15', label: 'Break 15', minutes: 15, mode: 'break' },
};

export type QuickModalRequest = 'add-class' | 'add-deadline' | 'record-attendance' | null;

interface CampusKitContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  quickModal: QuickModalRequest;
  setQuickModal: (req: QuickModalRequest) => void;
  now: Date;

  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;

  routine: RoutineClass[];
  saveRoutineClass: (
    input: Omit<RoutineClass, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => RoutineClass;
  deleteRoutineClass: (id: string) => void;
  importRoutineClasses: (
    classes: Array<Omit<RoutineClass, 'id' | 'createdAt' | 'updatedAt'>>
  ) => number;

  routineCourses: RoutineCourse[];
  saveRoutineCourse: (
    input: Omit<RoutineCourse, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => RoutineCourse;
  deleteRoutineCourse: (id: string) => void;

  semesterSettings: SemesterSettings;
  updateSemesterSettings: (patch: Partial<SemesterSettings>) => void;
  addHoliday: (date: string, label: string) => SemesterHoliday;
  removeHoliday: (id: string) => void;

  attendance: AttendanceSubject[];
  attendanceUndo: AttendanceUndoState | null;
  dismissAttendanceUndo: () => void;
  undoLastAttendance: () => void;
  saveAttendanceSubject: (
    input: Omit<AttendanceSubject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => AttendanceSubject;
  markAttendance: (subjectId: string, mark: AttendanceActionType) => void;
  deleteAttendanceSubject: (id: string) => void;

  semesters: CompletedSemester[];
  saveSemester: (
    input: Omit<CompletedSemester, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => CompletedSemester;
  deleteSemester: (id: string) => void;

  courses: CurrentCourse[];
  saveCourse: (
    input: Omit<CurrentCourse, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => CurrentCourse;
  deleteCourse: (id: string) => void;

  deadlines: DeadlineItem[];
  saveDeadline: (
    input: Omit<DeadlineItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => DeadlineItem;
  toggleDeadlineComplete: (id: string, completed: boolean) => void;
  deleteDeadline: (id: string) => void;

  studySessions: StudySession[];
  studyTimer: PersistedTimerState;
  timerRemainingMs: number;
  timerJustCompletedMessage: string | null;
  dismissTimerCompletedMessage: () => void;
  selectStudyPreset: (presetId: StudyPresetId) => void;
  startOrResumeTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  saveManualStudySession: (
    input: { id?: string; date: string; minutes: number; label: string }
  ) => StudySession;
  deleteStudySession: (id: string) => void;

  notes: NoteItem[];
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  openNewNoteImmediately: () => NoteItem;
  updateNoteTextSync: (
    noteId: string,
    title: string,
    body: string
  ) => { ok: boolean; error?: string };
  attachMetaToNoteSync: (
    noteId: string,
    meta: NoteAttachmentMeta
  ) => { ok: boolean; error?: string };
  removeAttachmentFromNoteSync: (
    noteId: string,
    attachmentId: string
  ) => { ok: boolean; error?: string };
  deleteNoteWithCleanup: (
    noteId: string
  ) => Promise<{ deletedNote: boolean; cleanupError?: string }>;
  pendingCleanupIds: string[];
  retryPendingAttachmentCleanup: () => Promise<{ ok: boolean; error?: string }>;

  requestNotificationPermission: () => Promise<'granted' | 'denied' | 'unsupported'>;

  exportBackupJson: () => Promise<string>;
  restoreFromValidatedBackup: (
    payload: ValidatedBackupPayload,
    mode: 'merge' | 'replace'
  ) => Promise<void>;
  clearAllAppData: () => Promise<{ ok: boolean; error?: string }>;
  storageErrorBanner: string | null;
  clearStorageErrorBanner: () => void;
}

const CampusKitContext = createContext<CampusKitContextValue | null>(null);

function playCompletionTone() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Audio tone is non-critical enhancement
  }
}

export const CampusKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [init] = useState<LocalSnapshot>(() => loadInitialSnapshot());

  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [quickModal, setQuickModal] = useState<QuickModalRequest>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const [settings, setSettings] = useState<AppSettings>(init.settings);
  const [routine, setRoutine] = useState<RoutineClass[]>(init.routine);
  const [routineCourses, setRoutineCourses] = useState<RoutineCourse[]>(init.routineCourses ?? []);
  const [semesterSettings, setSemesterSettings] = useState<SemesterSettings>(
    init.semesterSettings ?? DEFAULT_SEMESTER_SETTINGS
  );
  const [attendance, setAttendance] = useState<AttendanceSubject[]>(init.attendance);
  const [attendanceUndo, setAttendanceUndo] = useState<AttendanceUndoState | null>(null);
  const [semesters, setSemesters] = useState<CompletedSemester[]>(init.semesters);
  const [courses, setCourses] = useState<CurrentCourse[]>(init.courses);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>(init.deadlines);
  const [studySessions, setStudySessions] = useState<StudySession[]>(init.studySessions);
  const [studyTimer, setStudyTimer] = useState<PersistedTimerState>(init.studyTimer);
  const [timerTickMs, setTimerTickMs] = useState<number>(() => Date.now());
  const [timerJustCompletedMessage, setTimerJustCompletedMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>(init.notes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pendingCleanupIds, setPendingCleanupIds] = useState<string[]>(init.pendingCleanupIds);
  const [storageErrorBanner, setStorageErrorBanner] = useState<string | null>(null);

  const safePersist = useCallback((key: string, value: unknown): { ok: boolean; error?: string } => {
    try {
      writeStorageJson(key, value);
      return { ok: true };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Browser storage quota reached or writes are blocked.';
      setStorageErrorBanner(`Storage save error: ${msg}`);
      return { ok: false, error: msg };
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
      root.classList.toggle('dark', isDark);
      const metaTheme = document.getElementById('meta-theme-color');
      if (metaTheme) {
        metaTheme.setAttribute('content', isDark ? '#0c0a09' : '#fafaf9');
      }
    };

    applyTheme();
    media.addEventListener?.('change', applyTheme);
    return () => {
      media.removeEventListener?.('change', applyTheme);
    };
  }, [settings.theme]);

  useEffect(() => {
    const refreshClock = () => setNow(new Date());
    const id = window.setInterval(refreshClock, 15_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshClock();
        setTimerTickMs(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next: AppSettings = {
          ...prev,
          ...patch,
          reminders: patch.reminders ? { ...prev.reminders, ...patch.reminders } : prev.reminders,
        };
        safePersist(STORAGE_KEYS.settings, next);
        return next;
      });
    },
    [safePersist]
  );

  // In-app Reminders checker (checks on load and every 60 seconds)
  useEffect(() => {
    const checkReminders = () => {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      if (
        !settings.reminders.classReminders &&
        !settings.reminders.deadlineReminders &&
        !settings.reminders.attendanceRiskReminders
      ) {
        return;
      }

      const todayStr = toLocalDateString(now);
      let sentRecord: { date: string; keys: string[] } = { date: todayStr, keys: [] };
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.remindersSent);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === todayStr && Array.isArray(parsed.keys)) {
            sentRecord = parsed;
          }
        }
      } catch {
        // Fallback to empty sent record
      }

      const sentKeys = new Set<string>(sentRecord.keys);
      let updatedSent = false;

      // 1. Class reminders (starts within 60 minutes)
      if (settings.reminders.classReminders) {
        const todayDay = now.getDay();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        for (const c of routine) {
          if (c.dayOfWeek === todayDay) {
            const startM = parseMinutesFromMidnight(c.startTime);
            if (startM !== null && startM > currentMins && startM <= currentMins + 60) {
              const key = `class-${c.id}-${todayStr}`;
              if (!sentKeys.has(key)) {
                sentKeys.add(key);
                updatedSent = true;
                const diff = startM - currentMins;
                const body = `Class starts in ${diff} min${diff === 1 ? '' : 's'}${c.room ? ` in Room ${c.room}` : ''}.`;
                try {
                  new Notification(`Upcoming Class: ${c.subject}`, { body, icon: '/icon.svg' });
                } catch {
                  // Notification delivery error
                }
              }
            }
          }
        }
      }

      // 2. Deadline reminders (due tomorrow)
      if (settings.reminders.deadlineReminders) {
        for (const d of deadlines) {
          if (!d.completed && calendarDaysFromToday(d.dueDate, now) === 1) {
            const key = `deadline-${d.id}-${todayStr}`;
            if (!sentKeys.has(key)) {
              sentKeys.add(key);
              updatedSent = true;
              try {
                new Notification(`Deadline Tomorrow: ${d.title}`, {
                  body: `${d.type} is due tomorrow (${formatLocalDateReadable(d.dueDate)}).`,
                  icon: '/icon.svg',
                });
              } catch {
                // Notification delivery error
              }
            }
          }
        }
      }

      // 3. Attendance risk reminders (any subject below required %)
      if (settings.reminders.attendanceRiskReminders) {
        for (const s of attendance) {
          if (s.total > 0) {
            const metrics = computeAttendanceMetrics(s);
            if (metrics.status === 'Below') {
              const key = `attend-risk-${s.id}-${todayStr}`;
              if (!sentKeys.has(key)) {
                sentKeys.add(key);
                updatedSent = true;
                try {
                  new Notification(`Attendance Warning: ${s.name}`, {
                    body: `Attendance is at ${metrics.percentage?.toFixed(1)}% (below target ${s.requiredPercentage}%). ${metrics.summaryText}`,
                    icon: '/icon.svg',
                  });
                } catch {
                  // Notification delivery error
                }
              }
            }
          }
        }
      }

      if (updatedSent) {
        try {
          localStorage.setItem(
            STORAGE_KEYS.remindersSent,
            JSON.stringify({ date: todayStr, keys: Array.from(sentKeys) })
          );
        } catch {
          // ignore
        }
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60_000);
    return () => clearInterval(interval);
  }, [settings.reminders, routine, deadlines, attendance, now]);

  const requestNotificationPermission = useCallback(async (): Promise<
    'granted' | 'denied' | 'unsupported'
  > => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return 'unsupported';
    }
    try {
      const res = await Notification.requestPermission();
      return res === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'unsupported';
    }
  }, []);

  // Routine Classes CRUD
  const saveRoutineClass = useCallback(
    (
      input: Omit<RoutineClass, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): RoutineClass => {
      const ts = Date.now();
      let saved!: RoutineClass;
      setRoutine((prev) => {
        const existing = input.id ? prev.find((r) => r.id === input.id) : undefined;
        saved = {
          id: existing ? existing.id : createId(),
          subject: input.subject.trim(),
          dayOfWeek: input.dayOfWeek,
          startTime: input.startTime.trim(),
          endTime: input.endTime.trim(),
          room: input.room.trim(),
          courseId: input.courseId ? input.courseId.trim() : undefined,
          createdAt: existing ? existing.createdAt : ts,
          updatedAt: ts,
        };
        const next = existing
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [...prev, saved];
        safePersist(STORAGE_KEYS.routine, next);
        return next;
      });
      return saved;
    },
    [safePersist]
  );

  const deleteRoutineClass = useCallback(
    (id: string) => {
      setRoutine((prev) => {
        const next = prev.filter((r) => r.id !== id);
        safePersist(STORAGE_KEYS.routine, next);
        return next;
      });
    },
    [safePersist]
  );

  const importRoutineClasses = useCallback(
    (imported: Array<Omit<RoutineClass, 'id' | 'createdAt' | 'updatedAt'>>): number => {
      const ts = Date.now();
      const newItems: RoutineClass[] = imported.map((item) => ({
        id: createId(),
        subject: item.subject.trim(),
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime.trim(),
        endTime: item.endTime.trim(),
        room: item.room ? item.room.trim() : '',
        courseId: item.courseId ? item.courseId.trim() : undefined,
        createdAt: ts,
        updatedAt: ts,
      }));

      setRoutine((prev) => {
        const next = [...prev, ...newItems];
        safePersist(STORAGE_KEYS.routine, next);
        return next;
      });
      return newItems.length;
    },
    [safePersist]
  );

  // Routine Courses CRUD
  const saveRoutineCourse = useCallback(
    (
      input: Omit<RoutineCourse, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): RoutineCourse => {
      const ts = Date.now();
      let saved!: RoutineCourse;
      setRoutineCourses((prev) => {
        const existing = input.id ? prev.find((c) => c.id === input.id) : undefined;
        saved = {
          id: existing ? existing.id : createId(),
          name: input.name.trim(),
          courseCode: input.courseCode.trim(),
          credits: input.credits,
          teacher: input.teacher.trim(),
          classroom: input.classroom.trim(),
          createdAt: existing ? existing.createdAt : ts,
          updatedAt: ts,
        };
        const next = existing
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [...prev, saved];
        safePersist(STORAGE_KEYS.routineCourses, next);
        return next;
      });
      return saved;
    },
    [safePersist]
  );

  const deleteRoutineCourse = useCallback(
    (id: string) => {
      setRoutineCourses((prev) => {
        const next = prev.filter((c) => c.id !== id);
        safePersist(STORAGE_KEYS.routineCourses, next);
        return next;
      });
    },
    [safePersist]
  );

  // Semester Settings & Holidays CRUD
  const updateSemesterSettings = useCallback(
    (patch: Partial<SemesterSettings>) => {
      setSemesterSettings((prev) => {
        const next: SemesterSettings = {
          ...prev,
          ...patch,
          holidays: patch.holidays ? patch.holidays : prev.holidays,
        };
        safePersist(STORAGE_KEYS.semesterSettings, next);
        return next;
      });
    },
    [safePersist]
  );

  const addHoliday = useCallback(
    (date: string, label: string): SemesterHoliday => {
      const holiday: SemesterHoliday = {
        id: createId(),
        date: date.trim(),
        label: label.trim(),
      };
      setSemesterSettings((prev) => {
        const next: SemesterSettings = {
          ...prev,
          holidays: [...prev.holidays, holiday],
        };
        safePersist(STORAGE_KEYS.semesterSettings, next);
        return next;
      });
      return holiday;
    },
    [safePersist]
  );

  const removeHoliday = useCallback(
    (id: string) => {
      setSemesterSettings((prev) => {
        const next: SemesterSettings = {
          ...prev,
          holidays: prev.holidays.filter((h) => h.id !== id),
        };
        safePersist(STORAGE_KEYS.semesterSettings, next);
        return next;
      });
    },
    [safePersist]
  );

  // Attendance CRUD + 4-way Actions & Undo
  const saveAttendanceSubject = useCallback(
    (
      input: Omit<AttendanceSubject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): AttendanceSubject => {
      const ts = Date.now();
      let saved!: AttendanceSubject;
      setAttendance((prev) => {
        const existing = input.id ? prev.find((a) => a.id === input.id) : undefined;
        saved = {
          id: existing ? existing.id : createId(),
          name: input.name.trim(),
          requiredPercentage: Math.round(input.requiredPercentage * 100) / 100,
          total: Math.trunc(input.total),
          attended: Math.trunc(input.attended),
          lateCount:
            input.lateCount !== undefined
              ? Math.trunc(input.lateCount)
              : (existing?.lateCount ?? 0),
          excusedCount:
            input.excusedCount !== undefined
              ? Math.trunc(input.excusedCount)
              : (existing?.excusedCount ?? 0),
          createdAt: existing ? existing.createdAt : ts,
          updatedAt: ts,
        };
        const next = existing
          ? prev.map((a) => (a.id === saved.id ? saved : a))
          : [...prev, saved];
        safePersist(STORAGE_KEYS.attendance, next);
        return next;
      });
      return saved;
    },
    [safePersist]
  );

  const markAttendance = useCallback(
    (subjectId: string, mark: AttendanceActionType) => {
      setAttendance((prev) => {
        const target = prev.find((a) => a.id === subjectId);
        if (!target) return prev;
        const curLate = target.lateCount ?? 0;
        const curExcused = target.excusedCount ?? 0;

        let label: 'Present' | 'Absent' | 'Late' | 'Excused' = 'Present';
        let newAttended = target.attended;
        let newTotal = target.total;
        let newLate = curLate;
        let newExcused = curExcused;

        if (mark === 'present') {
          label = 'Present';
          newAttended = target.attended + 1;
          newTotal = target.total + 1;
        } else if (mark === 'absent') {
          label = 'Absent';
          newTotal = target.total + 1;
        } else if (mark === 'late') {
          label = 'Late';
          newAttended = target.attended + 1;
          newTotal = target.total + 1;
          newLate = curLate + 1;
        } else if (mark === 'excused') {
          label = 'Excused';
          newExcused = curExcused + 1;
        }

        setAttendanceUndo({
          subjectId: target.id,
          subjectName: target.name,
          actionLabel: label,
          prevAttended: target.attended,
          prevTotal: target.total,
          prevLateCount: curLate,
          prevExcusedCount: curExcused,
          timestamp: Date.now(),
        });

        const updated: AttendanceSubject = {
          ...target,
          total: newTotal,
          attended: newAttended,
          lateCount: newLate,
          excusedCount: newExcused,
          updatedAt: Date.now(),
        };
        const next = prev.map((a) => (a.id === subjectId ? updated : a));
        safePersist(STORAGE_KEYS.attendance, next);
        return next;
      });
    },
    [safePersist]
  );

  const undoLastAttendance = useCallback(() => {
    if (!attendanceUndo) return;
    const undoSnap = attendanceUndo;
    setAttendance((prev) => {
      const next = prev.map((a) =>
        a.id === undoSnap.subjectId
          ? {
              ...a,
              attended: undoSnap.prevAttended,
              total: undoSnap.prevTotal,
              lateCount: undoSnap.prevLateCount,
              excusedCount: undoSnap.prevExcusedCount,
              updatedAt: Date.now(),
            }
          : a
      );
      safePersist(STORAGE_KEYS.attendance, next);
      return next;
    });
    setAttendanceUndo(null);
  }, [attendanceUndo, safePersist]);

  const dismissAttendanceUndo = useCallback(() => setAttendanceUndo(null), []);

  const deleteAttendanceSubject = useCallback(
    (id: string) => {
      setAttendance((prev) => {
        const next = prev.filter((a) => a.id !== id);
        safePersist(STORAGE_KEYS.attendance, next);
        return next;
      });
      setAttendanceUndo((prev) => (prev?.subjectId === id ? null : prev));
    },
    [safePersist]
  );

  // Semesters CRUD
  const saveSemester = useCallback(
    (
      input: Omit<CompletedSemester, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): CompletedSemester => {
      const ts = Date.now();
      let saved!: CompletedSemester;
      setSemesters((prev) => {
        const existing = input.id ? prev.find((s) => s.id === input.id) : undefined;
        saved = {
          id: existing ? existing.id : createId(),
          name: input.name.trim(),
          credits: input.credits,
          gpa: input.gpa,
          createdAt: existing ? existing.createdAt : ts,
          updatedAt: ts,
        };
        const next = existing
          ? prev.map((s) => (s.id === saved.id ? saved : s))
          : [...prev, saved];
        safePersist(STORAGE_KEYS.semesters, next);
        return next;
      });
      return saved;
    },
    [safePersist]
  );

  const deleteSemester = useCallback(
    (id: string) => {
      setSemesters((prev) => {
        const next = prev.filter((s) => s.id !== id);
        safePersist(STORAGE_KEYS.semesters, next);
        return next;
      });
    },
    [safePersist]
  );

  // Courses CRUD
  const saveCourse = useCallback(
    (
      input: Omit<CurrentCourse, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): CurrentCourse => {
      const ts = Date.now();
      let saved!: CurrentCourse;
      setCourses((prev) => {
        const existing = input.id ? prev.find((c) => c.id === input.id) : undefined;
        saved = {
          id: existing ? existing.id : createId(),
          name: input.name.trim(),
          credits: input.credits,
          expectedGradePoints: input.expectedGradePoints,
          createdAt: existing ? existing.createdAt : ts,
          updatedAt: ts,
        };
        const next = existing
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [...prev, saved];
        safePersist(STORAGE_KEYS.courses, next);
        return next;
      });
      return saved;
    },
    [safePersist]
  );

  const deleteCourse = useCallback(
    (id: string) => {
      setCourses((prev) => {
        const next = prev.filter((c) => c.id !== id);
        safePersist(STORAGE_KEYS.courses, next);
        return next;
      });
    },
    [safePersist]
  );

  // Deadlines CRUD
  const saveDeadline = useCallback(
    (
      input: Omit<DeadlineItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): DeadlineItem => {
      const ts = Date.now();
      let saved!: DeadlineItem;
      setDeadlines((prev) => {
        const existing = input.id ? prev.find((d) => d.id === input.id) : undefined;
        saved = {
          id: existing ? existing.id : createId(),
          title: input.title.trim(),
          type: input.type,
          dueDate: input.dueDate,
          completed: input.completed,
          createdAt: existing ? existing.createdAt : ts,
          updatedAt: ts,
        };
        const next = existing
          ? prev.map((d) => (d.id === saved.id ? saved : d))
          : [...prev, saved];
        safePersist(STORAGE_KEYS.deadlines, next);
        return next;
      });
      return saved;
    },
    [safePersist]
  );

  const toggleDeadlineComplete = useCallback(
    (id: string, completed: boolean) => {
      setDeadlines((prev) => {
        const next = prev.map((d) =>
          d.id === id ? { ...d, completed, updatedAt: Date.now() } : d
        );
        safePersist(STORAGE_KEYS.deadlines, next);
        return next;
      });
    },
    [safePersist]
  );

  const deleteDeadline = useCallback(
    (id: string) => {
      setDeadlines((prev) => {
        const next = prev.filter((d) => d.id !== id);
        safePersist(STORAGE_KEYS.deadlines, next);
        return next;
      });
    },
    [safePersist]
  );

  // Study Sessions & Pomodoro Timer
  const saveManualStudySession = useCallback(
    (input: { id?: string; date: string; minutes: number; label: string }): StudySession => {
      const ts = Date.now();
      let saved!: StudySession;
      setStudySessions((prev) => {
        const existing = input.id ? prev.find((s) => s.id === input.id) : undefined;
        saved = {
          id: existing ? existing.id : createId(),
          date: input.date,
          minutes: Math.round(input.minutes),
          source: 'manual',
          label: input.label.trim() || 'Study Session',
          createdAt: existing ? existing.createdAt : ts,
          updatedAt: ts,
        };
        const next = existing
          ? prev.map((s) => (s.id === saved.id ? saved : s))
          : [saved, ...prev];
        safePersist(STORAGE_KEYS.studySessions, next);
        return next;
      });
      return saved;
    },
    [safePersist]
  );

  const deleteStudySession = useCallback(
    (id: string) => {
      setStudySessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        safePersist(STORAGE_KEYS.studySessions, next);
        return next;
      });
    },
    [safePersist]
  );

  // Timer Tick & State
  useEffect(() => {
    if (studyTimer.status !== 'running') return;
    const interval = setInterval(() => {
      setTimerTickMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [studyTimer.status]);

  const timerRemainingMs = useMemo(() => {
    if (studyTimer.status === 'idle') return studyTimer.durationMs;
    let elapsed = studyTimer.accumulatedElapsedMs;
    if (studyTimer.status === 'running' && studyTimer.startedAtMs !== null) {
      elapsed += Math.max(0, timerTickMs - studyTimer.startedAtMs);
    }
    return Math.max(0, studyTimer.durationMs - elapsed);
  }, [
    studyTimer.status,
    studyTimer.durationMs,
    studyTimer.accumulatedElapsedMs,
    studyTimer.startedAtMs,
    timerTickMs,
  ]);

  // Check completion
  useEffect(() => {
    if (studyTimer.status === 'running' && timerRemainingMs <= 0) {
      const preset = STUDY_PRESETS[studyTimer.presetId];
      if (
        shouldSaveCompletedTimerSession(
          preset.mode,
          studyTimer.savedSessionToken === studyTimer.sessionToken
        )
      ) {
        const dateStr = toLocalDateString(new Date());
        const focusMins = Math.round(preset.minutes);
        const newSession: StudySession = {
          id: createId(),
          date: dateStr,
          minutes: focusMins,
          source: 'timer',
          label: `${preset.label} Complete`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setStudySessions((prev) => {
          const next = [newSession, ...prev];
          safePersist(STORAGE_KEYS.studySessions, next);
          return next;
        });
      }

      if (settings.soundEnabled) {
        playCompletionTone();
      }

      setTimerJustCompletedMessage(
        preset.mode === 'focus'
          ? `Great focus! You finished ${preset.label} (${preset.minutes} min). Take a well-earned break.`
          : `Break time is over! Ready for your next study block?`
      );

      const completedState: PersistedTimerState = {
        ...studyTimer,
        status: 'completed',
        startedAtMs: null,
        accumulatedElapsedMs: studyTimer.durationMs,
        savedSessionToken: studyTimer.sessionToken,
      };
      setStudyTimer(completedState);
      safePersist(STORAGE_KEYS.studyTimer, completedState);
    }
  }, [
    studyTimer,
    timerRemainingMs,
    settings.soundEnabled,
    safePersist,
  ]);

  const selectStudyPreset = useCallback(
    (presetId: StudyPresetId) => {
      const preset = STUDY_PRESETS[presetId];
      const next: PersistedTimerState = {
        presetId,
        mode: preset.mode,
        durationMs: preset.minutes * 60 * 1000,
        status: 'idle',
        startedAtMs: null,
        accumulatedElapsedMs: 0,
        sessionToken: createId(),
        savedSessionToken: null,
      };
      setStudyTimer(next);
      setTimerTickMs(Date.now());
      safePersist(STORAGE_KEYS.studyTimer, next);
    },
    [safePersist]
  );

  const startOrResumeTimer = useCallback(() => {
    const ts = Date.now();
    setStudyTimer((prev) => {
      const next: PersistedTimerState = {
        ...prev,
        status: 'running',
        startedAtMs: ts,
      };
      safePersist(STORAGE_KEYS.studyTimer, next);
      return next;
    });
    setTimerTickMs(ts);
  }, [safePersist]);

  const pauseTimer = useCallback(() => {
    const ts = Date.now();
    setStudyTimer((prev) => {
      if (prev.status !== 'running' || prev.startedAtMs === null) return prev;
      const newlyElapsed = Math.max(0, ts - prev.startedAtMs);
      const next: PersistedTimerState = {
        ...prev,
        status: 'paused',
        startedAtMs: null,
        accumulatedElapsedMs: prev.accumulatedElapsedMs + newlyElapsed,
      };
      safePersist(STORAGE_KEYS.studyTimer, next);
      return next;
    });
    setTimerTickMs(ts);
  }, [safePersist]);

  const resetTimer = useCallback(() => {
    setStudyTimer((prev) => {
      const next: PersistedTimerState = {
        ...prev,
        status: 'idle',
        startedAtMs: null,
        accumulatedElapsedMs: 0,
        sessionToken: createId(),
        savedSessionToken: null,
      };
      safePersist(STORAGE_KEYS.studyTimer, next);
      return next;
    });
    setTimerTickMs(Date.now());
  }, [safePersist]);

  const dismissTimerCompletedMessage = useCallback(() => {
    setTimerJustCompletedMessage(null);
  }, []);

  // Notes Management
  const openNewNoteImmediately = useCallback((): NoteItem => {
    const ts = Date.now();
    const newNote: NoteItem = {
      id: createId(),
      title: '',
      body: '',
      attachments: [],
      createdAt: ts,
      updatedAt: ts,
    };
    setNotes((prev) => {
      const next = [newNote, ...prev];
      safePersist(STORAGE_KEYS.notes, next);
      return next;
    });
    setActiveNoteId(newNote.id);
    return newNote;
  }, [safePersist]);

  const updateNoteTextSync = useCallback(
    (noteId: string, title: string, body: string): { ok: boolean; error?: string } => {
      const ts = Date.now();
      let res: { ok: boolean; error?: string } = { ok: true };
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === noteId ? { ...n, title, body, updatedAt: ts } : n
        );
        res = safePersist(STORAGE_KEYS.notes, next);
        return next;
      });
      return res;
    },
    [safePersist]
  );

  const attachMetaToNoteSync = useCallback(
    (noteId: string, meta: NoteAttachmentMeta): { ok: boolean; error?: string } => {
      let res: { ok: boolean; error?: string } = { ok: true };
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                attachments: [...n.attachments, meta],
                updatedAt: Date.now(),
              }
            : n
        );
        res = safePersist(STORAGE_KEYS.notes, next);
        return next;
      });
      return res;
    },
    [safePersist]
  );

  const removeAttachmentFromNoteSync = useCallback(
    (noteId: string, attachmentId: string): { ok: boolean; error?: string } => {
      let res: { ok: boolean; error?: string } = { ok: true };
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                attachments: n.attachments.filter((a) => a.id !== attachmentId),
                updatedAt: Date.now(),
              }
            : n
        );
        res = safePersist(STORAGE_KEYS.notes, next);
        return next;
      });
      return res;
    },
    [safePersist]
  );

  const deleteNoteWithCleanup = useCallback(
    async (noteId: string): Promise<{ deletedNote: boolean; cleanupError?: string }> => {
      const target = notes.find((n) => n.id === noteId);
      const attIds = target ? target.attachments.map((a) => a.id) : [];

      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== noteId);
        safePersist(STORAGE_KEYS.notes, next);
        return next;
      });

      if (attIds.length > 0) {
        try {
          await deleteAttachmentsForNote(noteId, attIds);
          return { deletedNote: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Orphan cleanup error';
          setPendingCleanupIds((prev) => {
            const next = Array.from(new Set([...prev, ...attIds]));
            safePersist(STORAGE_KEYS.pendingCleanupIds, next);
            return next;
          });
          return { deletedNote: true, cleanupError: msg };
        }
      }
      return { deletedNote: true };
    },
    [notes, safePersist]
  );

  const retryPendingAttachmentCleanup = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (pendingCleanupIds.length === 0) return { ok: true };
    try {
      await deleteAttachmentBlobsByIds(pendingCleanupIds);
      setPendingCleanupIds([]);
      safePersist(STORAGE_KEYS.pendingCleanupIds, []);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Retry cleanup failed.';
      return { ok: false, error: msg };
    }
  }, [pendingCleanupIds, safePersist]);

  // Full Backup Export
  const exportBackupJson = useCallback(async (): Promise<string> => {
    const currentSnap: LocalSnapshot = {
      settings,
      routine,
      routineCourses,
      semesterSettings,
      attendance,
      semesters,
      courses,
      deadlines,
      studySessions,
      studyTimer,
      notes,
      pendingCleanupIds,
      // Transcript state lives in its own component, not in this context,
      // so it is read fresh from its storage key at export time.
      transcript: readTranscriptStateFromStorage(),
    };
    const archive = await buildBackupArchive(currentSnap);
    return JSON.stringify(archive, null, 2);
  }, [
    settings,
    routine,
    routineCourses,
    semesterSettings,
    attendance,
    semesters,
    courses,
    deadlines,
    studySessions,
    studyTimer,
    notes,
    pendingCleanupIds,
  ]);

  // Full Backup Restore
  const restoreFromValidatedBackup = useCallback(
    async (payload: ValidatedBackupPayload, mode: 'merge' | 'replace'): Promise<void> => {
      const currentSnap: LocalSnapshot = {
        settings,
        routine,
        routineCourses,
        semesterSettings,
        attendance,
        semesters,
        courses,
        deadlines,
        studySessions,
        studyTimer,
        notes,
        pendingCleanupIds,
        transcript: readTranscriptStateFromStorage(),
      };
      const restored = await executeValidatedRestore(currentSnap, payload, mode);
      // The transcript calculator keeps its own in-memory state, so tell
      // it to reload from the restored storage key (replace mode) or the
      // unchanged key (merge mode keeps the current transcript).
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('campuskit:transcript-restored'));
      }
      setSettings(restored.settings);
      setRoutine(restored.routine);
      setRoutineCourses(restored.routineCourses);
      setSemesterSettings(restored.semesterSettings);
      setAttendance(restored.attendance);
      setAttendanceUndo(null);
      setSemesters(restored.semesters);
      setCourses(restored.courses);
      setDeadlines(restored.deadlines);
      setStudySessions(restored.studySessions);
      setStudyTimer(restored.studyTimer);
      setNotes(restored.notes);
      setActiveNoteId(null);
      setPendingCleanupIds(restored.pendingCleanupIds);
    },
    [
      settings,
      routine,
      routineCourses,
      semesterSettings,
      attendance,
      semesters,
      courses,
      deadlines,
      studySessions,
      studyTimer,
      notes,
      pendingCleanupIds,
    ]
  );

  // Clear All Data
  const clearAllAppData = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      await clearAllAttachmentBlobs();
      for (const key of Object.values(STORAGE_KEYS)) {
        localStorage.removeItem(key);
      }
      const freshTimer = { ...DEFAULT_TIMER_STATE, sessionToken: createId() };
      setSettings({ ...DEFAULT_SETTINGS });
      setRoutine([]);
      setRoutineCourses([]);
      setSemesterSettings({ ...DEFAULT_SEMESTER_SETTINGS });
      setAttendance([]);
      setAttendanceUndo(null);
      setSemesters([]);
      setCourses([]);
      setDeadlines([]);
      setStudySessions([]);
      setStudyTimer(freshTimer);
      setTimerJustCompletedMessage(null);
      setNotes([]);
      setActiveNoteId(null);
      setPendingCleanupIds([]);
      // STORAGE_KEYS now includes the transcript key, so the loop above
      // already removed it; notify its component to reset to blank state.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('campuskit:transcript-restored'));
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to clear all local storage.',
      };
    }
  }, []);

  const clearStorageErrorBanner = useCallback(() => setStorageErrorBanner(null), []);

  const value = useMemo<CampusKitContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      quickModal,
      setQuickModal,
      now,
      settings,
      updateSettings,
      routine,
      saveRoutineClass,
      deleteRoutineClass,
      importRoutineClasses,
      routineCourses,
      saveRoutineCourse,
      deleteRoutineCourse,
      semesterSettings,
      updateSemesterSettings,
      addHoliday,
      removeHoliday,
      attendance,
      attendanceUndo,
      dismissAttendanceUndo,
      undoLastAttendance,
      saveAttendanceSubject,
      markAttendance,
      deleteAttendanceSubject,
      semesters,
      saveSemester,
      deleteSemester,
      courses,
      saveCourse,
      deleteCourse,
      deadlines,
      saveDeadline,
      toggleDeadlineComplete,
      deleteDeadline,
      studySessions,
      studyTimer,
      timerRemainingMs,
      timerJustCompletedMessage,
      dismissTimerCompletedMessage,
      selectStudyPreset,
      startOrResumeTimer,
      pauseTimer,
      resetTimer,
      saveManualStudySession,
      deleteStudySession,
      notes,
      activeNoteId,
      setActiveNoteId,
      openNewNoteImmediately,
      updateNoteTextSync,
      attachMetaToNoteSync,
      removeAttachmentFromNoteSync,
      deleteNoteWithCleanup,
      pendingCleanupIds,
      retryPendingAttachmentCleanup,
      requestNotificationPermission,
      exportBackupJson,
      restoreFromValidatedBackup,
      clearAllAppData,
      storageErrorBanner,
      clearStorageErrorBanner,
    }),
    [
      activeTab,
      quickModal,
      now,
      settings,
      updateSettings,
      routine,
      saveRoutineClass,
      deleteRoutineClass,
      importRoutineClasses,
      routineCourses,
      saveRoutineCourse,
      deleteRoutineCourse,
      semesterSettings,
      updateSemesterSettings,
      addHoliday,
      removeHoliday,
      attendance,
      attendanceUndo,
      dismissAttendanceUndo,
      undoLastAttendance,
      saveAttendanceSubject,
      markAttendance,
      deleteAttendanceSubject,
      semesters,
      saveSemester,
      deleteSemester,
      courses,
      saveCourse,
      deleteCourse,
      deadlines,
      saveDeadline,
      toggleDeadlineComplete,
      deleteDeadline,
      studySessions,
      studyTimer,
      timerRemainingMs,
      timerJustCompletedMessage,
      dismissTimerCompletedMessage,
      selectStudyPreset,
      startOrResumeTimer,
      pauseTimer,
      resetTimer,
      saveManualStudySession,
      deleteStudySession,
      notes,
      activeNoteId,
      openNewNoteImmediately,
      updateNoteTextSync,
      attachMetaToNoteSync,
      removeAttachmentFromNoteSync,
      deleteNoteWithCleanup,
      pendingCleanupIds,
      retryPendingAttachmentCleanup,
      requestNotificationPermission,
      exportBackupJson,
      restoreFromValidatedBackup,
      clearAllAppData,
      storageErrorBanner,
      clearStorageErrorBanner,
    ]
  );

  return <CampusKitContext.Provider value={value}>{children}</CampusKitContext.Provider>;
};

export function useCampusKit(): CampusKitContextValue {
  const ctx = useContext(CampusKitContext);
  if (!ctx) {
    throw new Error('useCampusKit must be used within CampusKitProvider');
  }
  return ctx;
}

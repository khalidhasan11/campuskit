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
  AttendanceSubject,
  CompletedSemester,
  CurrentCourse,
  DeadlineItem,
  NoteAttachmentMeta,
  NoteItem,
  PersistedTimerState,
  RoutineClass,
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
  DEFAULT_SETTINGS,
  DEFAULT_TIMER_STATE,
  LocalSnapshot,
  STORAGE_KEYS,
  buildBackupArchive,
  createId,
  executeValidatedRestore,
  loadInitialSnapshot,
  ValidatedBackupPayload,
  writeStorageJson,
} from '../storage/localStore';
import { toLocalDateString } from '../utils/dateAndMath';

export const STUDY_PRESETS: Record<
  StudyPresetId,
  { id: StudyPresetId; label: string; minutes: number; mode: 'focus' | 'break' }
> = {
  'focus-25': { id: 'focus-25', label: 'Focus 25', minutes: 25, mode: 'focus' },
  'focus-50': { id: 'focus-50', label: 'Focus 50', minutes: 50, mode: 'focus' },
  'break-5': { id: 'break-5', label: 'Break 5', minutes: 5, mode: 'break' },
  'break-15': { id: 'break-15', label: 'Break 15', minutes: 15, mode: 'break' },
};

export interface AttendanceUndoState {
  subjectId: string;
  subjectName: string;
  actionLabel: 'Present' | 'Absent';
  prevAttended: number;
  prevTotal: number;
  timestamp: number;
}

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

  attendance: AttendanceSubject[];
  attendanceUndo: AttendanceUndoState | null;
  dismissAttendanceUndo: () => void;
  undoLastAttendance: () => void;
  saveAttendanceSubject: (
    input: Omit<AttendanceSubject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => AttendanceSubject;
  markAttendance: (subjectId: string, mark: 'present' | 'absent') => void;
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
    if (ctx.state === 'suspended') {
      ctx.close().catch(() => {});
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.48);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Optional audio playback
  }
}

export const CampusKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialRef = useRef<LocalSnapshot | null>(null);
  if (!initialRef.current) {
    initialRef.current = loadInitialSnapshot();
  }
  const init = initialRef.current;

  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [quickModal, setQuickModal] = useState<QuickModalRequest>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const [settings, setSettings] = useState<AppSettings>(init.settings);
  const [routine, setRoutine] = useState<RoutineClass[]>(init.routine);
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
    window.addEventListener('focus', refreshClock);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refreshClock);
    };
  }, []);

  const finalizingTokenRef = useRef<string | null>(null);

  const checkAndFinalizeCompletedTimer = useCallback(
    (currentTimer: PersistedTimerState, currentNowMs: number) => {
      if (currentTimer.status !== 'running' || currentTimer.startedAtMs === null) return;
      const totalElapsed =
        currentTimer.accumulatedElapsedMs + Math.max(0, currentNowMs - currentTimer.startedAtMs);
      if (totalElapsed < currentTimer.durationMs) return;

      if (finalizingTokenRef.current === currentTimer.sessionToken) return;
      finalizingTokenRef.current = currentTimer.sessionToken;

      const exactCompletedAtMs =
        currentTimer.startedAtMs +
        Math.max(0, currentTimer.durationMs - currentTimer.accumulatedElapsedMs);

      const completedTimerState: PersistedTimerState = {
        ...currentTimer,
        status: 'completed',
        startedAtMs: null,
        accumulatedElapsedMs: currentTimer.durationMs,
        savedSessionToken:
          currentTimer.mode === 'focus'
            ? currentTimer.sessionToken
            : currentTimer.savedSessionToken,
      };

      setStudyTimer(completedTimerState);
      safePersist(STORAGE_KEYS.studyTimer, completedTimerState);

      if (
        currentTimer.mode === 'focus' &&
        currentTimer.savedSessionToken !== currentTimer.sessionToken
      ) {
        const focusMinutes = Math.round(currentTimer.durationMs / 60_000);
        const presetMeta = STUDY_PRESETS[currentTimer.presetId];
        const completionDateStr = toLocalDateString(new Date(exactCompletedAtMs));

        setStudySessions((prev) => {
          if (prev.some((s) => s.id === currentTimer.sessionToken)) {
            return prev;
          }
          const newSession: StudySession = {
            id: currentTimer.sessionToken,
            date: completionDateStr,
            minutes: focusMinutes,
            source: 'timer',
            label: presetMeta ? `${presetMeta.label} session` : `Focus ${focusMinutes}m`,
            createdAt: exactCompletedAtMs,
            updatedAt: Date.now(),
          };
          const next = [newSession, ...prev];
          safePersist(STORAGE_KEYS.studySessions, next);
          return next;
        });

        setTimerJustCompletedMessage(
          `${focusMinutes} focus minutes recorded for ${completionDateStr}.`
        );
      } else if (currentTimer.mode === 'break') {
        setTimerJustCompletedMessage('Break finished. Ready for your next focus block.');
      }

      if (settings.soundEnabled && document.visibilityState === 'visible') {
        playCompletionTone();
      }
      setNow(new Date());
    },
    [safePersist, settings.soundEnabled]
  );

  useEffect(() => {
    checkAndFinalizeCompletedTimer(studyTimer, Date.now());
    if (studyTimer.status !== 'running') return;

    const interval = window.setInterval(() => {
      const ms = Date.now();
      setTimerTickMs(ms);
      checkAndFinalizeCompletedTimer(studyTimer, ms);
    }, 250);

    return () => window.clearInterval(interval);
  }, [studyTimer, checkAndFinalizeCompletedTimer]);

  const timerRemainingMs = useMemo(() => {
    if (studyTimer.status === 'completed') return 0;
    const liveDelta =
      studyTimer.status === 'running' && studyTimer.startedAtMs !== null
        ? Math.max(0, timerTickMs - studyTimer.startedAtMs)
        : 0;
    const elapsed = studyTimer.accumulatedElapsedMs + liveDelta;
    return Math.max(0, studyTimer.durationMs - elapsed);
  }, [studyTimer, timerTickMs]);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        safePersist(STORAGE_KEYS.settings, next);
        return next;
      });
    },
    [safePersist]
  );

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
    (subjectId: string, mark: 'present' | 'absent') => {
      setAttendance((prev) => {
        const target = prev.find((a) => a.id === subjectId);
        if (!target) return prev;
        setAttendanceUndo({
          subjectId: target.id,
          subjectName: target.name,
          actionLabel: mark === 'present' ? 'Present' : 'Absent',
          prevAttended: target.attended,
          prevTotal: target.total,
          timestamp: Date.now(),
        });
        const updated: AttendanceSubject = {
          ...target,
          total: target.total + 1,
          attended: mark === 'present' ? target.attended + 1 : target.attended,
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
          dueDate: input.dueDate.trim(),
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

  const selectStudyPreset = useCallback(
    (presetId: StudyPresetId) => {
      const preset = STUDY_PRESETS[presetId];
      finalizingTokenRef.current = null;
      const next: PersistedTimerState = {
        presetId: preset.id,
        mode: preset.mode,
        durationMs: preset.minutes * 60 * 1000,
        status: 'idle',
        startedAtMs: null,
        accumulatedElapsedMs: 0,
        sessionToken: createId(),
        savedSessionToken: null,
      };
      setTimerTickMs(Date.now());
      setTimerJustCompletedMessage(null);
      setStudyTimer(next);
      safePersist(STORAGE_KEYS.studyTimer, next);
    },
    [safePersist]
  );

  const startOrResumeTimer = useCallback(() => {
    const ms = Date.now();
    setTimerTickMs(ms);
    setTimerJustCompletedMessage(null);
    setStudyTimer((prev) => {
      if (prev.status === 'running') return prev;
      const isFreshStart = prev.status === 'idle' || prev.status === 'completed';
      const token = isFreshStart ? createId() : prev.sessionToken;
      if (isFreshStart) {
        finalizingTokenRef.current = null;
      }
      const next: PersistedTimerState = {
        ...prev,
        status: 'running',
        startedAtMs: ms,
        accumulatedElapsedMs: isFreshStart ? 0 : prev.accumulatedElapsedMs,
        sessionToken: token,
        savedSessionToken: isFreshStart ? null : prev.savedSessionToken,
      };
      safePersist(STORAGE_KEYS.studyTimer, next);
      return next;
    });
  }, [safePersist]);

  const pauseTimer = useCallback(() => {
    const ms = Date.now();
    setTimerTickMs(ms);
    setStudyTimer((prev) => {
      if (prev.status !== 'running' || prev.startedAtMs === null) return prev;
      const elapsed = Math.min(
        prev.durationMs,
        prev.accumulatedElapsedMs + Math.max(0, ms - prev.startedAtMs)
      );
      const next: PersistedTimerState = {
        ...prev,
        status: 'paused',
        startedAtMs: null,
        accumulatedElapsedMs: elapsed,
      };
      safePersist(STORAGE_KEYS.studyTimer, next);
      return next;
    });
  }, [safePersist]);

  const resetTimer = useCallback(() => {
    finalizingTokenRef.current = null;
    setTimerTickMs(Date.now());
    setTimerJustCompletedMessage(null);
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
  }, [safePersist]);

  const dismissTimerCompletedMessage = useCallback(
    () => setTimerJustCompletedMessage(null),
    []
  );

  const saveManualStudySession = useCallback(
    (input: { id?: string; date: string; minutes: number; label: string }): StudySession => {
      const ts = Date.now();
      let saved!: StudySession;
      setStudySessions((prev) => {
        const existing = input.id ? prev.find((s) => s.id === input.id) : undefined;
        saved = {
          id: existing ? existing.id : createId(),
          date: input.date.trim(),
          minutes: Math.trunc(input.minutes),
          source: existing ? existing.source : 'manual',
          label: input.label.trim() || 'Manual study log',
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
      try {
        writeStorageJson(STORAGE_KEYS.notes, next);
      } catch {
        // Handled in editor
      }
      return next;
    });
    setActiveNoteId(newNote.id);
    setActiveTab('notes');
    return newNote;
  }, []);

  const updateNoteTextSync = useCallback(
    (noteId: string, title: string, body: string): { ok: boolean; error?: string } => {
      const ts = Date.now();
      let writeResult: { ok: boolean; error?: string } = { ok: true };
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === noteId ? { ...n, title, body, updatedAt: ts } : n
        );
        try {
          writeStorageJson(STORAGE_KEYS.notes, next);
        } catch (err) {
          writeResult = {
            ok: false,
            error:
              err instanceof Error ? err.message : 'Unable to save note text to localStorage.',
          };
        }
        return next;
      });
      return writeResult;
    },
    []
  );

  const attachMetaToNoteSync = useCallback(
    (noteId: string, meta: NoteAttachmentMeta): { ok: boolean; error?: string } => {
      const ts = Date.now();
      let writeResult: { ok: boolean; error?: string } = { ok: true };
      setNotes((prev) => {
        const next = prev.map((n) => {
          if (n.id !== noteId) return n;
          const exists = n.attachments.some((a) => a.id === meta.id);
          return {
            ...n,
            attachments: exists ? n.attachments : [...n.attachments, meta],
            updatedAt: ts,
          };
        });
        try {
          writeStorageJson(STORAGE_KEYS.notes, next);
        } catch (err) {
          writeResult = {
            ok: false,
            error:
              err instanceof Error
                ? err.message
                : 'Unable to save attachment reference to localStorage.',
          };
        }
        return next;
      });
      return writeResult;
    },
    []
  );

  const removeAttachmentFromNoteSync = useCallback(
    (noteId: string, attachmentId: string): { ok: boolean; error?: string } => {
      const ts = Date.now();
      let writeResult: { ok: boolean; error?: string } = { ok: true };
      setNotes((prev) => {
        const next = prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                attachments: n.attachments.filter((a) => a.id !== attachmentId),
                updatedAt: ts,
              }
            : n
        );
        try {
          writeStorageJson(STORAGE_KEYS.notes, next);
        } catch (err) {
          writeResult = {
            ok: false,
            error:
              err instanceof Error ? err.message : 'Failed to update note metadata.',
          };
        }
        return next;
      });
      return writeResult;
    },
    []
  );

  const deleteNoteWithCleanup = useCallback(
    async (noteId: string): Promise<{ deletedNote: boolean; cleanupError?: string }> => {
      const targetNote = notes.find((n) => n.id === noteId);
      const attachmentIds = targetNote ? targetNote.attachments.map((a) => a.id) : [];

      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== noteId);
        safePersist(STORAGE_KEYS.notes, next);
        return next;
      });
      setActiveNoteId((prev) => (prev === noteId ? null : prev));

      if (attachmentIds.length === 0) {
        try {
          await deleteAttachmentsForNote(noteId, []);
        } catch {
          // ignore
        }
        return { deletedNote: true };
      }

      try {
        await deleteAttachmentsForNote(noteId, attachmentIds);
        return { deletedNote: true };
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : 'Note was deleted, but cleaning up its attachment blobs in IndexedDB failed.';
        setPendingCleanupIds((prev) => {
          const merged = Array.from(new Set([...prev, ...attachmentIds]));
          safePersist(STORAGE_KEYS.pendingCleanupIds, merged);
          return merged;
        });
        return { deletedNote: true, cleanupError: errMsg };
      }
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
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Attachment storage cleanup failed again. Please retry.',
      };
    }
  }, [pendingCleanupIds, safePersist]);

  const exportBackupJson = useCallback(async (): Promise<string> => {
    const snapshot: LocalSnapshot = {
      settings,
      routine,
      attendance,
      semesters,
      courses,
      deadlines,
      studySessions,
      studyTimer,
      notes,
      pendingCleanupIds,
    };
    const archive = await buildBackupArchive(snapshot);
    return JSON.stringify(archive, null, 2);
  }, [
    settings,
    routine,
    attendance,
    semesters,
    courses,
    deadlines,
    studySessions,
    studyTimer,
    notes,
    pendingCleanupIds,
  ]);

  const restoreFromValidatedBackup = useCallback(
    async (payload: ValidatedBackupPayload, mode: 'merge' | 'replace'): Promise<void> => {
      const currentSnap: LocalSnapshot = {
        settings,
        routine,
        attendance,
        semesters,
        courses,
        deadlines,
        studySessions,
        studyTimer,
        notes,
        pendingCleanupIds,
      };
      const restored = await executeValidatedRestore(currentSnap, payload, mode);
      setSettings(restored.settings);
      setRoutine(restored.routine);
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

  const clearAllAppData = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      await clearAllAttachmentBlobs();
      for (const key of Object.values(STORAGE_KEYS)) {
        localStorage.removeItem(key);
      }
      const freshTimer = { ...DEFAULT_TIMER_STATE, sessionToken: createId() };
      setSettings({ ...DEFAULT_SETTINGS });
      setRoutine([]);
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

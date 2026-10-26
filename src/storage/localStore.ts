import type {
  AppSettings,
  AttachmentKind,
  AttendanceSubject,
  BackupArchive,
  ClockFormat,
  CompletedSemester,
  CurrentCourse,
  DeadlineItem,
  DeadlineType,
  NoteAttachmentMeta,
  NoteItem,
  PersistedTimerState,
  ReminderSettings,
  RoutineClass,
  RoutineCourse,
  SemesterHoliday,
  SemesterSettings,
  SerializedBackupAttachment,
  StoredAttachmentBlob,
  StudyPresetId,
  StudySession,
  ThemePreference,
  WeekStart,
} from '../types/campuskit';
import { parseLocalDateParts, parseMinutesFromMidnight } from '../utils/dateAndMath';
import {
  base64ToBlob,
  blobToBase64,
  getAllAttachmentBlobs,
  replaceAllAttachmentBlobs,
} from './blobDb';

export const STORAGE_KEYS = {
  settings: 'campuskit_v1_settings',
  routine: 'campuskit_v1_routine',
  attendance: 'campuskit_v1_attendance',
  semesters: 'campuskit_v1_semesters',
  courses: 'campuskit_v1_courses',
  deadlines: 'campuskit_v1_deadlines',
  studySessions: 'campuskit_v1_study_sessions',
  studyTimer: 'campuskit_v1_study_timer',
  notes: 'campuskit_v1_notes',
  pendingCleanupIds: 'campuskit_v1_pending_cleanup_ids',
  routineCourses: 'campuskit_v1_routine_courses',
  semesterSettings: 'campuskit_v1_semester_settings',
  remindersSent: 'campuskit_v1_reminders_sent',
} as const;

export const MAX_BACKUP_FILE_BYTES = 80 * 1024 * 1024;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  clockFormat: '12h',
  weekStart: 'sunday',
  soundEnabled: true,
  gradingScaleMax: 4.0,
  reminders: {
    classReminders: false,
    deadlineReminders: false,
    attendanceRiskReminders: false,
  },
};

export const DEFAULT_SEMESTER_SETTINGS: SemesterSettings = {
  semesterName: '',
  startDate: '',
  endDate: '',
  holidays: [],
};

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_TIMER_STATE: PersistedTimerState = {
  presetId: 'focus-25',
  mode: 'focus',
  durationMs: 25 * 60 * 1000,
  status: 'idle',
  startedAtMs: null,
  accumulatedElapsedMs: 0,
  sessionToken: 'initial',
  savedSessionToken: null,
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown, maxLen = 500): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLen;
}

function isValidTimestamp(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function validateSettings(raw: unknown): AppSettings {
  if (!isObject(raw)) return { ...DEFAULT_SETTINGS };
  const theme: ThemePreference =
    raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system'
      ? raw.theme
      : DEFAULT_SETTINGS.theme;
  const clockFormat: ClockFormat =
    raw.clockFormat === '12h' || raw.clockFormat === '24h'
      ? raw.clockFormat
      : DEFAULT_SETTINGS.clockFormat;
  const weekStart: WeekStart =
    raw.weekStart === 'saturday' || raw.weekStart === 'sunday' || raw.weekStart === 'monday'
      ? raw.weekStart
      : DEFAULT_SETTINGS.weekStart;
  const soundEnabled =
    typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : DEFAULT_SETTINGS.soundEnabled;

  const gradingScaleMax =
    typeof raw.gradingScaleMax === 'number' &&
    Number.isFinite(raw.gradingScaleMax) &&
    raw.gradingScaleMax >= 2.0 &&
    raw.gradingScaleMax <= 10.0
      ? Math.round(raw.gradingScaleMax * 100) / 100
      : DEFAULT_SETTINGS.gradingScaleMax;

  const rawRem = isObject(raw.reminders) ? raw.reminders : {};
  const reminders: ReminderSettings = {
    classReminders: typeof rawRem.classReminders === 'boolean' ? rawRem.classReminders : false,
    deadlineReminders:
      typeof rawRem.deadlineReminders === 'boolean' ? rawRem.deadlineReminders : false,
    attendanceRiskReminders:
      typeof rawRem.attendanceRiskReminders === 'boolean' ? rawRem.attendanceRiskReminders : false,
  };

  return { theme, clockFormat, weekStart, soundEnabled, gradingScaleMax, reminders };
}

export function validateSemesterSettings(raw: unknown): SemesterSettings {
  if (!isObject(raw)) return { ...DEFAULT_SEMESTER_SETTINGS };
  const semesterName =
    typeof raw.semesterName === 'string' ? raw.semesterName.trim().slice(0, 120) : '';
  const startDate =
    typeof raw.startDate === 'string' && parseLocalDateParts(raw.startDate)
      ? raw.startDate.trim()
      : '';
  const endDate =
    typeof raw.endDate === 'string' && parseLocalDateParts(raw.endDate) ? raw.endDate.trim() : '';

  const holidays: SemesterHoliday[] = [];
  if (Array.isArray(raw.holidays)) {
    const seenIds = new Set<string>();
    for (const h of raw.holidays) {
      if (
        isObject(h) &&
        typeof h.date === 'string' &&
        parseLocalDateParts(h.date) &&
        typeof h.label === 'string' &&
        h.label.trim().length > 0
      ) {
        const id = isNonEmptyString(h.id, 120) ? h.id.trim() : createId();
        if (!seenIds.has(id)) {
          seenIds.add(id);
          holidays.push({
            id,
            date: h.date.trim(),
            label: h.label.trim().slice(0, 150),
          });
        }
      }
    }
  }

  return { semesterName, startDate, endDate, holidays };
}

export function validateRoutineCourse(raw: unknown): RoutineCourse | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120) || !isNonEmptyString(raw.name, 200)) return null;
  const courseCode = typeof raw.courseCode === 'string' ? raw.courseCode.trim().slice(0, 60) : '';
  const credits =
    typeof raw.credits === 'number' && Number.isFinite(raw.credits) && raw.credits > 0
      ? raw.credits
      : 3;
  const teacher = typeof raw.teacher === 'string' ? raw.teacher.trim().slice(0, 120) : '';
  const classroom = typeof raw.classroom === 'string' ? raw.classroom.trim().slice(0, 120) : '';
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id: raw.id.trim(),
    name: raw.name.trim(),
    courseCode,
    credits,
    teacher,
    classroom,
    createdAt,
    updatedAt,
  };
}

export function validateRoutineClass(raw: unknown): RoutineClass | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120) || !isNonEmptyString(raw.subject, 200)) return null;
  if (
    typeof raw.dayOfWeek !== 'number' ||
    !Number.isInteger(raw.dayOfWeek) ||
    raw.dayOfWeek < 0 ||
    raw.dayOfWeek > 6
  ) {
    return null;
  }
  if (typeof raw.startTime !== 'string' || typeof raw.endTime !== 'string') return null;
  const startM = parseMinutesFromMidnight(raw.startTime);
  const endM = parseMinutesFromMidnight(raw.endTime);
  if (startM === null || endM === null || endM <= startM) return null;
  const room = typeof raw.room === 'string' ? raw.room.slice(0, 120) : '';
  const courseId = isNonEmptyString(raw.courseId, 120) ? raw.courseId.trim() : undefined;
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id: raw.id.trim(),
    subject: raw.subject.trim(),
    dayOfWeek: raw.dayOfWeek,
    startTime: raw.startTime.trim(),
    endTime: raw.endTime.trim(),
    room: room.trim(),
    courseId,
    createdAt,
    updatedAt,
  };
}

export function validateAttendanceSubject(raw: unknown): AttendanceSubject | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120) || !isNonEmptyString(raw.name, 200)) return null;
  if (
    typeof raw.requiredPercentage !== 'number' ||
    !Number.isFinite(raw.requiredPercentage) ||
    raw.requiredPercentage <= 0 ||
    raw.requiredPercentage > 100
  ) {
    return null;
  }
  if (
    typeof raw.total !== 'number' ||
    !Number.isInteger(raw.total) ||
    raw.total < 0 ||
    typeof raw.attended !== 'number' ||
    !Number.isInteger(raw.attended) ||
    raw.attended < 0 ||
    raw.attended > raw.total
  ) {
    return null;
  }
  const lateCount =
    typeof raw.lateCount === 'number' && Number.isInteger(raw.lateCount) && raw.lateCount >= 0
      ? raw.lateCount
      : 0;
  const excusedCount =
    typeof raw.excusedCount === 'number' && Number.isInteger(raw.excusedCount) && raw.excusedCount >= 0
      ? raw.excusedCount
      : 0;
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id: raw.id.trim(),
    name: raw.name.trim(),
    requiredPercentage: Math.round(raw.requiredPercentage * 100) / 100,
    total: raw.total,
    attended: raw.attended,
    lateCount,
    excusedCount,
    createdAt,
    updatedAt,
  };
}

export function validateCompletedSemester(raw: unknown): CompletedSemester | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120) || !isNonEmptyString(raw.name, 200)) return null;
  if (
    typeof raw.credits !== 'number' ||
    !Number.isFinite(raw.credits) ||
    raw.credits <= 0 ||
    raw.credits > 200
  ) {
    return null;
  }
  if (
    typeof raw.gpa !== 'number' ||
    !Number.isFinite(raw.gpa) ||
    raw.gpa < 0 ||
    raw.gpa > 10.0
  ) {
    return null;
  }
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id: raw.id.trim(),
    name: raw.name.trim(),
    credits: Math.round(raw.credits * 100) / 100,
    gpa: Math.round(raw.gpa * 100) / 100,
    createdAt,
    updatedAt,
  };
}

export function validateCurrentCourse(raw: unknown): CurrentCourse | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120) || !isNonEmptyString(raw.name, 200)) return null;
  if (
    typeof raw.credits !== 'number' ||
    !Number.isFinite(raw.credits) ||
    raw.credits <= 0 ||
    raw.credits > 50
  ) {
    return null;
  }
  if (
    typeof raw.expectedGradePoints !== 'number' ||
    !Number.isFinite(raw.expectedGradePoints) ||
    raw.expectedGradePoints < 0 ||
    raw.expectedGradePoints > 10.0
  ) {
    return null;
  }
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id: raw.id.trim(),
    name: raw.name.trim(),
    credits: Math.round(raw.credits * 100) / 100,
    expectedGradePoints: Math.round(raw.expectedGradePoints * 100) / 100,
    createdAt,
    updatedAt,
  };
}

export function validateDeadlineItem(raw: unknown): DeadlineItem | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120) || !isNonEmptyString(raw.title, 250)) return null;
  const validTypes: DeadlineType[] = ['Exam', 'Assignment', 'Quiz'];
  if (!validTypes.includes(raw.type as DeadlineType)) return null;
  if (typeof raw.dueDate !== 'string' || !parseLocalDateParts(raw.dueDate)) return null;
  const completed = typeof raw.completed === 'boolean' ? raw.completed : false;
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id: raw.id.trim(),
    title: raw.title.trim(),
    type: raw.type as DeadlineType,
    dueDate: raw.dueDate.trim(),
    completed,
    createdAt,
    updatedAt,
  };
}

export function validateStudySession(raw: unknown): StudySession | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120)) return null;
  if (typeof raw.date !== 'string' || !parseLocalDateParts(raw.date)) return null;
  if (
    typeof raw.minutes !== 'number' ||
    !Number.isInteger(raw.minutes) ||
    raw.minutes < 1 ||
    raw.minutes > 1440
  ) {
    return null;
  }
  const source: 'timer' | 'manual' = raw.source === 'timer' ? 'timer' : 'manual';
  const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 120) : '';
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id: raw.id.trim(),
    date: raw.date.trim(),
    minutes: raw.minutes,
    source,
    label: label || (source === 'timer' ? 'Focus Session' : 'Study Log'),
    createdAt,
    updatedAt,
  };
}

export function validateAttachmentMeta(raw: unknown): NoteAttachmentMeta | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120) || !isNonEmptyString(raw.noteId, 120)) return null;
  const validKinds: AttachmentKind[] = ['image', 'audio', 'voice'];
  if (!validKinds.includes(raw.kind as AttachmentKind)) return null;
  if (!isNonEmptyString(raw.filename, 200)) return null;
  const mimeType = isNonEmptyString(raw.mimeType, 120)
    ? raw.mimeType.trim()
    : 'application/octet-stream';
  if (
    typeof raw.sizeBytes !== 'number' ||
    !Number.isFinite(raw.sizeBytes) ||
    raw.sizeBytes < 0 ||
    raw.sizeBytes > 50 * 1024 * 1024
  ) {
    return null;
  }
  const durationSec =
    typeof raw.durationSec === 'number' && Number.isFinite(raw.durationSec) && raw.durationSec >= 0
      ? Math.round(raw.durationSec)
      : null;
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();

  return {
    id: raw.id.trim(),
    noteId: raw.noteId.trim(),
    kind: raw.kind as AttachmentKind,
    filename: raw.filename.trim(),
    mimeType,
    sizeBytes: raw.sizeBytes,
    durationSec,
    createdAt,
  };
}

export function validateNoteItem(raw: unknown): NoteItem | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id, 120)) return null;
  const noteId = raw.id.trim();
  if (typeof raw.title !== 'string' || typeof raw.body !== 'string') return null;
  const attachments: NoteAttachmentMeta[] = [];
  if (Array.isArray(raw.attachments)) {
    for (const att of raw.attachments) {
      const valid = validateAttachmentMeta(att);
      if (valid && valid.noteId === noteId) {
        attachments.push(valid);
      }
    }
  }
  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id: noteId,
    title: raw.title,
    body: raw.body,
    attachments,
    createdAt,
    updatedAt,
  };
}

export function validateTimerState(raw: unknown): PersistedTimerState {
  if (!isObject(raw)) return { ...DEFAULT_TIMER_STATE };
  const validPresets: StudyPresetId[] = ['focus-25', 'focus-50', 'break-5', 'break-15'];
  const presetId = validPresets.includes(raw.presetId as StudyPresetId)
    ? (raw.presetId as StudyPresetId)
    : 'focus-25';
  const mode = raw.mode === 'focus' || raw.mode === 'break' ? raw.mode : 'focus';
  const durationMs =
    typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs >= 60_000
      ? raw.durationMs
      : 25 * 60 * 1000;
  const status =
    raw.status === 'idle' ||
    raw.status === 'running' ||
    raw.status === 'paused' ||
    raw.status === 'completed'
      ? raw.status
      : 'idle';
  const startedAtMs =
    typeof raw.startedAtMs === 'number' && Number.isFinite(raw.startedAtMs)
      ? raw.startedAtMs
      : null;
  const accumulatedElapsedMs =
    typeof raw.accumulatedElapsedMs === 'number' &&
    Number.isFinite(raw.accumulatedElapsedMs) &&
    raw.accumulatedElapsedMs >= 0
      ? raw.accumulatedElapsedMs
      : 0;
  const sessionToken = isNonEmptyString(raw.sessionToken, 120) ? raw.sessionToken : createId();
  const savedSessionToken = isNonEmptyString(raw.savedSessionToken, 120)
    ? raw.savedSessionToken
    : null;

  return {
    presetId,
    mode,
    durationMs,
    status: status === 'running' && startedAtMs === null ? 'paused' : status,
    startedAtMs,
    accumulatedElapsedMs,
    sessionToken,
    savedSessionToken,
  };
}

function readJsonList<T>(key: string, validator: (item: unknown) => T | null): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: T[] = [];
    const seenIds = new Set<string>();
    for (const entry of parsed) {
      const item = validator(entry);
      if (item) {
        const id = (item as unknown as { id?: string }).id;
        if (id) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);
        }
        valid.push(item);
      }
    }
    return valid;
  } catch {
    return [];
  }
}

export function writeStorageJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export interface LocalSnapshot {
  settings: AppSettings;
  routine: RoutineClass[];
  routineCourses: RoutineCourse[];
  semesterSettings: SemesterSettings;
  attendance: AttendanceSubject[];
  semesters: CompletedSemester[];
  courses: CurrentCourse[];
  deadlines: DeadlineItem[];
  studySessions: StudySession[];
  studyTimer: PersistedTimerState;
  notes: NoteItem[];
  pendingCleanupIds: string[];
}

export function loadInitialSnapshot(): LocalSnapshot {
  let settings = { ...DEFAULT_SETTINGS };
  try {
    const rawSettings = localStorage.getItem(STORAGE_KEYS.settings);
    if (rawSettings) settings = validateSettings(JSON.parse(rawSettings));
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  let semesterSettings = { ...DEFAULT_SEMESTER_SETTINGS };
  try {
    const rawSem = localStorage.getItem(STORAGE_KEYS.semesterSettings);
    if (rawSem) semesterSettings = validateSemesterSettings(JSON.parse(rawSem));
  } catch {
    semesterSettings = { ...DEFAULT_SEMESTER_SETTINGS };
  }

  let studyTimer = { ...DEFAULT_TIMER_STATE };
  try {
    const rawTimer = localStorage.getItem(STORAGE_KEYS.studyTimer);
    if (rawTimer) studyTimer = validateTimerState(JSON.parse(rawTimer));
  } catch {
    studyTimer = { ...DEFAULT_TIMER_STATE };
  }

  let pendingCleanupIds: string[] = [];
  try {
    const rawPending = localStorage.getItem(STORAGE_KEYS.pendingCleanupIds);
    if (rawPending) {
      const parsed = JSON.parse(rawPending);
      if (Array.isArray(parsed)) {
        pendingCleanupIds = parsed.filter((x): x is string => isNonEmptyString(x, 120));
      }
    }
  } catch {
    pendingCleanupIds = [];
  }

  return {
    settings,
    routine: readJsonList(STORAGE_KEYS.routine, validateRoutineClass),
    routineCourses: readJsonList(STORAGE_KEYS.routineCourses, validateRoutineCourse),
    semesterSettings,
    attendance: readJsonList(STORAGE_KEYS.attendance, validateAttendanceSubject),
    semesters: readJsonList(STORAGE_KEYS.semesters, validateCompletedSemester),
    courses: readJsonList(STORAGE_KEYS.courses, validateCurrentCourse),
    deadlines: readJsonList(STORAGE_KEYS.deadlines, validateDeadlineItem),
    studySessions: readJsonList(STORAGE_KEYS.studySessions, validateStudySession),
    studyTimer,
    notes: readJsonList(STORAGE_KEYS.notes, validateNoteItem),
    pendingCleanupIds,
  };
}

export function measureLocalStorageBytes(): number {
  let totalChars = 0;
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        totalChars += key.length + val.length;
      }
    }
  } catch {
    return 0;
  }
  return totalChars * 2;
}

export async function buildBackupArchive(snapshot: LocalSnapshot): Promise<BackupArchive> {
  const allBlobs = await getAllAttachmentBlobs();
  const validNoteIds = new Set(snapshot.notes.map((n) => n.id));
  const serializedAttachments: SerializedBackupAttachment[] = [];

  for (const rec of allBlobs) {
    if (!validNoteIds.has(rec.noteId)) continue;
    const base64 = await blobToBase64(rec.blob);
    serializedAttachments.push({
      id: rec.id,
      noteId: rec.noteId,
      kind: rec.kind,
      filename: rec.filename,
      mimeType: rec.mimeType || rec.blob.type || 'application/octet-stream',
      sizeBytes: rec.blob.size,
      durationSec: rec.durationSec,
      createdAt: rec.createdAt,
      base64,
    });
  }

  const manifest: BackupArchive['manifest'] = {
    app: 'CampusKit',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      routine: snapshot.routine.length,
      attendance: snapshot.attendance.length,
      semesters: snapshot.semesters.length,
      courses: snapshot.courses.length,
      deadlines: snapshot.deadlines.length,
      studySessions: snapshot.studySessions.length,
      notes: snapshot.notes.length,
      attachments: serializedAttachments.length,
      routineCourses: snapshot.routineCourses.length,
      holidays: snapshot.semesterSettings.holidays.length,
    },
  };

  return {
    manifest,
    data: {
      settings: snapshot.settings,
      routine: snapshot.routine,
      attendance: snapshot.attendance,
      semesters: snapshot.semesters,
      courses: snapshot.courses,
      deadlines: snapshot.deadlines,
      studySessions: snapshot.studySessions,
      notes: snapshot.notes,
      attachments: serializedAttachments,
      routineCourses: snapshot.routineCourses,
      semesterSettings: snapshot.semesterSettings,
    },
  };
}

export interface ValidatedBackupPayload {
  manifest: BackupArchive['manifest'];
  settings: AppSettings;
  routine: RoutineClass[];
  routineCourses: RoutineCourse[];
  semesterSettings: SemesterSettings;
  attendance: AttendanceSubject[];
  semesters: CompletedSemester[];
  courses: CurrentCourse[];
  deadlines: DeadlineItem[];
  studySessions: StudySession[];
  notes: NoteItem[];
  attachmentBlobs: StoredAttachmentBlob[];
}

function validateStrictArray<T extends { id: string }>(
  rawArr: unknown,
  label: string,
  validator: (item: unknown) => T | null
): T[] {
  if (!Array.isArray(rawArr)) {
    throw new Error(`Invalid backup format: "${label}" must be an array.`);
  }
  const result: T[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < rawArr.length; i++) {
    const validated = validator(rawArr[i]);
    if (!validated) {
      throw new Error(`Invalid record in "${label}" at index ${i}.`);
    }
    if (ids.has(validated.id)) {
      throw new Error(`Duplicate ID "${validated.id}" detected in "${label}".`);
    }
    ids.add(validated.id);
    result.push(validated);
  }
  return result;
}

export function parseAndValidateBackupJson(jsonText: string): ValidatedBackupPayload {
  if (jsonText.length > MAX_BACKUP_FILE_BYTES * 1.4) {
    throw new Error('Backup file exceeds maximum supported archive size.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }

  if (!isObject(parsed) || !isObject(parsed.manifest) || !isObject(parsed.data)) {
    throw new Error('Backup file is missing required CampusKit manifest or data sections.');
  }

  if (parsed.manifest.app !== 'CampusKit') {
    throw new Error('Unrecognized backup file: manifest.app must be "CampusKit".');
  }
  if (parsed.manifest.schemaVersion !== 1) {
    throw new Error(
      `Unsupported backup schema version (${String(parsed.manifest.schemaVersion)}). Expected version 1.`
    );
  }
  if (typeof parsed.manifest.exportedAt !== 'string') {
    throw new Error('Invalid backup manifest timestamp.');
  }

  const d = parsed.data;
  if (!isObject(d.settings)) {
    throw new Error('Backup file is missing valid settings.');
  }
  const settings = validateSettings(d.settings);
  const routine = validateStrictArray(d.routine, 'routine', validateRoutineClass);
  const attendance = validateStrictArray(d.attendance, 'attendance', validateAttendanceSubject);
  const semesters = validateStrictArray(d.semesters, 'semesters', validateCompletedSemester);
  const courses = validateStrictArray(d.courses, 'courses', validateCurrentCourse);
  const deadlines = validateStrictArray(d.deadlines, 'deadlines', validateDeadlineItem);
  const studySessions = validateStrictArray(
    d.studySessions,
    'studySessions',
    validateStudySession
  );
  const notes = validateStrictArray(d.notes, 'notes', validateNoteItem);

  const routineCourses = Array.isArray(d.routineCourses)
    ? validateStrictArray(d.routineCourses, 'routineCourses', validateRoutineCourse)
    : [];

  const semesterSettings = isObject(d.semesterSettings)
    ? validateSemesterSettings(d.semesterSettings)
    : { ...DEFAULT_SEMESTER_SETTINGS };

  if (!Array.isArray(d.attachments)) {
    throw new Error('Invalid backup format: "attachments" must be an array.');
  }

  const noteById = new Map(notes.map((n) => [n.id, n]));
  const attachmentBlobs: StoredAttachmentBlob[] = [];
  const seenAttachmentIds = new Set<string>();

  for (let i = 0; i < d.attachments.length; i++) {
    const rawAtt = d.attachments[i];
    if (!isObject(rawAtt)) {
      throw new Error(`Invalid attachment object at index ${i}.`);
    }
    const meta = validateAttachmentMeta(rawAtt);
    if (!meta) {
      throw new Error(`Invalid attachment metadata at index ${i}.`);
    }
    if (seenAttachmentIds.has(meta.id)) {
      throw new Error(`Duplicate attachment ID "${meta.id}" in backup.`);
    }
    if (!noteById.has(meta.noteId)) {
      throw new Error(
        `Broken attachment reference: attachment "${meta.id}" references missing note "${meta.noteId}".`
      );
    }
    if (typeof rawAtt.base64 !== 'string') {
      throw new Error(`Attachment "${meta.id}" is missing base64 data.`);
    }
    const blob = base64ToBlob(rawAtt.base64, meta.mimeType);
    seenAttachmentIds.add(meta.id);
    attachmentBlobs.push({
      ...meta,
      sizeBytes: blob.size,
      blob,
    });
  }

  for (const note of notes) {
    for (const meta of note.attachments) {
      if (!seenAttachmentIds.has(meta.id)) {
        throw new Error(
          `Note "${note.title || note.id}" references attachment "${meta.id}" whose binary data is missing from the archive.`
        );
      }
    }
  }

  return {
    manifest: parsed.manifest as unknown as BackupArchive['manifest'],
    settings,
    routine,
    routineCourses,
    semesterSettings,
    attendance,
    semesters,
    courses,
    deadlines,
    studySessions,
    notes,
    attachmentBlobs,
  };
}

function mergeDedupe<T extends { id: string; updatedAt: number }>(
  existing: T[],
  incoming: T[],
  compositeKeyFn?: (item: T) => string
): T[] {
  const byId = new Map<string, T>();
  const byComposite = new Map<string, string>();

  for (const item of existing) {
    byId.set(item.id, item);
    if (compositeKeyFn) {
      byComposite.set(compositeKeyFn(item), item.id);
    }
  }

  for (const inc of incoming) {
    const existingById = byId.get(inc.id);
    if (existingById) {
      if (inc.updatedAt >= existingById.updatedAt) {
        byId.set(inc.id, inc);
      }
      continue;
    }
    if (compositeKeyFn) {
      const comp = compositeKeyFn(inc);
      const matchedId = byComposite.get(comp);
      if (matchedId) {
        const matched = byId.get(matchedId)!;
        if (inc.updatedAt > matched.updatedAt) {
          byId.set(matchedId, { ...inc, id: matchedId });
        }
        continue;
      }
      byComposite.set(comp, inc.id);
    }
    byId.set(inc.id, inc);
  }

  return Array.from(byId.values());
}

export async function executeValidatedRestore(
  current: LocalSnapshot,
  payload: ValidatedBackupPayload,
  mode: 'replace' | 'merge'
): Promise<LocalSnapshot> {
  const prevBlobs = await getAllAttachmentBlobs();
  const prevLocalStorageRaw = new Map<string, string | null>();
  for (const key of Object.values(STORAGE_KEYS)) {
    prevLocalStorageRaw.set(key, localStorage.getItem(key));
  }

  let nextSnapshot: LocalSnapshot;
  let nextBlobs: StoredAttachmentBlob[];

  if (mode === 'replace') {
    nextSnapshot = {
      settings: payload.settings,
      routine: payload.routine,
      routineCourses: payload.routineCourses,
      semesterSettings: payload.semesterSettings,
      attendance: payload.attendance,
      semesters: payload.semesters,
      courses: payload.courses,
      deadlines: payload.deadlines,
      studySessions: payload.studySessions,
      studyTimer: { ...DEFAULT_TIMER_STATE, sessionToken: createId() },
      notes: payload.notes,
      pendingCleanupIds: [],
    };
    nextBlobs = payload.attachmentBlobs;
  } else {
    const mergedRoutine = mergeDedupe(
      current.routine,
      payload.routine,
      (r) => `${r.subject.toLowerCase()}|${r.dayOfWeek}|${r.startTime}|${r.endTime}`
    );
    const mergedRoutineCourses = mergeDedupe(
      current.routineCourses,
      payload.routineCourses,
      (c) => `${c.name.toLowerCase()}|${c.courseCode.toLowerCase()}`
    );
    const mergedAttendance = mergeDedupe(
      current.attendance,
      payload.attendance,
      (a) => a.name.toLowerCase()
    );
    const mergedSemesters = mergeDedupe(
      current.semesters,
      payload.semesters,
      (s) => `${s.name.toLowerCase()}|${s.credits}|${s.gpa}`
    );
    const mergedCourses = mergeDedupe(
      current.courses,
      payload.courses,
      (c) => c.name.toLowerCase()
    );
    const mergedDeadlines = mergeDedupe(
      current.deadlines,
      payload.deadlines,
      (d) => `${d.title.toLowerCase()}|${d.type}|${d.dueDate}`
    );
    const mergedSessions = mergeDedupe(
      current.studySessions,
      payload.studySessions,
      (s) => `${s.date}|${s.minutes}|${s.source}|${s.createdAt}`
    );

    // Merge semester holidays
    const holidayMap = new Map<string, SemesterHoliday>();
    for (const h of current.semesterSettings.holidays) holidayMap.set(h.id, h);
    for (const h of payload.semesterSettings.holidays) holidayMap.set(h.id, h);

    const mergedSemesterSettings: SemesterSettings = {
      semesterName: payload.semesterSettings.semesterName || current.semesterSettings.semesterName,
      startDate: payload.semesterSettings.startDate || current.semesterSettings.startDate,
      endDate: payload.semesterSettings.endDate || current.semesterSettings.endDate,
      holidays: Array.from(holidayMap.values()),
    };

    const noteMap = new Map<string, NoteItem>();
    for (const n of current.notes) noteMap.set(n.id, n);
    for (const incNote of payload.notes) {
      const ex = noteMap.get(incNote.id);
      if (!ex || incNote.updatedAt >= ex.updatedAt) {
        noteMap.set(incNote.id, incNote);
      }
    }
    const mergedNotes = Array.from(noteMap.values());
    const activeAttachmentIds = new Set<string>();
    for (const n of mergedNotes) {
      for (const att of n.attachments) {
        activeAttachmentIds.add(att.id);
      }
    }

    const blobMap = new Map<string, StoredAttachmentBlob>();
    for (const b of prevBlobs) {
      if (activeAttachmentIds.has(b.id)) blobMap.set(b.id, b);
    }
    for (const incBlob of payload.attachmentBlobs) {
      if (activeAttachmentIds.has(incBlob.id)) blobMap.set(incBlob.id, incBlob);
    }

    nextSnapshot = {
      settings: current.settings,
      routine: mergedRoutine,
      routineCourses: mergedRoutineCourses,
      semesterSettings: mergedSemesterSettings,
      attendance: mergedAttendance,
      semesters: mergedSemesters,
      courses: mergedCourses,
      deadlines: mergedDeadlines,
      studySessions: mergedSessions,
      studyTimer: current.studyTimer,
      notes: mergedNotes,
      pendingCleanupIds: current.pendingCleanupIds,
    };
    nextBlobs = Array.from(blobMap.values());
  }

  try {
    await replaceAllAttachmentBlobs(nextBlobs);
    writeStorageJson(STORAGE_KEYS.settings, nextSnapshot.settings);
    writeStorageJson(STORAGE_KEYS.routine, nextSnapshot.routine);
    writeStorageJson(STORAGE_KEYS.routineCourses, nextSnapshot.routineCourses);
    writeStorageJson(STORAGE_KEYS.semesterSettings, nextSnapshot.semesterSettings);
    writeStorageJson(STORAGE_KEYS.attendance, nextSnapshot.attendance);
    writeStorageJson(STORAGE_KEYS.semesters, nextSnapshot.semesters);
    writeStorageJson(STORAGE_KEYS.courses, nextSnapshot.courses);
    writeStorageJson(STORAGE_KEYS.deadlines, nextSnapshot.deadlines);
    writeStorageJson(STORAGE_KEYS.studySessions, nextSnapshot.studySessions);
    writeStorageJson(STORAGE_KEYS.studyTimer, nextSnapshot.studyTimer);
    writeStorageJson(STORAGE_KEYS.notes, nextSnapshot.notes);
    writeStorageJson(STORAGE_KEYS.pendingCleanupIds, nextSnapshot.pendingCleanupIds);
    return nextSnapshot;
  } catch (err) {
    try {
      for (const [k, rawVal] of prevLocalStorageRaw.entries()) {
        if (rawVal === null) localStorage.removeItem(k);
        else localStorage.setItem(k, rawVal);
      }
    } catch {
      // rollback
    }
    try {
      await replaceAllAttachmentBlobs(prevBlobs);
    } catch {
      // rollback
    }
    const detail = err instanceof Error ? err.message : 'Storage quota or write failure.';
    throw new Error(`Restore failed and existing data was kept intact: ${detail}`);
  }
}

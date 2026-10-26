import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Image as ImageIcon,
  Mic,
  Square,
  Search,
  ArrowLeft,
  CheckCircle2,
  X,
  Volume2,
  Paperclip,
  Maximize2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useCampusKit } from '../context/CampusKitContext';
import {
  putAttachmentBlob,
  getAttachmentBlob,
  deleteAttachmentBlobsByIds,
} from '../storage/blobDb';
import { createId } from '../storage/localStore';
import { formatBytes, formatDurationSeconds } from '../utils/dateAndMath';
import type { NoteAttachmentMeta, NoteItem } from '../types/campuskit';

export const NotesView: React.FC = () => {
  const {
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
  } = useCampusKit();

  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // MediaRecorder Voice Note state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Attachment Blob URL cache for rendering images/audio
  const [blobUrlMap, setBlobUrlMap] = useState<Record<string, string>>({});

  // Lightbox Modal state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Currently active note
  const currentNote = useMemo(() => {
    if (!activeNoteId) return null;
    return notes.find((n) => n.id === activeNoteId) ?? null;
  }, [notes, activeNoteId]);

  // Load Blobs for current note attachments
  useEffect(() => {
    let isCancelled = false;
    const urlsToRevoke: string[] = [];

    if (currentNote && currentNote.attachments.length > 0) {
      Promise.all(
        currentNote.attachments.map(async (meta) => {
          try {
            const record = await getAttachmentBlob(meta.id);
            if (record && record.blob) {
              const url = URL.createObjectURL(record.blob);
              urlsToRevoke.push(url);
              return { id: meta.id, url };
            }
          } catch {
            // Non-fatal if missing blob
          }
          return null;
        })
      ).then((results) => {
        if (isCancelled) {
          urlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        const newMap: Record<string, string> = {};
        for (const res of results) {
          if (res) newMap[res.id] = res.url;
        }
        setBlobUrlMap(newMap);
      });
    } else {
      setBlobUrlMap({});
    }

    return () => {
      isCancelled = true;
      urlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [currentNote?.id, currentNote?.attachments.length]);

  // Handle Note Text Editing
  const handleTitleChange = (newTitle: string) => {
    if (!currentNote) return;
    setSaveStatus('saving');
    const res = updateNoteTextSync(currentNote.id, newTitle, currentNote.body);
    setSaveStatus(res.ok ? 'saved' : 'error');
  };

  const handleBodyChange = (newBody: string) => {
    if (!currentNote) return;
    setSaveStatus('saving');
    const res = updateNoteTextSync(currentNote.id, currentNote.title, newBody);
    setSaveStatus(res.ok ? 'saved' : 'error');
  };

  // Immediate New Note Handler
  const handleCreateNewNote = () => {
    const newNote = openNewNoteImmediately();
    setActiveNoteId(newNote.id);
  };

  // Image Upload
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentNote) return;

    try {
      const attachmentId = createId();
      await putAttachmentBlob({
        id: attachmentId,
        noteId: currentNote.id,
        kind: 'image',
        filename: file.name || 'image.jpg',
        mimeType: file.type || 'image/jpeg',
        sizeBytes: file.size,
        durationSec: null,
        blob: file,
        createdAt: Date.now(),
      });

      const meta: NoteAttachmentMeta = {
        id: attachmentId,
        noteId: currentNote.id,
        kind: 'image',
        filename: file.name || 'image.jpg',
        mimeType: file.type || 'image/jpeg',
        sizeBytes: file.size,
        durationSec: null,
        createdAt: Date.now(),
      };

      attachMetaToNoteSync(currentNote.id, meta);
    } catch {
      setRecordingError('Failed to save image attachment.');
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  // Audio Recording Flow
  const startVoiceRecording = async () => {
    setRecordingError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stream tracks release
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const chunks = audioChunksRef.current;
        if (chunks.length > 0 && currentNote) {
          const mimeType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(chunks, { type: mimeType });
          const attachmentId = createId();

          try {
            await putAttachmentBlob({
              id: attachmentId,
              noteId: currentNote.id,
              kind: 'voice',
              filename: `Voice Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              mimeType,
              sizeBytes: audioBlob.size,
              durationSec: recordingSeconds,
              blob: audioBlob,
              createdAt: Date.now(),
            });

            const meta: NoteAttachmentMeta = {
              id: attachmentId,
              noteId: currentNote.id,
              kind: 'voice',
              filename: `Voice Note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              mimeType,
              sizeBytes: audioBlob.size,
              durationSec: recordingSeconds,
              createdAt: Date.now(),
            };

            attachMetaToNoteSync(currentNote.id, meta);
          } catch {
            setRecordingError('Failed to save voice note.');
          }
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied.';
      setRecordingError(`Could not access microphone: ${msg}`);
      setIsRecording(false);
    }
  };

  const stopAndSaveRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Remove attachment
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!currentNote) return;
    removeAttachmentFromNoteSync(currentNote.id, attachmentId);
    try {
      await deleteAttachmentBlobsByIds([attachmentId]);
    } catch {
      // Background retry queue handles orphans
    }
  };

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  // If a note is currently open, display the full-screen Editor view
  if (currentNote) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] flex-col space-y-4 pb-16">
        {/* Editor Top Navigation Bar */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setActiveNoteId(null)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 active:scale-95 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <ArrowLeft className="h-4 w-4" />
            All Notes
          </button>

          <div className="flex items-center gap-2">
            {/* Save Status Badge */}
            <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-400">
              {saveStatus === 'saving' ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin text-indigo-500" />
                  Saving...
                </>
              ) : saveStatus === 'error' ? (
                <>
                  <AlertTriangle className="h-3 w-3 text-rose-500" />
                  Storage Error
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Saved
                </>
              )}
            </span>

            {/* Delete Note Button */}
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Delete this note and its attachments?')) {
                  await deleteNoteWithCleanup(currentNote.id);
                  setActiveNoteId(null);
                }
              }}
              aria-label="Delete note"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-stone-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Note Title Input */}
        <div>
          <input
            type="text"
            placeholder="Note title..."
            value={currentNote.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full bg-transparent text-xl font-bold tracking-tight text-stone-900 placeholder:text-stone-400 focus:outline-hidden dark:text-stone-50 dark:placeholder:text-stone-600"
          />
        </div>

        {/* Recording Banner when recording */}
        {isRecording && (
          <div className="flex items-center justify-between rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-900 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">Recording Audio</span>
              <span className="font-mono text-xs font-bold">
                {formatDurationSeconds(recordingSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={stopAndSaveRecording}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-95"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop & Save
              </button>
            </div>
          </div>
        )}

        {recordingError && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {recordingError}
          </div>
        )}

        {/* Note Body Textarea */}
        <div className="flex-1">
          <textarea
            placeholder="Type your notes, lecture points, revision formulas..."
            value={currentNote.body}
            onChange={(e) => handleBodyChange(e.target.value)}
            rows={10}
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-stone-800 placeholder:text-stone-400 focus:outline-hidden dark:text-stone-200 dark:placeholder:text-stone-600"
          />
        </div>

        {/* Attachments Section */}
        <div className="border-t border-stone-200 pt-3 dark:border-stone-800">
          <div className="flex items-center justify-between pb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
              <Paperclip className="h-3.5 w-3.5" />
              Attachments ({currentNote.attachments.length})
            </span>

            <div className="flex items-center gap-2">
              {/* Photo Upload Button */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelected}
                className="hidden"
                id="note-image-upload"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Add Photo
              </button>

              {/* Voice Record Button */}
              {!isRecording && (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Voice Note
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-stone-400 dark:text-stone-500 pb-1">
            Your microphone is used only to record voice notes. Recordings are stored only on this device.
          </p>

          {/* Attachments List */}
          {currentNote.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {currentNote.attachments.map((att) => {
                const blobUrl = blobUrlMap[att.id];
                if (att.kind === 'image') {
                  return (
                    <div
                      key={att.id}
                      className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-2 dark:border-stone-800 dark:bg-stone-900"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {blobUrl ? (
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(blobUrl)}
                            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-200 dark:bg-stone-800"
                          >
                            <img
                              src={blobUrl}
                              alt={att.filename}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition">
                              <Maximize2 className="h-4 w-4 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-stone-200 text-stone-400 dark:bg-stone-800">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-0 pr-2">
                          <p className="truncate text-xs font-semibold text-stone-800 dark:text-stone-200">
                            {att.filename}
                          </p>
                          <p className="text-[11px] text-stone-400">
                            {formatBytes(att.sizeBytes)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        aria-label={`Delete ${att.filename}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                }

                // Audio attachment
                return (
                  <div
                    key={att.id}
                    className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                          {att.filename}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          ({formatBytes(att.sizeBytes)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        aria-label={`Delete audio ${att.filename}`}
                        className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {blobUrl ? (
                      <audio controls src={blobUrl} className="h-8 w-full" preload="metadata" />
                    ) : (
                      <span className="text-xs text-stone-400">Loading audio preview...</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lightbox Modal */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
            onClick={() => setLightboxUrl(null)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw]">
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="absolute -top-10 right-0 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-stone-800 text-white"
                aria-label="Close Lightbox"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={lightboxUrl}
                alt="Enlarged note attachment"
                className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Notes List View (Overview)
  return (
    <div className="space-y-6 pb-12">
      {/* Header Card */}
      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <FileText className="h-4 w-4" />
              Private Notebook
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Lecture Notes
            </h1>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              Offline Markdown notes, photos, and voice memos stored on-device.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateNewNote}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            New Note
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search notes by title or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-4 text-xs text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
          />
        </div>

        {/* Orphan attachments retry banner if needed */}
        {pendingCleanupIds.length > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <span>{pendingCleanupIds.length} discarded attachment files pending cleanup.</span>
            <button
              type="button"
              onClick={() => retryPendingAttachmentCleanup()}
              className="font-semibold underline hover:text-amber-900"
            >
              Clean Up Now
            </button>
          </div>
        )}
      </section>

      {/* Notes Grid / List */}
      <section className="space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center dark:border-stone-800">
            <FileText className="mx-auto h-8 w-8 text-stone-400 dark:text-stone-600" />
            <h3 className="mt-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
              {notes.length === 0 ? 'No notes yet' : 'No matching notes found'}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500 dark:text-stone-400">
              {notes.length === 0
                ? 'Create your first note to store lecture points, formulas, homework reminders, and voice recordings.'
                : 'Try adjusting your search query.'}
            </p>
            {notes.length === 0 && (
              <button
                type="button"
                onClick={handleCreateNewNote}
                className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-stone-700 shadow-xs hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Create First Note
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredNotes.map((note) => {
              const imageCount = note.attachments.filter((a) => a.kind === 'image').length;
              const audioCount = note.attachments.filter((a) => a.kind === 'audio' || a.kind === 'voice').length;

              return (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className="cursor-pointer rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs transition hover:border-indigo-300 hover:shadow-xs active:scale-[0.99] dark:border-stone-800 dark:bg-stone-900 dark:hover:border-indigo-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-bold text-stone-900 dark:text-stone-100">
                      {note.title || 'Untitled Note'}
                    </h3>
                  </div>

                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                    {note.body || 'No text content.'}
                  </p>

                  <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-[11px] text-stone-400 dark:border-stone-800 dark:text-stone-500">
                    <span>
                      {new Date(note.updatedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>

                    <div className="flex items-center gap-2">
                      {imageCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <ImageIcon className="h-3 w-3" />
                          {imageCount}
                        </span>
                      )}
                      {audioCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Mic className="h-3 w-3" />
                          {audioCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

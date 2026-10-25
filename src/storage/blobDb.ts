import type { StoredAttachmentBlob } from '../types/campuskit';

const DB_NAME = 'campuskit_blobs_v1';
const DB_VERSION = 1;
const STORE_ATTACHMENTS = 'attachments';

let dbPromise: Promise<IDBDatabase> | null = null;

function openBlobDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      dbPromise = null;
      reject(new Error('IndexedDB is unavailable in this browser environment.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        const store = db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
        store.createIndex('by_noteId', 'noteId', { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Failed to open attachment storage (IndexedDB).'));
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('Attachment database is blocked by another open tab.'));
    };
  });
  return dbPromise;
}

export async function putAttachmentBlob(record: StoredAttachmentBlob): Promise<void> {
  const db = await openBlobDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
    const store = tx.objectStore(STORE_ATTACHMENTS);
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to write attachment to IndexedDB.'));
    tx.onabort = () => reject(tx.error ?? new Error('Attachment storage transaction aborted.'));
  });
}

export async function getAttachmentBlob(id: string): Promise<StoredAttachmentBlob | null> {
  const db = await openBlobDb();
  return new Promise<StoredAttachmentBlob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
    const store = tx.objectStore(STORE_ATTACHMENTS);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as StoredAttachmentBlob | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Failed to read attachment from IndexedDB.'));
  });
}

export async function getAttachmentsByNoteId(noteId: string): Promise<StoredAttachmentBlob[]> {
  const db = await openBlobDb();
  return new Promise<StoredAttachmentBlob[]>((resolve, reject) => {
    const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
    const store = tx.objectStore(STORE_ATTACHMENTS);
    const idx = store.index('by_noteId');
    const req = idx.getAll(IDBKeyRange.only(noteId));
    req.onsuccess = () => resolve((req.result as StoredAttachmentBlob[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('Failed to query note attachments.'));
  });
}

export async function deleteAttachmentBlobsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openBlobDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
    const store = tx.objectStore(STORE_ATTACHMENTS);
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete attachment blobs.'));
    tx.onabort = () => reject(tx.error ?? new Error('Attachment cleanup transaction aborted.'));
  });
}

export async function deleteAttachmentsForNote(noteId: string, knownIds: string[] = []): Promise<void> {
  const db = await openBlobDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
    const store = tx.objectStore(STORE_ATTACHMENTS);
    const idx = store.index('by_noteId');
    const deleted = new Set<string>();

    for (const id of knownIds) {
      store.delete(id);
      deleted.add(id);
    }

    const keyReq = idx.getAllKeys(IDBKeyRange.only(noteId));
    keyReq.onsuccess = () => {
      const keys = (keyReq.result as IDBValidKey[]) ?? [];
      for (const k of keys) {
        const keyStr = String(k);
        if (!deleted.has(keyStr)) {
          store.delete(k);
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete note attachments from IndexedDB.'));
    tx.onabort = () => reject(tx.error ?? new Error('Attachment deletion aborted.'));
  });
}

export async function getAllAttachmentBlobs(): Promise<StoredAttachmentBlob[]> {
  const db = await openBlobDb();
  return new Promise<StoredAttachmentBlob[]>((resolve, reject) => {
    const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
    const store = tx.objectStore(STORE_ATTACHMENTS);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as StoredAttachmentBlob[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('Failed to read attachments for backup.'));
  });
}

export async function replaceAllAttachmentBlobs(records: StoredAttachmentBlob[]): Promise<void> {
  const db = await openBlobDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
    const store = tx.objectStore(STORE_ATTACHMENTS);
    store.clear();
    for (const rec of records) {
      store.put(rec);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to write attachments into IndexedDB.'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB batch write aborted.'));
  });
}

export async function clearAllAttachmentBlobs(): Promise<void> {
  const db = await openBlobDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ATTACHMENTS, 'readwrite');
    const store = tx.objectStore(STORE_ATTACHMENTS);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear attachment storage.'));
    tx.onabort = () => reject(tx.error ?? new Error('Clear attachments transaction aborted.'));
  });
}

export async function getAttachmentStorageStats(): Promise<{
  count: number;
  totalBytes: number;
}> {
  try {
    const all = await getAllAttachmentBlobs();
    let totalBytes = 0;
    for (const item of all) {
      totalBytes += item.blob?.size ?? item.sizeBytes ?? 0;
    }
    return { count: all.length, totalBytes };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode(...sub));
  }
  return btoa(chunks.join(''));
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  if (typeof base64 !== 'string') {
    throw new Error('Attachment binary payload is not a valid string.');
  }
  const clean = base64.trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
    throw new Error('Malformed base64 payload in backup attachment.');
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

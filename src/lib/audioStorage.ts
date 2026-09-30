'use client';

import { db } from '@/lib/firebase';
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  getDoc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { Episode, GlobalAudio } from '@/types';

const CHUNK_SIZE = 500000; // 500KB per Firestore document chunk (well below 1MB limit)
const DIRECT_LIMIT = 800000; // 800KB max for single document field

// ==================== INDEXEDDB OFFLINE BLOB STORAGE ====================
const DB_NAME = 'seerah_audio_db';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

function openAudioDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const dbInstance = request.result;
        if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
          dbInstance.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getCachedAudioBlob(key: string): Promise<Blob | null> {
  try {
    const idb = await openAudioDb();
    if (!idb) return null;
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedAudioBlob(key: string, blob: Blob): Promise<void> {
  try {
    const idb = await openAudioDb();
    if (!idb) return;
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function deleteCachedAudioBlob(key: string): Promise<void> {
  try {
    const idb = await openAudioDb();
    if (!idb) return;
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

// In-memory cache for resolved native Blob URLs (eliminates DOM string overhead)
export const blobUrlCache = new Map<string, string>();

/**
 * Validates whether a given URL is a real, playable media source.
 * Guards against relative pseudo-paths like '__CACHED_BASE64__' or '__CHUNKS__'.
 */
export function isValidPlayableUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false;
  return (
    url.startsWith('blob:') ||
    url.startsWith('data:audio') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  );
}

/**
 * Converts a base64 Data URL to a native browser Blob object.
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'audio/mp3';
    const binary = atob(parts[1] || parts[0]);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return new Blob([buffer], { type: mime });
  } catch (err) {
    console.warn('Failed converting base64 data to Blob:', err);
    return null;
  }
}

/**
 * Converts a base64 Data URL to a native browser Blob URL.
 */
export function dataUrlToBlobUrl(dataUrl: string): string {
  if (typeof window === 'undefined') return dataUrl;
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return dataUrl;
  return URL.createObjectURL(blob);
}

/**
 * Checks whether an episode audio has already been resolved and cached in memory.
 */
export function hasCachedAudioUrl(episodeId: string): boolean {
  return blobUrlCache.has(episodeId);
}

/**
 * Saves audio data to Firestore for an episode.
 * Supports 'ai', 'upload', or 'url' source types.
 * Automatically chunks large files into a subcollection to bypass 1MB document limit.
 */
export async function saveAudioToEpisode(
  episodeId: string,
  audioData: string,
  sourceType: 'ai' | 'upload' | 'url' = 'upload'
): Promise<void> {
  // Invalidate any previously cached Blob URL and IndexedDB entry for this episode
  if (blobUrlCache.has(episodeId)) {
    try {
      URL.revokeObjectURL(blobUrlCache.get(episodeId)!);
    } catch {}
    blobUrlCache.delete(episodeId);
  }
  await deleteCachedAudioBlob(episodeId);

  // If it's a data URL, save it to IndexedDB for instant future playback
  if (audioData.startsWith('data:')) {
    const b = dataUrlToBlob(audioData);
    if (b) {
      setCachedAudioBlob(episodeId, b);
    }
  }

  const chunksCol = collection(db, 'episodes', episodeId, 'audioChunks');

  // Clean up any existing chunks first
  try {
    const existingSnap = await getDocs(chunksCol);
    if (!existingSnap.empty) {
      const delBatch = writeBatch(db);
      existingSnap.docs.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();
    }
  } catch (e) {
    console.warn('Could not clean old audio chunks:', e);
  }

  // Direct External URL
  if (sourceType === 'url' || audioData.startsWith('http://') || audioData.startsWith('https://')) {
    await updateDoc(doc(db, 'episodes', episodeId), {
      audioUrl: audioData,
      audioType: 'direct',
      audioChunksCount: 0,
      audioSourceType: 'url',
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // If fits in single document:
  if (audioData.length < DIRECT_LIMIT) {
    await updateDoc(doc(db, 'episodes', episodeId), {
      audioUrl: audioData,
      audioType: 'direct',
      audioChunksCount: 0,
      audioSourceType: sourceType,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // If larger than direct limit: chunk into subcollection
  const totalLength = audioData.length;
  const chunkCount = Math.ceil(totalLength / CHUNK_SIZE);
  const batch = writeBatch(db);

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalLength);
    const chunkData = audioData.substring(start, end);
    const chunkDocRef = doc(chunksCol, String(i).padStart(4, '0'));
    batch.set(chunkDocRef, {
      index: i,
      data: chunkData,
      updatedAt: serverTimestamp(),
    });
  }

  // Mark episode as having chunked audio
  const episodeRef = doc(db, 'episodes', episodeId);
  batch.update(episodeRef, {
    audioUrl: '__CHUNKS__',
    audioType: 'chunked',
    audioChunksCount: chunkCount,
    audioSourceType: sourceType,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Deletes audio from an episode including any subcollection chunks and invalidates cache
 */
export async function removeAudioFromEpisode(episodeId: string): Promise<void> {
  // Invalidate memory cache and IndexedDB cache
  if (blobUrlCache.has(episodeId)) {
    try {
      URL.revokeObjectURL(blobUrlCache.get(episodeId)!);
    } catch {}
    blobUrlCache.delete(episodeId);
  }
  await deleteCachedAudioBlob(episodeId);

  // Delete subcollection chunks if any
  try {
    const chunksCol = collection(db, 'episodes', episodeId, 'audioChunks');
    const existingSnap = await getDocs(chunksCol);
    if (!existingSnap.empty) {
      const delBatch = writeBatch(db);
      existingSnap.docs.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();
    }
  } catch (e) {
    console.warn('Could not clean audio chunks:', e);
  }

  // Clear audioUrl and audioSourceType on episode doc
  await updateDoc(doc(db, 'episodes', episodeId), {
    audioUrl: null,
    audioType: null,
    audioChunksCount: 0,
    audioSourceType: null,
    updatedAt: serverTimestamp(),
  });
}

export interface AudioSourceInfo {
  type: 'ai' | 'upload' | 'url' | 'none';
  label: string;
  badgeText: string;
  icon: string;
  color: string;
  bg: string;
}

export function getAudioSourceInfo(episode?: Episode | null): AudioSourceInfo {
  if (!episode || !episode.audioUrl) {
    return {
      type: 'none',
      label: 'لا يوجد تسجيل صوتي',
      badgeText: 'غير متوفر',
      icon: '🎙️',
      color: 'var(--text-muted)',
      bg: 'rgba(255, 255, 255, 0.05)',
    };
  }

  if (episode.audioSourceType === 'ai') {
    return {
      type: 'ai',
      label: 'تسجيل استوديو نقي (ذكاء اصطناعي AI)',
      badgeText: 'ذكاء اصطناعي ✨',
      icon: '✨',
      color: 'var(--gold)',
      bg: 'rgba(212, 175, 55, 0.12)',
    };
  }

  if (
    episode.audioSourceType === 'url' ||
    episode.audioUrl.startsWith('http://') ||
    episode.audioUrl.startsWith('https://')
  ) {
    return {
      type: 'url',
      label: 'بث صوتي مباشر (رابط خارجي)',
      badgeText: 'رابط خارجي 🔗',
      icon: '🔗',
      color: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.12)',
    };
  }

  return {
    type: 'upload',
    label: 'تسجيل صوتي استوديو أصلي (ملف مرفوع)',
    badgeText: 'تسجيل يدوي 🎙️',
    icon: '📁',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
  };
}

/**
 * Resolves an episode's audio URL into a playable native Blob URL or external URL.
 * Automatically handles:
 * - In-memory cache
 * - IndexedDB offline storage
 * - Resolving '__CACHED_BASE64__' by fetching fresh data from Firestore
 * - Progressive streaming and reassembly of '__CHUNKS__'
 * NEVER returns invalid placeholder strings that cause 404s in the browser.
 */
export async function resolveAudioUrl(
  episode: Episode,
  onProgress?: (loadedChunks: number, totalChunks: number) => void
): Promise<string | null> {
  if (!episode || !episode.audioUrl) return null;

  // 1. In-memory URL cache check (< 1ms)
  if (blobUrlCache.has(episode.docId)) {
    return blobUrlCache.get(episode.docId)!;
  }

  // 2. IndexedDB cache check (< 5ms, works completely offline)
  const idbBlob = await getCachedAudioBlob(episode.docId);
  if (idbBlob) {
    const blobUrl = URL.createObjectURL(idbBlob);
    blobUrlCache.set(episode.docId, blobUrl);
    return blobUrl;
  }

  // 3. Direct external HTTP / HTTPS URL
  if (
    episode.audioUrl.startsWith('http://') ||
    episode.audioUrl.startsWith('https://') ||
    episode.audioUrl.startsWith('blob:')
  ) {
    return episode.audioUrl;
  }

  // 4. Direct Base64 data URL
  if (episode.audioUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(episode.audioUrl);
    if (blob) {
      setCachedAudioBlob(episode.docId, blob);
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(episode.docId, blobUrl);
      return blobUrl;
    }
    return null;
  }

  // 5. If audioUrl is '__CACHED_BASE64__' (from localStorage) or needs re-fetching from Firestore:
  let effectiveAudioUrl: string | null = episode.audioUrl;

  if (effectiveAudioUrl === '__CACHED_BASE64__') {
    try {
      const epSnap = await getDoc(doc(db, 'episodes', episode.docId));
      if (epSnap.exists()) {
        const freshData = epSnap.data();
        effectiveAudioUrl = freshData.audioUrl || null;
      } else {
        effectiveAudioUrl = '__CHUNKS__';
      }
    } catch (err) {
      console.warn('Could not fetch episode doc directly, attempting chunks fallback:', err);
      effectiveAudioUrl = '__CHUNKS__';
    }
  }

  if (effectiveAudioUrl) {
    if (
      effectiveAudioUrl.startsWith('http://') ||
      effectiveAudioUrl.startsWith('https://') ||
      effectiveAudioUrl.startsWith('blob:')
    ) {
      return effectiveAudioUrl;
    }

    if (effectiveAudioUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(effectiveAudioUrl);
      if (blob) {
        setCachedAudioBlob(episode.docId, blob);
        const blobUrl = URL.createObjectURL(blob);
        blobUrlCache.set(episode.docId, blobUrl);
        return blobUrl;
      }
      return null;
    }
  }

  // 6. Fetch and reassemble chunks progressively from Firestore
  try {
    const chunksCol = collection(db, 'episodes', episode.docId, 'audioChunks');
    const q = query(chunksCol, orderBy('index', 'asc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      return null;
    }

    const docs = snap.docs.map((d) => d.data()).sort((a, b) => a.index - b.index);
    const totalChunks = docs.length;
    const chunkParts: string[] = [];

    for (let i = 0; i < totalChunks; i++) {
      chunkParts.push(docs[i].data);
      onProgress?.(i + 1, totalChunks);
    }

    const fullBase64 = chunkParts.join('');
    const blob = dataUrlToBlob(fullBase64);
    if (blob) {
      setCachedAudioBlob(episode.docId, blob);
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(episode.docId, blobUrl);
      return blobUrl;
    }
    return null;
  } catch (err) {
    console.error('Failed to load and assemble audio chunks:', err);
    return null;
  }
}

/**
 * Saves base64 audio data to Firestore for the site-wide Global Audio.
 * Automatically chunks large files into settings/global_audio/audioChunks.
 */
export async function saveGlobalAudio(
  base64DataUrl: string,
  extraMeta?: { originalFileName?: string; originalSize?: number; compressedSize?: number }
): Promise<void> {
  const globalDocRef = doc(db, 'settings', 'global_audio');
  const chunksCol = collection(db, 'settings', 'global_audio', 'audioChunks');

  // Invalidate cache
  if (blobUrlCache.has('global_audio')) {
    try {
      URL.revokeObjectURL(blobUrlCache.get('global_audio')!);
    } catch {}
    blobUrlCache.delete('global_audio');
  }
  await deleteCachedAudioBlob('global_audio');

  // Cache in IndexedDB
  const b = dataUrlToBlob(base64DataUrl);
  if (b) {
    setCachedAudioBlob('global_audio', b);
  }

  // Clean up any existing chunks first
  try {
    const existingSnap = await getDocs(chunksCol);
    if (!existingSnap.empty) {
      const delBatch = writeBatch(db);
      existingSnap.docs.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();
    }
  } catch (e) {
    console.warn('Could not clean old global audio chunks:', e);
  }

  // If fits in single document:
  if (base64DataUrl.length < DIRECT_LIMIT) {
    await setDoc(globalDocRef, {
      audioUrl: base64DataUrl,
      audioType: 'direct',
      audioChunksCount: 0,
      originalFileName: extraMeta?.originalFileName || null,
      originalSize: extraMeta?.originalSize || null,
      compressedSize: extraMeta?.compressedSize || null,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // Chunk into subcollection
  const totalLength = base64DataUrl.length;
  const chunkCount = Math.ceil(totalLength / CHUNK_SIZE);
  const batch = writeBatch(db);

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalLength);
    const chunkData = base64DataUrl.substring(start, end);
    const chunkDocRef = doc(chunksCol, String(i).padStart(4, '0'));
    batch.set(chunkDocRef, {
      index: i,
      data: chunkData,
      updatedAt: serverTimestamp(),
    });
  }

  batch.set(globalDocRef, {
    audioUrl: '__CHUNKS__',
    audioType: 'chunked',
    audioChunksCount: chunkCount,
    originalFileName: extraMeta?.originalFileName || null,
    originalSize: extraMeta?.originalSize || null,
    compressedSize: extraMeta?.compressedSize || null,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Removes global audio and any subcollection chunks
 */
export async function removeGlobalAudio(): Promise<void> {
  const chunksCol = collection(db, 'settings', 'global_audio', 'audioChunks');
  try {
    const existingSnap = await getDocs(chunksCol);
    if (!existingSnap.empty) {
      const delBatch = writeBatch(db);
      existingSnap.docs.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();
    }
  } catch (e) {
    console.warn('Could not clean global audio chunks:', e);
  }

  if (blobUrlCache.has('global_audio')) {
    try {
      URL.revokeObjectURL(blobUrlCache.get('global_audio')!);
    } catch {}
    blobUrlCache.delete('global_audio');
  }
  await deleteCachedAudioBlob('global_audio');
  await deleteDoc(doc(db, 'settings', 'global_audio'));
}

/**
 * Resolves global audio into a playable native Blob URL.
 */
export async function resolveGlobalAudioUrl(globalAudio: GlobalAudio): Promise<string | null> {
  if (!globalAudio?.audioUrl) return null;

  if (blobUrlCache.has('global_audio')) {
    return blobUrlCache.get('global_audio')!;
  }

  const idbBlob = await getCachedAudioBlob('global_audio');
  if (idbBlob) {
    const blobUrl = URL.createObjectURL(idbBlob);
    blobUrlCache.set('global_audio', blobUrl);
    return blobUrl;
  }

  if (globalAudio.audioUrl.startsWith('http://') || globalAudio.audioUrl.startsWith('https://')) {
    return globalAudio.audioUrl;
  }

  if (globalAudio.audioUrl !== '__CHUNKS__' && globalAudio.audioUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(globalAudio.audioUrl);
    if (blob) {
      setCachedAudioBlob('global_audio', blob);
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set('global_audio', blobUrl);
      return blobUrl;
    }
    return null;
  }

  const chunksCol = collection(db, 'settings', 'global_audio', 'audioChunks');
  const q = query(chunksCol, orderBy('index', 'asc'));
  const snap = await getDocs(q);

  if (snap.empty) {
    return null;
  }

  const docs = snap.docs.map((d) => d.data()).sort((a, b) => a.index - b.index);
  const fullBase64 = docs.map((d) => d.data).join('');
  const blob = dataUrlToBlob(fullBase64);
  if (blob) {
    setCachedAudioBlob('global_audio', blob);
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set('global_audio', blobUrl);
    return blobUrl;
  }
  return null;
}

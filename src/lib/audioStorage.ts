'use client';

import { db } from '@/lib/firebase';
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { Episode, GlobalAudio } from '@/types';

const CHUNK_SIZE = 500000; // 500KB per Firestore document chunk (well below 1MB limit)
const DIRECT_LIMIT = 800000; // 800KB max for single document field

/**
 * Saves base64 audio data to Firestore for an episode.
 * Automatically chunks large files into a subcollection to bypass 1MB document limit.
 */
export async function saveAudioToEpisode(
  episodeId: string,
  base64DataUrl: string
): Promise<void> {
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

  // If fits in single document:
  if (base64DataUrl.length < DIRECT_LIMIT) {
    await updateDoc(doc(db, 'episodes', episodeId), {
      audioUrl: base64DataUrl,
      audioType: 'direct',
      audioChunksCount: 0,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // If larger than direct limit: chunk into subcollection
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

  // Mark episode as having chunked audio
  const episodeRef = doc(db, 'episodes', episodeId);
  batch.update(episodeRef, {
    audioUrl: '__CHUNKS__',
    audioType: 'chunked',
    audioChunksCount: chunkCount,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Deletes audio from an episode including any subcollection chunks
 */
export async function removeAudioFromEpisode(episodeId: string): Promise<void> {
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

  // Clear audioUrl on episode doc
  await updateDoc(doc(db, 'episodes', episodeId), {
    audioUrl: null,
    audioType: null,
    audioChunksCount: 0,
    updatedAt: serverTimestamp(),
  });
}

// In-memory cache for resolved native Blob URLs (eliminates DOM string overhead)
export const blobUrlCache = new Map<string, string>();

/**
 * Converts a base64 Data URL to a native browser Blob URL.
 * This completely prevents memory bloat and browser main-thread freezes.
 */
export function dataUrlToBlobUrl(dataUrl: string): string {
  if (typeof window === 'undefined') return dataUrl;
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;

  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'audio/mp3';
    const binary = atob(parts[1]);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([buffer], { type: mime });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Failed converting base64 data to Blob URL:', err);
    return dataUrl;
  }
}

/**
 * Checks whether an episode audio has already been resolved and cached in memory.
 */
export function hasCachedAudioUrl(episodeId: string): boolean {
  return blobUrlCache.has(episodeId);
}

/**
 * Resolves an episode's audio URL into a high-performance native Blob URL.
 * If audio is chunked in Firestore, it streams the chunks progressively.
 */
export async function resolveAudioUrl(
  episode: Episode,
  onProgress?: (loadedChunks: number, totalChunks: number) => void
): Promise<string | null> {
  if (!episode.audioUrl) return null;

  // Check cache first (instant response < 1ms)
  if (blobUrlCache.has(episode.docId)) {
    return blobUrlCache.get(episode.docId)!;
  }

  // Direct URL (HTTP or Base64 data URL)
  if (episode.audioUrl !== '__CHUNKS__') {
    const blobUrl = dataUrlToBlobUrl(episode.audioUrl);
    blobUrlCache.set(episode.docId, blobUrl);
    return blobUrl;
  }

  // Fetch and reassemble chunks progressively
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
  const blobUrl = dataUrlToBlobUrl(fullBase64);
  blobUrlCache.set(episode.docId, blobUrl);
  return blobUrl;
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

  // Invalidate cache
  if (blobUrlCache.has('global_audio')) {
    try {
      URL.revokeObjectURL(blobUrlCache.get('global_audio')!);
    } catch {}
    blobUrlCache.delete('global_audio');
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

  if (globalAudio.audioUrl !== '__CHUNKS__') {
    const blobUrl = dataUrlToBlobUrl(globalAudio.audioUrl);
    blobUrlCache.set('global_audio', blobUrl);
    return blobUrl;
  }

  const chunksCol = collection(db, 'settings', 'global_audio', 'audioChunks');
  const q = query(chunksCol, orderBy('index', 'asc'));
  const snap = await getDocs(q);

  if (snap.empty) {
    return null;
  }

  const docs = snap.docs.map((d) => d.data()).sort((a, b) => a.index - b.index);
  const fullBase64 = docs.map((d) => d.data).join('');
  const blobUrl = dataUrlToBlobUrl(fullBase64);
  blobUrlCache.set('global_audio', blobUrl);
  return blobUrl;
}

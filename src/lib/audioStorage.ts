'use client';

import { db } from '@/lib/firebase';
import {
  doc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { Episode } from '@/types';

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

// In-memory cache for resolved chunked audio URLs
const audioCache = new Map<string, string>();

/**
 * Resolves an episode's audio URL into a playable URL.
 * If audio is chunked in Firestore, it downloads and reassembles the base64 chunks.
 */
export async function resolveAudioUrl(episode: Episode): Promise<string | null> {
  if (!episode.audioUrl) return null;

  // Direct URL (HTTP or Base64 data URL)
  if (episode.audioUrl !== '__CHUNKS__') {
    return episode.audioUrl;
  }

  // Check cache first
  if (audioCache.has(episode.docId)) {
    return audioCache.get(episode.docId)!;
  }

  // Fetch and reassemble chunks
  const chunksCol = collection(db, 'episodes', episode.docId, 'audioChunks');
  const q = query(chunksCol, orderBy('index', 'asc'));
  const snap = await getDocs(q);

  if (snap.empty) {
    return null;
  }

  const fullBase64 = snap.docs.map((d) => d.data().data).join('');
  audioCache.set(episode.docId, fullBase64);
  return fullBase64;
}

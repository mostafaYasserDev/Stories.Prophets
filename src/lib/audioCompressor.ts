'use client';

/**
 * Audio Compressor for Seerah Nabawiya
 * Compresses any audio format (MP3, WAV, M4A, OGG, AAC, WebM) client-side
 * into high-efficiency 32kbps mono MP3 using Web Audio API + LAMEjs.
 * Produces base64 Data URLs suitable for Firestore storage without third-party services.
 */

export interface CompressionResult {
  blob: Blob;
  blobUrl?: string;
  base64DataUrl: string;
  originalSize: number;
  compressedSize: number;
  duration: number;
  compressionRatio: number;
}

/**
 * Dynamically loads the bundled lame.min.js script
 */
export async function loadLame(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('ضغط الصوت متاح فقط في المتصفح');
  }

  if ((window as any).lamejs && (window as any).lamejs.Mp3Encoder) {
    return (window as any).lamejs;
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('lamejs-script');
    if (existing) {
      if ((window as any).lamejs?.Mp3Encoder) {
        resolve((window as any).lamejs);
      } else {
        existing.addEventListener('load', () => resolve((window as any).lamejs));
        existing.addEventListener('error', () => reject(new Error('تعذّر تحميل مكتبة التشفير')));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'lamejs-script';
    script.src = '/js/lame.min.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).lamejs && (window as any).lamejs.Mp3Encoder) {
        resolve((window as any).lamejs);
      } else {
        reject(new Error('تم تحميل الملف ولكن لم يتم العثور على Mp3Encoder'));
      }
    };
    script.onerror = () => {
      reject(new Error('فشل تحميل /js/lame.min.js من الخادم'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Converts a Blob to a Base64 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresses an audio File or Blob into 32kbps Mono MP3
 * @param file The input Audio File or Blob
 * @param targetBitrateKbps Target bitrate (default 32kbps mono, optimal for recitation & voice)
 * @param onProgress Optional callback for progress percentage (0 - 100) and message
 */
export async function compressAudio(
  file: File | Blob,
  targetBitrateKbps: number = 32,
  onProgress?: (percent: number, message: string) => void
): Promise<CompressionResult> {
  if (onProgress) onProgress(5, 'جارٍ تحميل محرك الضغط الصوتي...');
  const lame = await loadLame();

  if (onProgress) onProgress(15, 'جارٍ قراءة الملف الصوتي...');
  const arrayBuffer = await file.arrayBuffer();

  if (onProgress) onProgress(30, 'جارٍ فك تشفير الصوت واستخراج الموجات...');
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let audioBuffer: AudioBuffer;

  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err: any) {
    audioCtx.close();
    throw new Error('تعذّر فك تشفير الملف الصوتي. يرجى التأكد من أن صيغة الملف صالحة (MP3, WAV, M4A, AAC, OGG).');
  }

  const duration = audioBuffer.duration;
  // Downsample to 22050 Hz (standard high efficiency speech sample rate for MP3)
  const targetSampleRate = 22050;
  const targetLength = Math.ceil(duration * targetSampleRate);

  if (onProgress) onProgress(50, 'جارٍ تحويل الصوت إلى أحادي (Mono) وتخفيض التردد...');
  // Use OfflineAudioContext for instantaneous rendering (10x-50x faster than real-time)
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  audioCtx.close();

  if (onProgress) onProgress(70, 'جارٍ ترميز MP3 المضغوط...');
  const float32 = renderedBuffer.getChannelData(0);
  const totalSamples = float32.length;
  const int16Samples = new Int16Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Encode with LAME
  const mp3encoder = new lame.Mp3Encoder(1, targetSampleRate, targetBitrateKbps);
  const mp3Chunks: Uint8Array[] = [];
  const chunkSize = 1152;

  for (let i = 0; i < totalSamples; i += chunkSize) {
    const chunk = int16Samples.subarray(i, i + chunkSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Chunks.push(new Uint8Array(endBuf));
  }

  if (onProgress) onProgress(90, 'جارٍ تحويل الصوت المضغوط إلى Base64...');
  const mp3Blob = new Blob(mp3Chunks as unknown as BlobPart[], { type: 'audio/mp3' });
  const blobUrl = typeof window !== 'undefined' ? URL.createObjectURL(mp3Blob) : '';
  const base64DataUrl = await blobToDataUrl(mp3Blob);

  const originalSize = file.size;
  const compressedSize = mp3Blob.size;
  const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

  if (onProgress) onProgress(100, 'تم ضغط الصوت بنجاح!');

  return {
    blob: mp3Blob,
    blobUrl,
    base64DataUrl,
    originalSize,
    compressedSize,
    duration,
    compressionRatio,
  };
}

/**
 * Format bytes into human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 بايت';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

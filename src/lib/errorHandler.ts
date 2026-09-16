/**
 * Seerah App - Smart Arabic Error Handler & Text Normalizer
 * Provides user-friendly Arabic error translations and Arabic text normalization.
 */

/**
 * Normalizes Arabic text for duplicate detection and accurate comparison.
 * - Trims and collapses multiple spaces into one.
 * - Removes Arabic diacritics (tashkeel / harakat).
 * - Normalizes Alef forms (أ, إ, آ, ٱ -> ا).
 * - Normalizes Taa Marbuta and Haa (ة -> ه).
 * - Normalizes Yaa and Alef Maqsura (ى -> ي).
 * - Removes Tatweel / Kashida (ـ).
 * - Lowercases Latin characters.
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/\s+/g, ' ')
    // Remove diacritics / tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove tatweel (kashida)
    .replace(/\u0640/g, '')
    // Normalize Alefs
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Yaa / Alef Maqsura
    .replace(/ى/g, 'ي')
    // Normalize Taa Marbuta to Haa for matching
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

export interface FriendlyError {
  title: string;
  message: string;
}

/**
 * Translates and formats system, Firebase, and browser errors into helpful, clear Arabic.
 */
export function formatFriendlyError(err: any, fallbackContext: string = 'حدث خطأ غير متوقع'): FriendlyError {
  if (!err) {
    return {
      title: 'تنبيه',
      message: fallbackContext,
    };
  }

  const rawMsg = String(err?.message || err || '');
  const code = String(err?.code || '').toLowerCase();

  // 1. Firebase Permission Denied
  if (
    code.includes('permission-denied') ||
    rawMsg.toLowerCase().includes('permission') ||
    rawMsg.toLowerCase().includes('insufficient')
  ) {
    return {
      title: 'صلاحيات غير كافية',
      message:
        'تعذّر إتمام العملية لعدم وجود الصلاحية الكافية. يرجى التأكد من تطبيق قواعد الحماية (Firestore Rules) المحدثة في لوحة تحكم Firebase.',
    };
  }

  // 2. Network / Offline Issues
  if (
    code.includes('unavailable') ||
    rawMsg.toLowerCase().includes('offline') ||
    rawMsg.toLowerCase().includes('network') ||
    rawMsg.toLowerCase().includes('failed to fetch')
  ) {
    return {
      title: 'انقطاع في الاتصال',
      message:
        'تعذّر الاتصال بقاعدة البيانات السحابية. يرجى التحقق من اتصال الإنترنت لديك وإعادة المحاولة.',
    };
  }

  // 3. Quota Exceeded
  if (
    code.includes('resource-exhausted') ||
    rawMsg.toLowerCase().includes('quota') ||
    rawMsg.toLowerCase().includes('exhausted')
  ) {
    return {
      title: 'تجاوز الحد المسموح',
      message:
        'تم الوصول للحد الأقصى لعدد العمليات اليومية في الخطة السحابية المجانية. يرجى الانتظار والمحاولة لاحقاً.',
    };
  }

  // 4. Document / Item Not Found
  if (code.includes('not-found') || rawMsg.toLowerCase().includes('not found')) {
    return {
      title: 'العنصر غير موجود',
      message:
        'العنصر المطلوب لم يعد متوفراً في السحابة، ربما تم حذفه مسبقاً أو تعديله من نافذة أخرى.',
    };
  }

  // 5. Duplicate or Already Exists
  if (code.includes('already-exists') || rawMsg.toLowerCase().includes('already exists')) {
    return {
      title: 'العنصر مسجل مسبقاً',
      message: 'يوجد عنصر آخر بنفس هذا المعرف في قاعدة البيانات.',
    };
  }

  // 6. Firestore Payload Size Limit (e.g. huge chunk/doc)
  if (
    rawMsg.toLowerCase().includes('exceeds the limit') ||
    rawMsg.toLowerCase().includes('1048487') ||
    rawMsg.toLowerCase().includes('payload')
  ) {
    return {
      title: 'حجم الملف يتجاوز الحد السحابي',
      message:
        'حجم البيانات الصوتيّة كبير جداً لتخزينه في مستند واحد. يرجى رفع مقطع صوتي بمدة أو جودة أقصر.',
    };
  }

  // 7. Audio Decoding / Web Audio Errors
  if (
    rawMsg.toLowerCase().includes('decode') ||
    rawMsg.toLowerCase().includes('audio') ||
    rawMsg.toLowerCase().includes('offlineaudiocontext') ||
    rawMsg.toLowerCase().includes('encoding')
  ) {
    return {
      title: 'تعذّر معالجة الملف الصوتي',
      message:
        'الملف الصوتي المحدد غير صالح أو بصيغة غير مدعومة. يرجى استخدام ملفات صوتية بصيغة (MP3, WAV, M4A) صالحة.',
    };
  }

  // 8. Audio Autoplay / Playback Restriction
  if (rawMsg.toLowerCase().includes('play') || rawMsg.toLowerCase().includes('notallowederror')) {
    return {
      title: 'تعذّر تشغيل الصوت',
      message:
        'المتصفح منع التشغيل التلقائي للصوت أو الرابط غير صالح. يرجى النقر على زر التشغيل مباشرة.',
    };
  }

  // 9. Deadline / Timeout
  if (code.includes('deadline-exceeded') || rawMsg.toLowerCase().includes('timeout')) {
    return {
      title: 'انتهت مهلة الانتظار',
      message: 'استغرقت العملية وقتاً أطول من المتوقع، يرجى المحاولة مرة أخرى.',
    };
  }

  // 10. Default contextual fallback
  return {
    title: 'تنبيه في لوحة التحكم',
    message: `${fallbackContext}${rawMsg ? ` (${rawMsg.slice(0, 120)})` : ''}`,
  };
}

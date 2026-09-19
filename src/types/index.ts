export interface FirestoreTimestamp {
  seconds?: number;
  nanoseconds?: number;
  toDate?: () => Date;
}

export interface Series {
  id: string;
  title: string;
  description?: string;
  order: number;
  isPinned: boolean;
  createdAt?: FirestoreTimestamp | any;
  updatedAt?: FirestoreTimestamp | any;
}

export interface Episode {
  docId: string;
  order: number;
  era: string; // Title of the era / series
  seriesId?: string; // Optional reference to series document
  title: string;
  subtitle?: string;
  html: string;
  audioUrl?: string | null;
  audioType?: 'direct' | 'chunked' | null;
  audioChunksCount?: number;
  audioSourceType?: 'ai' | 'upload' | 'url' | null;
  moralLesson?: string | null;
  sources?: string[] | null; // Episode references and sources
  isPinned?: boolean; // Pinned episode to highlight in index
  isHidden?: boolean; // When true, episode is hidden from public visitors (Draft/Unpublished mode)
  createdAt?: FirestoreTimestamp | any;
  updatedAt?: FirestoreTimestamp | any;
}

export interface Reflection {
  id: string;
  episodeId: string;
  text: string;
  author?: string;
  likesCount?: number;
  createdAt?: FirestoreTimestamp | any;
}

export interface GlobalAudio {
  audioUrl: string;
  audioType?: 'direct' | 'chunked' | null;
  audioChunksCount?: number;
  originalFileName?: string;
  originalSize?: number;
  compressedSize?: number;
  updatedAt?: FirestoreTimestamp | any;
}

export interface SiteSettings {
  siteTitle?: string;
  siteSubtitle?: string;
  dedicationBadge?: string;
  dedicationName?: string;
  dedicationParents?: string;
  updatedAt?: FirestoreTimestamp | any;
}

export type ThemeType = 'midnight' | 'obsidian' | 'sepia' | 'light';
export type FontType = 'amiri' | 'naskh' | 'ruqaa' | 'cairo';

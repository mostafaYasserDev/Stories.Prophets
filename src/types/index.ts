export interface Series {
  id: string;
  title: string;
  description?: string;
  order: number;
  isPinned: boolean;
  createdAt?: any;
  updatedAt?: any;
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
  isPinned?: boolean; // Pinned episode to highlight in index
  createdAt?: any;
  updatedAt?: any;
}

export interface Reflection {
  id: string;
  episodeId: string;
  text: string;
  createdAt?: any;
}

export interface GlobalAudio {
  audioUrl: string;
  audioType?: 'direct' | 'chunked' | null;
  audioChunksCount?: number;
  originalFileName?: string;
  originalSize?: number;
  compressedSize?: number;
  updatedAt?: any;
}

export interface SiteSettings {
  siteTitle?: string;
  siteSubtitle?: string;
  dedicationBadge?: string;
  dedicationName?: string;
  dedicationParents?: string;
  updatedAt?: any;
}

export type ThemeType = 'midnight' | 'obsidian' | 'sepia' | 'light';
export type FontType = 'amiri' | 'naskh' | 'ruqaa' | 'cairo';

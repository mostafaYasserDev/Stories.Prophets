export interface Episode {
  docId: string;
  order: number;
  era: string;
  title: string;
  subtitle?: string;
  html: string;
  audioUrl?: string | null;
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
  updatedAt?: any;
}

export type ThemeType = 'midnight' | 'obsidian' | 'sepia' | 'light';
export type FontType = 'amiri' | 'naskh' | 'ruqaa' | 'cairo';

'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Feather,
  Clock,
  Hash,
  Bookmark,
  Share2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Forward,
  Headphones,
  Link2,
  X,
  Copy,
  ExternalLink,
  List,
  Palette,
  ShieldCheck,
  Check,
  Pin,
  RefreshCw,
  Eye,
  EyeOff,
  BookOpen,
  ChevronDown,
} from 'lucide-react';

import { Episode, ThemeType, FontType, GlobalAudio, SiteSettings } from '@/types';
import { db, initAnalytics } from '@/lib/firebase';
import { INITIAL_SEED_EPISODES } from '@/lib/seedData';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { resolveGlobalAudioUrl } from '@/lib/audioStorage';

import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { AudioWidget } from '@/components/AudioWidget';
import { Reflections } from '@/components/Reflections';
import { Toast, ToastMessage } from '@/components/Toast';

export default function HomePage() {
  // App Data State
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [lastReadIndex, setLastReadIndex] = useState<number>(0);
  const [activeEra, setActiveEra] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [readEpisodes, setReadEpisodes] = useState<Set<string>>(new Set());
  const [globalAudio, setGlobalAudio] = useState<GlobalAudio | null>(null);
  const [resolvedGlobalAudioUrl, setResolvedGlobalAudioUrl] = useState<string | null>(null);
  const [isLoadingGlobalAudio, setIsLoadingGlobalAudio] = useState<boolean>(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    siteTitle: 'السيرة النبوية الشريفة',
    siteSubtitle: 'رحلة تفاعلية مباركة في سيرة خير الأنام ﷺ',
    dedicationBadge: 'صَدَقَةٌ جَارِيَةٌ عَنّي',
    dedicationName: 'محمد هاشم ضيف الله',
    dedicationParents: 'وعن أبي وأمي رحمهم الله',
  });

  // UI State
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('midnight');
  const [currentFont, setCurrentFont] = useState<FontType>('amiri');
  const [fontSize, setFontSize] = useState<number>(18);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [articleScrollProgress, setArticleScrollProgress] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals & Collapsible State
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState<boolean>(false);
  const [isMoralSectionOpen, setIsMoralSectionOpen] = useState<boolean>(false);

  // Touch Swipe Gesture State
  const touchStartCoords = useRef<{ x: number; y: number } | null>(null);

  // Toast Trigger Helper
  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Initial Analytics
  useEffect(() => {
    initAnalytics();
  }, []);

  // Theme & Font & Storage Initialization
  useEffect(() => {
    const savedTheme = (localStorage.getItem('seerah_theme') as ThemeType) || 'midnight';
    const savedFont = (localStorage.getItem('seerah_font') as FontType) || 'amiri';
    const savedFontSize = parseInt(localStorage.getItem('seerah_fontsize') || '18', 10);
    const savedBookmarks = new Set<string>(JSON.parse(localStorage.getItem('seerah_bookmarks') || '[]'));
    const savedRead = new Set<string>(JSON.parse(localStorage.getItem('seerah_read') || '[]'));
    const savedIndex = parseInt(localStorage.getItem('seerah_last_index') || '0', 10);

    setCurrentTheme(savedTheme);
    setCurrentFont(savedFont);
    setFontSize(savedFontSize);
    setBookmarks(savedBookmarks);
    setReadEpisodes(savedRead);
    setLastReadIndex(savedIndex);

    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-font', savedFont);
    document.documentElement.style.setProperty('--font-size-base', `${savedFontSize}px`);
  }, []);

  // Instant Cache-First Initialization (0ms initial load)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('seerah_cached_episodes');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEpisodes(parsed);
          return;
        }
      }
      // First visit fallback: load initial seed immediately to eliminate wait
      const seedMapped: Episode[] = INITIAL_SEED_EPISODES.map((ep: any, idx: number) => ({
        docId: `seed-${idx + 1}`,
        order: idx + 1,
        era: ep.era,
        title: ep.title,
        subtitle: ep.subtitle || `الحلقة ${String(idx + 1).padStart(3, '0')}`,
        html: ep.html,
        audioUrl: null,
        createdAt: null,
      }));
      setEpisodes(seedMapped);
    } catch (e) {
      console.warn('Cache initialization error:', e);
    }
  }, []);

  // Real-time Firestore Episodes Listener & Auto-seed
  useEffect(() => {
    const q = query(collection(db, 'episodes'), orderBy('order', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          // Auto-seed initial 8 episodes if database is empty
          try {
            const batch = writeBatch(db);
            INITIAL_SEED_EPISODES.forEach((ep: any, idx: number) => {
              const docRef = doc(collection(db, 'episodes'));
              batch.set(docRef, {
                order: idx + 1,
                era: ep.era,
                title: ep.title,
                subtitle: ep.subtitle || `الحلقة ${String(idx + 1).padStart(3, '0')}`,
                html: ep.html,
                audioUrl: null,
                createdAt: serverTimestamp(),
              });
            });
            await batch.commit();
          } catch (e: any) {
            console.error('Seeding error:', e);
          }
          return;
        }

        const items = snapshot.docs.map((d) => ({
          docId: d.id,
          ...d.data(),
        })) as Episode[];

        items.sort((a, b) => (a.order || 0) - (b.order || 0));
        setEpisodes(items);

        // Update local cache safely (preventing localStorage quota issues)
        try {
          const cacheSafe = items.map((ep) => ({
            docId: ep.docId,
            order: ep.order,
            era: ep.era,
            title: ep.title,
            subtitle: ep.subtitle,
            html: ep.html,
            audioUrl: ep.audioUrl && ep.audioUrl.startsWith('data:') ? '__CACHED_BASE64__' : ep.audioUrl,
            audioType: ep.audioType,
            isPinned: ep.isPinned,
          }));
          localStorage.setItem('seerah_cached_episodes', JSON.stringify(cacheSafe));
        } catch (e) {
          console.warn('LocalStorage cache write error:', e);
        }
      },
      (error) => {
        console.error('Firestore listener error:', error);
        triggerToast('تعذّر الاتصال بقاعدة البيانات السحابية: ' + error.message, 'error');
      }
    );

    return () => unsubscribe();
  }, []);

  // Deep-Linking Handler: On episodes load, check URL params ?ep=X or ?id=Y
  useEffect(() => {
    if (episodes.length === 0) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const epParam = params.get('ep');
    const idParam = params.get('id');

    if (epParam) {
      const targetIdx = parseInt(epParam, 10) - 1;
      if (targetIdx >= 0 && targetIdx < episodes.length) {
        setCurrentIndex(targetIdx);
        return;
      }
    }

    if (idParam) {
      const targetIdx = episodes.findIndex((e) => e.docId === idParam);
      if (targetIdx !== -1) {
        setCurrentIndex(targetIdx);
        return;
      }
    }

    // Default to last read index if within bounds
    const savedIndex = parseInt(localStorage.getItem('seerah_last_index') || '0', 10);
    if (savedIndex >= 0 && savedIndex < episodes.length) {
      setCurrentIndex(savedIndex);
    }
  }, [episodes]);

  // Real-time Global Audio Listener
  useEffect(() => {
    const docRef = doc(db, 'settings', 'global_audio');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setGlobalAudio(docSnap.data() as GlobalAudio);
      } else {
        setGlobalAudio(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Resolve Global Audio URL (direct or reassemble chunks)
  useEffect(() => {
    let isMounted = true;
    if (!globalAudio || !globalAudio.audioUrl) {
      setResolvedGlobalAudioUrl(null);
      return;
    }

    if (globalAudio.audioUrl !== '__CHUNKS__') {
      setResolvedGlobalAudioUrl(globalAudio.audioUrl);
      return;
    }

    setIsLoadingGlobalAudio(true);
    resolveGlobalAudioUrl(globalAudio)
      .then((url) => {
        if (isMounted) {
          setResolvedGlobalAudioUrl(url);
          setIsLoadingGlobalAudio(false);
        }
      })
      .catch((err) => {
        console.error('Error resolving global audio:', err);
        if (isMounted) setIsLoadingGlobalAudio(false);
      });

    return () => {
      isMounted = false;
    };
  }, [globalAudio]);

  // Real-time Site Settings Listener
  useEffect(() => {
    const docRef = doc(db, 'settings', 'site_info');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSiteSettings((prev) => ({ ...prev, ...(docSnap.data() as SiteSettings) }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Article Scroll Progress Listener
  useEffect(() => {
    const handleScroll = () => {
      const article = document.getElementById('mainReadingCard');
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const totalHeight = rect.height - window.innerHeight;
      if (totalHeight <= 0) {
        setArticleScrollProgress(100);
        return;
      }
      const currentScroll = -rect.top;
      const pct = Math.min(100, Math.max(0, Math.round((currentScroll / totalHeight) * 100)));
      setArticleScrollProgress(pct);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentIndex, episodes.length]);

  // Focus Mode Document Class & Keybinding
  useEffect(() => {
    if (isFocusMode) {
      document.body.classList.add('focus-mode');
    } else {
      document.body.classList.remove('focus-mode');
    }
    return () => document.body.classList.remove('focus-mode');
  }, [isFocusMode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFocusMode]);

  // Current Episode Helper
  const currentEpisode: Episode | undefined = useMemo(() => {
    if (episodes.length === 0) return undefined;
    const safeIndex = Math.min(Math.max(0, currentIndex), episodes.length - 1);
    return episodes[safeIndex];
  }, [episodes, currentIndex]);

  // Coordinated Audio Playback Handler
  const handleOtherAudioPlay = useCallback(() => {}, []);

  // Navigate to Episode with URL sync
  const goToEpisode = (index: number) => {
    if (index < 0 || index >= episodes.length) return;
    setIsMoralSectionOpen(false);
    setCurrentIndex(index);
    setLastReadIndex(index);
    localStorage.setItem('seerah_last_index', String(index));

    // Update browser URL query without reload (?ep=X)
    if (typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?ep=${index + 1}`;
      window.history.replaceState(null, '', newUrl);
    }

    // Mark as read
    if (episodes[index]) {
      const updatedRead = new Set(readEpisodes);
      updatedRead.add(episodes[index].docId);
      setReadEpisodes(updatedRead);
      localStorage.setItem('seerah_read', JSON.stringify(Array.from(updatedRead)));
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Bookmark Toggle
  const toggleBookmark = () => {
    if (!currentEpisode) return;
    const updated = new Set(bookmarks);
    if (updated.has(currentEpisode.docId)) {
      updated.delete(currentEpisode.docId);
      triggerToast('تمت إزالة الحلقة من المفضلة', 'info');
    } else {
      updated.add(currentEpisode.docId);
      triggerToast('تم حفظ الحلقة في المفضلة ⭐', 'success');
    }
    setBookmarks(updated);
    localStorage.setItem('seerah_bookmarks', JSON.stringify(Array.from(updated)));
  };

  // Theme Cycling
  const cycleTheme = () => {
    const themesList: ThemeType[] = ['midnight', 'obsidian', 'sepia', 'light'];
    const nextIdx = (themesList.indexOf(currentTheme) + 1) % themesList.length;
    const nextTheme = themesList[nextIdx];
    setCurrentTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('seerah_theme', nextTheme);

    const themeNames: Record<ThemeType, string> = {
      midnight: 'كحل ملكي',
      obsidian: 'الذهب والظلال',
      sepia: 'رملي دافئ',
      light: 'نهاري نقي',
    };
    triggerToast(`المظهر: ${themeNames[nextTheme]}`, 'info');
  };

  // Font Cycling
  const cycleFont = () => {
    const fontsList: FontType[] = ['amiri', 'naskh', 'ruqaa', 'cairo'];
    const nextIdx = (fontsList.indexOf(currentFont) + 1) % fontsList.length;
    const nextFont = fontsList[nextIdx];
    setCurrentFont(nextFont);
    document.documentElement.setAttribute('data-font', nextFont);
    localStorage.setItem('seerah_font', nextFont);

    const fontNames: Record<FontType, string> = {
      amiri: 'الأميري القرآني',
      naskh: 'النسخ العربي',
      ruqaa: 'الرقعة الشريف',
      cairo: 'خط كايرو العصري',
    };
    triggerToast(`الخط: ${fontNames[nextFont]}`, 'info');
  };

  // Zoom Controls
  const handleZoomIn = () => {
    if (fontSize < 28) {
      const nextSize = fontSize + 2;
      setFontSize(nextSize);
      document.documentElement.style.setProperty('--font-size-base', `${nextSize}px`);
      localStorage.setItem('seerah_fontsize', String(nextSize));
    }
  };

  const handleZoomOut = () => {
    if (fontSize > 14) {
      const nextSize = fontSize - 2;
      setFontSize(nextSize);
      document.documentElement.style.setProperty('--font-size-base', `${nextSize}px`);
      localStorage.setItem('seerah_fontsize', String(nextSize));
    }
  };

  // Keyboard Shortcuts (ArrowRight / ArrowLeft for navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowRight') {
        goToEpisode(currentIndex - 1);
      } else if (e.key === 'ArrowLeft') {
        goToEpisode(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, episodes.length]);

  // Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartCoords.current = {
      x: e.changedTouches[0].screenX,
      y: e.changedTouches[0].screenY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartCoords.current) return;
    const deltaX = e.changedTouches[0].screenX - touchStartCoords.current.x;
    const deltaY = e.changedTouches[0].screenY - touchStartCoords.current.y;
    touchStartCoords.current = null;

    if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 45) {
      if (deltaX > 0) {
        goToEpisode(currentIndex - 1);
      } else {
        goToEpisode(currentIndex + 1);
      }
    }
  };

  // Reading Time Estimation
  const estimatedMinutes = useMemo(() => {
    if (!currentEpisode) return 2;
    const words = currentEpisode.html.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 140));
  }, [currentEpisode]);

  // Enhanced HTML formatting for Quran, Hadith, Poetry and TTS Spans
  const formattedHtml = useMemo(() => {
    if (!currentEpisode) return '';
    let html = currentEpisode.html;

    // Quranic verses ﴿ ... ﴾
    html = html.replace(
      /﴿(.*?)﴾/g,
      '<span class="quran-verse"><span class="quran-bracket">﴿</span>$1<span class="quran-bracket">﴾</span></span>'
    );

    // Prophet blessing
    html = html.replace(
      /(صلى الله عليه وسلم|ﷺ|-ﷺ-)/g,
      '<span class="prophet-blessing">ﷺ</span>'
    );

    // Poetry verses
    html = html.replace(/<p>([^<]*?(?:(?:\.\.\.|···)[^<]*?)+)<\/p>/g, function (match, inner) {
      if (inner.includes('...') || inner.includes('···')) {
        return `<div class="poetry-block">${inner.replace(/\.\.\./g, ' &nbsp;···&nbsp; ')}</div>`;
      }
      return match;
    });

    return html;
  }, [currentEpisode]);

  // Deep direct URL and Share formatting
  const episodeDirectUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?ep=${currentIndex + 1}`;
  }, [currentIndex]);

  const shareText = useMemo(() => {
    if (!currentEpisode) return '';
    return `«${currentEpisode.title}» - ${currentEpisode.subtitle || currentEpisode.era}\nمن السيرة النبوية الشريفة ﷺ\n${episodeDirectUrl}`;
  }, [currentEpisode, episodeDirectUrl]);

  const handleNativeShare = async () => {
    if (navigator.share && currentEpisode) {
      try {
        await navigator.share({
          title: currentEpisode.title,
          text: shareText,
          url: episodeDirectUrl,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(`${shareText}\n${episodeDirectUrl}`).then(() => {
        triggerToast('تم نسخ مقتطف الحلقة ورابطها المباشر للمشاركة!', 'success');
      });
    }
  };

  const progressPercent = episodes.length
    ? Math.round(((currentIndex + 1) / episodes.length) * 100)
    : 0;

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Sticky Article Scroll Progress Indicator */}
      <div
        className="article-scroll-progress-bar"
        style={{ width: `${articleScrollProgress}%` }}
        title={`نسبة قراءة المقال: ${articleScrollProgress}%`}
      />

      {/* Focus Mode Exit Floating Button */}
      {isFocusMode && (
        <button
          type="button"
          className="focus-exit-floating-btn"
          onClick={() => setIsFocusMode(false)}
          title="الخروج من وضع القراءة الهادئة (Esc)"
        >
          <EyeOff size={16} />
          <span>إنهاء وضع التركيز (Esc)</span>
        </button>
      )}

      {/* Toast Notifications */}
      <Toast toasts={toasts} />

      {/* Header with dynamic site title and Focus Mode trigger */}
      <Header
        currentTheme={currentTheme}
        onThemeCycle={cycleTheme}
        currentFont={currentFont}
        onFontCycle={cycleFont}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleDrawer={() => setIsDrawerOpen(true)}
        siteSettings={siteSettings}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
      />

      {/* Main Layout */}
      <div className="app-layout">
        {/* Sidebar / Drawer with smart tabs & resume card */}
        <Sidebar
          episodes={episodes}
          currentIndex={currentIndex}
          onSelectEpisode={goToEpisode}
          activeEra={activeEra}
          onSelectEra={setActiveEra}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          bookmarks={bookmarks}
          readEpisodes={readEpisodes}
          isOpenMobile={isDrawerOpen}
          onCloseMobile={() => setIsDrawerOpen(false)}
          lastReadIndex={lastReadIndex}
        />

        {/* Main Reader View */}
        <main className="reader-main">
          {currentEpisode ? (
            <article className="reading-card" id="mainReadingCard">
              {/* Overall Series Progress Bar */}
              <div className="progress-bar-container" title={`إنجاز السلسلة: ${progressPercent}%`}>
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Reader Header */}
              <div className="reader-card-header">
                <div className="reading-stage-tag">
                  <Feather size={14} />
                  <span>{currentEpisode.era}</span>
                  {currentEpisode.isPinned && (
                    <span className="pinned-reader-tag">
                      <Pin size={11} />
                      <span>مثبتة في الصدارة</span>
                    </span>
                  )}
                </div>

                <h2 className="reading-title">{currentEpisode.title}</h2>
                <div className="reading-subtitle">
                  {currentEpisode.subtitle || `الحلقة ${String(currentIndex + 1).padStart(3, '0')}`}
                </div>

                <div className="reading-meta-bar">
                  <div className="meta-item">
                    <Clock size={15} />
                    <span>وقت القراءة: {estimatedMinutes} دقائق تقريباً</span>
                  </div>
                  <div className="meta-item">
                    <Hash size={15} />
                    <span>الحلقة {currentIndex + 1} من {episodes.length}</span>
                  </div>
                </div>
              </div>

              {/* Reader Controls Toolbar */}
              <div className="reader-toolbar">
                <div className="toolbar-group">
                  {/* Episode Audio Button */}
                  {currentEpisode.audioUrl && (
                    <button
                      type="button"
                      className="tool-btn accent"
                      onClick={() => {
                        const el = document.querySelector('.studio-audio-player');
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      title="الانتقال لمشغل التسجيل الصوتي للحلقة"
                    >
                      <Headphones size={16} />
                      <span>الاستماع للحلقة</span>
                    </button>
                  )}

                  {/* Moral Lessons Toolbar Button */}
                  <button
                    type="button"
                    className={`tool-btn ${currentEpisode.moralLesson ? 'accent' : ''}`}
                    onClick={() => {
                      if (currentEpisode.moralLesson) {
                        setIsMoralSectionOpen((prev) => !prev);
                        setTimeout(() => {
                          const el = document.querySelector('.moral-lessons-accordion');
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 50);
                      } else {
                        setIsGeminiModalOpen(true);
                      }
                    }}
                    title="العبر والفوائد الإيمانية المستخلصة"
                  >
                    <Sparkles size={16} style={{ color: currentEpisode.moralLesson ? 'var(--gold)' : undefined }} />
                    <span>العبر والفوائد {currentEpisode.moralLesson ? '✨' : ''}</span>
                  </button>

                  {/* Bookmark Button */}
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={toggleBookmark}
                    title="حفظ في المفضلة"
                  >
                    <Bookmark
                      size={16}
                      style={bookmarks.has(currentEpisode.docId) ? { color: 'var(--gold)' } : {}}
                    />
                    <span>{bookmarks.has(currentEpisode.docId) ? 'محفوظ' : 'حفظ'}</span>
                  </button>
                </div>

                <div className="toolbar-group">
                  {/* Focus Mode Button inside Reader Toolbar */}
                  <button
                    type="button"
                    className={`tool-btn ${isFocusMode ? 'active' : ''}`}
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    title="وضع القراءة الهادئة بدون تشتيت"
                  >
                    <Eye size={16} />
                    <span>وضع التركيز</span>
                  </button>

                  {/* Share Button */}
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={handleNativeShare}
                    title="مشاركة الحلقة"
                  >
                    <Share2 size={16} />
                    <span>مشاركة</span>
                  </button>
                </div>
              </div>

              {/* Episode Audio Player (Rendered purely if audioUrl is present, coordinated with TTS) */}
              <AudioWidget episode={currentEpisode} onPlay={handleOtherAudioPlay} />

              {/* Reading Content Body */}
              <div className="reading-content-body">
                <div
                  className="reading-text"
                  dangerouslySetInnerHTML={{ __html: formattedHtml }}
                />
              </div>

              {/* Collapsible Moral Lessons Accordion Section */}
              {currentEpisode.moralLesson && (
                <section className={`moral-lessons-accordion ${isMoralSectionOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="moral-accordion-trigger"
                    onClick={() => setIsMoralSectionOpen(!isMoralSectionOpen)}
                    aria-expanded={isMoralSectionOpen}
                  >
                    <div className="moral-accordion-left">
                      <div className="moral-lessons-icon">
                        <Sparkles size={20} />
                      </div>
                      <div className="moral-accordion-titles">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 className="moral-lessons-title">العبر والفوائد الإيمانية المستخلصة</h3>
                          <span className="moral-ai-badge">✨ بالذكاء الاصطناعي (AI)</span>
                        </div>
                        <p className="moral-lessons-subtitle">
                          {isMoralSectionOpen
                            ? 'تأملات تربوية وعملية مستنبطة لمساعدتك على التدبر والعمل بهدي النبي ﷺ'
                            : 'اضغط هنا لفتح وقراءة الدروس والعبر التربوية المستخلصة من هذه الحلقة ▾'}
                        </p>
                      </div>
                    </div>

                    <div className="moral-accordion-right">
                      <span className="moral-toggle-btn-pill">
                        <span>{isMoralSectionOpen ? 'طي وإخفاء' : 'فتح وتأمل العبر'}</span>
                        <ChevronDown
                          size={18}
                          className={`moral-chevron ${isMoralSectionOpen ? 'rotated' : ''}`}
                        />
                      </span>
                    </div>
                  </button>

                  {isMoralSectionOpen && (
                    <div className="moral-accordion-content">
                      <div className="moral-accordion-actions-bar">
                        <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                          تأملات إيمانية مستخلصة لحياتنا المعاصرة:
                        </span>
                        <button
                          type="button"
                          className="tool-btn"
                          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(currentEpisode.moralLesson!).then(() => {
                              triggerToast('تم نسخ العبر والفوائد للحافظة بنجاح! 📜', 'success');
                            });
                          }}
                          title="نسخ العبر والفوائد"
                        >
                          <Copy size={15} />
                          <span>نسخ العبر</span>
                        </button>
                      </div>

                      <div className="moral-lessons-body">
                        {currentEpisode.moralLesson
                          .split('\n')
                          .filter((l) => l.trim())
                          .map((line, lIdx) => {
                            const isPoint = /^(\d+[\.\-\)]|\*|\-)\s*/.test(line);
                            return (
                              <p key={lIdx} className={`moral-lesson-line ${isPoint ? 'moral-point' : ''}`}>
                                {line}
                              </p>
                            );
                          })}
                      </div>

                      <div className="moral-ai-footer-note">
                        <span>💡 <strong>تنبيه للمتدبر:</strong> تم استنباط هذه الدروس والعبر وصياغتها استناداً لأحداث ومواقف الحلقة بواسطة الذكاء الاصطناعي (AI) لمساعدة القارئ على الاستفادة والتطبيق العملي.</span>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Reflections Section */}
              <Reflections
                episodeId={currentEpisode.docId}
                onToast={triggerToast}
              />

              {/* Navigation Footer */}
              <div className="reader-nav-footer">
                <button
                  type="button"
                  className="nav-btn"
                  onClick={() => goToEpisode(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  <ArrowRight size={18} />
                  <span>الحلقة السابقة</span>
                </button>

                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => goToEpisode(episodes.length - 1)}
                  title="الانتقال لأحدث حلقة"
                >
                  <Forward size={16} />
                  <span>أحدث حلقة</span>
                </button>

                <button
                  type="button"
                  className="nav-btn primary"
                  onClick={() => goToEpisode(currentIndex + 1)}
                  disabled={currentIndex === episodes.length - 1}
                >
                  <span>الحلقة التالية</span>
                  <ArrowLeft size={18} />
                </button>
              </div>
            </article>
          ) : (
            <div className="islamic-loading-screen" id="islamicLoadingScreen">
              <div className="islamic-loader-card">
                <div className="islamic-loader-emblem-wrap">
                  <div className="islamic-loader-ring" />
                  <div className="islamic-loader-ring-inner" />
                  <div className="islamic-loader-core-icon">🕌</div>
                </div>

                <div className="loader-salawat-badge">
                  اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى سَيِّدِنَا مُحَمَّدٍ ﷺ
                </div>

                <h3 className="loader-title">جارٍ فتح صحائف السيرة النبوية الشريفة...</h3>
                <p className="loader-sub">رحلة تفاعلية مباركة في سيرة خير الأنام ﷺ</p>

                {/* Shimmer Skeleton Reader Representation */}
                <div className="skeleton-header-row">
                  <div className="skeleton-box skeleton-tag" />
                </div>
                <div className="skeleton-box skeleton-title" />
                <div className="skeleton-box skeleton-subtitle" />

                <div className="skeleton-paragraphs">
                  <div className="skeleton-box skeleton-line" />
                  <div className="skeleton-box skeleton-line medium" />
                  <div className="skeleton-box skeleton-line" />
                  <div className="skeleton-box skeleton-line short" />
                </div>
              </div>
            </div>
          )}

          {/* Global Audio Card (Display only if active) */}
          {globalAudio && globalAudio.audioUrl && (
            <section className="global-audio-card">
              <div className="global-audio-info">
                <div className="global-audio-icon">
                  <Headphones size={20} />
                </div>
                <div className="global-audio-text">
                  <h4>مقطع صوتي عام للسيرة النبوية</h4>
                  <p>
                    {globalAudio.originalFileName
                      ? globalAudio.originalFileName
                      : 'تسجيل صوتي مبارك وشامل'}
                  </p>
                </div>
              </div>

              <div className="global-audio-player-wrap">
                {isLoadingGlobalAudio ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontSize: '0.85rem' }}>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>جارٍ تجهيز المقطع الصوتي من السحابة...</span>
                  </div>
                ) : (
                  resolvedGlobalAudioUrl && (
                    <audio
                      controls
                      src={resolvedGlobalAudioUrl}
                      preload="metadata"
                      onPlay={handleOtherAudioPlay}
                    />
                  )
                )}
              </div>
            </section>
          )}

          {/* Dedication Banner & Footer */}
          <footer className="dedication-card">
            <div className="dedication-badge">{siteSettings.dedicationBadge || 'صَدَقَةٌ جَارِيَةٌ عَنّي'}</div>
            <div className="dedication-name">{siteSettings.dedicationName || 'محمد هاشم ضيف الله'}</div>
            {siteSettings.dedicationParents && (
              <div className="dedication-parents">{siteSettings.dedicationParents}</div>
            )}

            <div className="social-share-row">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="share-btn"
                title="مشاركة عبر واتساب"
              >
                <span style={{ fontWeight: 'bold' }}>واتساب</span>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(episodeDirectUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="share-btn"
                title="مشاركة عبر تيليجرام"
              >
                <span style={{ fontWeight: 'bold' }}>تيليجرام</span>
              </a>
              <button
                type="button"
                className="share-btn"
                onClick={() => {
                  navigator.clipboard.writeText(episodeDirectUrl).then(() => {
                    triggerToast('تم نسخ رابط الحلقة المباشر بنجاح!', 'success');
                  });
                }}
                title="نسخ الرابط المباشر"
              >
                <Link2 size={16} />
                <span>نسخ الرابط</span>
              </button>
            </div>

            {/* Discrete Admin Link */}
            <div className="admin-discrete-footer-wrap">
              <Link href="/admin" className="admin-discrete-link" title="الدخول للوحة التحكم">
                <ShieldCheck size={14} />
                <span>لوحة تحكم المشرف</span>
              </Link>
            </div>
          </footer>
        </main>
      </div>



      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-bar">
        <button
          type="button"
          className="mobile-tab-btn"
          onClick={() => goToEpisode(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          <ArrowRight size={18} />
          <span>السابقة</span>
        </button>
        <button
          type="button"
          className="mobile-tab-btn"
          onClick={() => setIsDrawerOpen(true)}
        >
          <List size={18} />
          <span>الفهرس</span>
        </button>
        <button
          type="button"
          className="mobile-tab-btn"
          onClick={cycleTheme}
        >
          <Palette size={18} />
          <span>المظهر</span>
        </button>
        <button
          type="button"
          className="mobile-tab-btn"
          onClick={() => goToEpisode(currentIndex + 1)}
          disabled={currentIndex === episodes.length - 1}
        >
          <ArrowLeft size={18} />
          <span>التالية</span>
        </button>
      </nav>

      {/* Moral Lessons & Reflections Modal */}
      {isGeminiModalOpen && currentEpisode && (
        <div className="modal-overlay" onClick={() => setIsGeminiModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '620px', width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(200, 155, 60, 0.15)',
                    border: '1px solid rgba(200, 155, 60, 0.3)',
                    color: 'var(--gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="moral-ai-badge" style={{ marginBottom: '2px' }}>✨ مستخلصة بواسطة الذكاء الاصطناعي (AI)</div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-title)' }}>
                    العبر والفوائد الإيمانية المستخلصة
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    حلقة: {currentEpisode.title}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsGeminiModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {currentEpisode.moralLesson ? (
              <>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.7' }}>
                  تأملات تربوية وعبر إيمانية تم استخلاصها وصياغتها بواسطة <strong>الذكاء الاصطناعي (AI)</strong> استناداً لأحداث ومواقف هذه الحلقة المباركة:
                </p>

                <div className="moral-modal-quote-box">
                  {currentEpisode.moralLesson
                    .split('\n')
                    .filter((l) => l.trim())
                    .map((line, idx) => {
                      const isPoint = /^(\d+[\.\-\)]|\*|\-)\s*/.test(line);
                      return (
                        <p
                          key={idx}
                          className={`moral-modal-line ${isPoint ? 'is-point' : ''}`}
                        >
                          {line}
                        </p>
                      );
                    })}
                </div>

                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button
                    type="button"
                    className="btn-gold"
                    onClick={() => {
                      navigator.clipboard.writeText(currentEpisode.moralLesson!).then(() => {
                        triggerToast('تم نسخ العبر والفوائد للحافظة بنجاح! 📜', 'success');
                      });
                    }}
                  >
                    <Copy size={16} />
                    <span>نسخ العبر والفوائد</span>
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => setIsGeminiModalOpen(false)}
                  >
                    إغلاق
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed rgba(200, 155, 60, 0.25)',
                    margin: '12px 0 16px',
                  }}
                >
                  <Sparkles size={36} style={{ color: 'var(--gold)', opacity: 0.8, marginBottom: '12px' }} />
                  <h4 style={{ color: 'var(--text-title)', fontSize: '1.05rem', marginBottom: '8px' }}>
                    لم يتم استخلاص العبر لهذه الحلقة بعد
                  </h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px', lineHeight: '1.7' }}>
                    يتم استخلاص وتجهيز العبر الإيمانية والتربوية لكل حلقة من خلال لوحة التحكم لتظهر لجميع القراء هنا مباشرة دون مغادرة الموقع.
                  </p>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => {
                      const text = `أنا أقرأ هذه الحلقة من السيرة النبوية الشريفة: «${currentEpisode.title}»:\n\n${currentEpisode.html.replace(/<[^>]+>/g, '').trim()}\n\nالمطلوب:\n1. استخرج أهم 3 دروس وعبر تربوية وعملية لحياتنا المعاصرة من هذا الموقف.\n2. بين أهم الفوائد الإيمانية.\n3. صغ ذلك بأسلوب مؤثر وجميل ومختصر.`;
                      navigator.clipboard.writeText(text).then(() => {
                        triggerToast('تم نسخ نص الحلقة والأمر للحافظة!', 'success');
                      });
                    }}
                  >
                    <Copy size={16} />
                    <span>نسخ نص الحلقة والأمر</span>
                  </button>
                  <button
                    type="button"
                    className="btn-gold"
                    onClick={() => setIsGeminiModalOpen(false)}
                  >
                    حسناً
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

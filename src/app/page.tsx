'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Feather,
  Clock,
  Hash,
  Volume2,
  Bot,
  Bookmark,
  Share2,
  ArrowRight,
  ArrowLeft,
  Forward,
  Headphones,
  Link2,
  StopCircle,
  X,
  Copy,
  ExternalLink,
  List,
  Palette,
  ShieldCheck,
  Check,
  Pin,
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

import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { AudioWidget } from '@/components/AudioWidget';
import { Reflections } from '@/components/Reflections';
import { Toast, ToastMessage } from '@/components/Toast';

export default function HomePage() {
  // App State
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [activeEra, setActiveEra] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [readEpisodes, setReadEpisodes] = useState<Set<string>>(new Set());
  const [globalAudio, setGlobalAudio] = useState<GlobalAudio | null>(null);
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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals State
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState<boolean>(false);

  // Speech Reader State
  const [isSpeechActive, setIsSpeechActive] = useState<boolean>(false);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  // Theme & Font Initialization
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
    setCurrentIndex(savedIndex);

    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-font', savedFont);
    document.documentElement.style.setProperty('--font-size-base', `${savedFontSize}px`);
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
      },
      (error) => {
        console.error('Firestore listener error:', error);
        triggerToast('تعذّر الاتصال بقاعدة البيانات السحابية: ' + error.message, 'error');
      }
    );

    return () => unsubscribe();
  }, []);

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

  // Current Episode Helper
  const currentEpisode: Episode | undefined = useMemo(() => {
    if (episodes.length === 0) return undefined;
    const safeIndex = Math.min(Math.max(0, currentIndex), episodes.length - 1);
    return episodes[safeIndex];
  }, [episodes, currentIndex]);

  // Navigate to Episode
  const goToEpisode = (index: number) => {
    if (index < 0 || index >= episodes.length) return;
    stopSpeechReader();
    setCurrentIndex(index);
    localStorage.setItem('seerah_last_index', String(index));

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

  // Native Web Speech Reader
  const toggleSpeechReader = () => {
    if (!('speechSynthesis' in window)) {
      triggerToast('المتصفح الحالي لا يدعم القارئ الصوتي الآلي.', 'error');
      return;
    }

    if (isSpeechActive) {
      stopSpeechReader();
    } else {
      startSpeechReader();
    }
  };

  const startSpeechReader = () => {
    if (!currentEpisode) return;
    const plainText = currentEpisode.html.replace(/<[^>]+>/g, '').trim();
    if (!plainText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find((v) => v.lang.startsWith('ar'));
    if (arVoice) utterance.voice = arVoice;

    utterance.onstart = () => setIsSpeechActive(true);
    utterance.onend = () => setIsSpeechActive(false);
    utterance.onerror = () => setIsSpeechActive(false);

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeechReader = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeechActive(false);
  };

  // Keyboard Shortcuts
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

  // Enhanced HTML formatting for Quran, Hadith, Poetry
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

  // Sharing Text
  const shareText = currentEpisode
    ? `«${currentEpisode.title}» - ${currentEpisode.subtitle || currentEpisode.era}\nمن السيرة النبوية الشريفة ﷺ\n${typeof window !== 'undefined' ? window.location.href : ''}`
    : '';

  const handleNativeShare = async () => {
    if (navigator.share && currentEpisode) {
      try {
        await navigator.share({
          title: currentEpisode.title,
          text: shareText,
          url: window.location.href,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        triggerToast('تم نسخ مقتطف الحلقة ورابطها للمشاركة!', 'success');
      });
    }
  };

  const progressPercent = episodes.length
    ? Math.round(((currentIndex + 1) / episodes.length) * 100)
    : 0;

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Toast Notifications */}
      <Toast toasts={toasts} />

      {/* Header */}
      <Header
        currentTheme={currentTheme}
        onThemeCycle={cycleTheme}
        currentFont={currentFont}
        onFontCycle={cycleFont}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleDrawer={() => setIsDrawerOpen(true)}
      />

      {/* Main Layout */}
      <div className="app-layout">
        {/* Sidebar / Drawer */}
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
        />

        {/* Main Reader View */}
        <main className="reader-main">
          {currentEpisode ? (
            <article className="reading-card" id="mainReadingCard">
              {/* Progress Bar */}
              <div className="progress-bar-container">
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
                  {/* Built-in Speech Synthesis */}
                  <button
                    className={`tool-btn ${isSpeechActive ? 'active' : 'accent'}`}
                    onClick={toggleSpeechReader}
                    title="استماع صوتي آلي للنص"
                  >
                    <Volume2 size={16} />
                    <span>{isSpeechActive ? 'إيقاف القراءة' : 'استماع آلي'}</span>
                  </button>

                  {/* Gemini Prompt Modal */}
                  <button
                    className="tool-btn"
                    onClick={() => setIsGeminiModalOpen(true)}
                    title="استخراج الدروس والعبر بالذكاء الاصطناعي"
                  >
                    <Bot size={16} />
                    <span>استخراج العبر (Gemini)</span>
                  </button>

                  {/* Bookmark Button */}
                  <button
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
                  {/* Share Button */}
                  <button
                    className="tool-btn"
                    onClick={handleNativeShare}
                    title="مشاركة الحلقة"
                  >
                    <Share2 size={16} />
                    <span>مشاركة</span>
                  </button>
                </div>
              </div>

              {/* Active Speech Banner */}
              {isSpeechActive && (
                <div className="speech-active-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Volume2 size={16} className="animate-pulse" />
                    <span>القارئ الآلي يقرأ نص الحلقة بصوت واضح الآن...</span>
                  </div>
                  <button
                    className="tool-btn"
                    onClick={stopSpeechReader}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    <StopCircle size={14} /> إيقاف
                  </button>
                </div>
              )}

              {/* Episode Audio Player (Rendered purely if audioUrl is present) */}
              <AudioWidget episode={currentEpisode} />

              {/* Reading Content Body */}
              <div className="reading-content-body">
                <div
                  className="reading-text"
                  dangerouslySetInnerHTML={{ __html: formattedHtml }}
                />
              </div>

              {/* Reflections Section */}
              <Reflections
                episodeId={currentEpisode.docId}
                onToast={triggerToast}
              />

              {/* Navigation Footer */}
              <div className="reader-nav-footer">
                <button
                  className="nav-btn"
                  onClick={() => goToEpisode(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  <ArrowRight size={18} />
                  <span>الحلقة السابقة</span>
                </button>

                <button
                  className="tool-btn"
                  onClick={() => goToEpisode(episodes.length - 1)}
                  title="الانتقال لأحدث حلقة"
                >
                  <Forward size={16} />
                  <span>أحدث حلقة</span>
                </button>

                <button
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
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <p>جارٍ تحميل حلقات السيرة النبوية من السحابة...</p>
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
                  <p>تسجيل صوتي مبارك وشامل</p>
                </div>
              </div>

              <div className="global-audio-player-wrap">
                <audio controls src={globalAudio.audioUrl} preload="metadata" />
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
                href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="share-btn"
                title="مشاركة عبر تيليجرام"
              >
                <span style={{ fontWeight: 'bold' }}>تيليجرام</span>
              </a>
              <button
                className="share-btn"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    triggerToast('تم نسخ رابط الموقع بنجاح!', 'success');
                  });
                }}
                title="نسخ الرابط"
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
          className="mobile-tab-btn"
          onClick={() => goToEpisode(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          <ArrowRight size={18} />
          <span>السابقة</span>
        </button>
        <button
          className="mobile-tab-btn"
          onClick={() => setIsDrawerOpen(true)}
        >
          <List size={18} />
          <span>الفهرس</span>
        </button>
        <button
          className="mobile-tab-btn"
          onClick={cycleTheme}
        >
          <Palette size={18} />
          <span>المظهر</span>
        </button>
        <button
          className="mobile-tab-btn"
          onClick={() => goToEpisode(currentIndex + 1)}
          disabled={currentIndex === episodes.length - 1}
        >
          <ArrowLeft size={18} />
          <span>التالية</span>
        </button>
      </nav>

      {/* Gemini Voice Prompt Modal */}
      {isGeminiModalOpen && currentEpisode && (
        <div className="modal-overlay" onClick={() => setIsGeminiModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>استخراج الدروس والعبر عبر Gemini</h3>
              <button className="modal-close-btn" onClick={() => setIsGeminiModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.7' }}>
              تم تجهيز الأمر الذكي لنص هذه الحلقة. اضغط على «نسخ الأمر والنص» ثم «فتح Gemini» والصق النص هناك ليقوم الذكاء الاصطناعي باستخراج الفوائد الإيمانية والدروس والعبر التربوية.
            </p>
            <textarea
              className="form-textarea"
              style={{ minHeight: '120px', fontSize: '0.85rem' }}
              readOnly
              value={`أنا أقرأ هذه الحلقة من السيرة النبوية الشريفة: «${currentEpisode.title}»:\n\n${currentEpisode.html.replace(/<[^>]+>/g, '').trim()}\n\nالمطلوب:\n1. استخرج أهم 3 دروس وعبر تربوية وعملية لحياتنا المعاصرة من هذا الموقف.\n2. بين أهم الفوائد الإيمانية.\n3. صغ ذلك بأسلوب مؤثر وجميل ومختصر.`}
            />
            <div className="modal-actions">
              <button
                className="btn-gold"
                onClick={() => {
                  const text = `أنا أقرأ هذه الحلقة من السيرة النبوية الشريفة: «${currentEpisode.title}»:\n\n${currentEpisode.html.replace(/<[^>]+>/g, '').trim()}\n\nالمطلوب:\n1. استخرج أهم 3 دروس وعبر تربوية وعملية لحياتنا المعاصرة من هذا الموقف.\n2. بين أهم الفوائد الإيمانية.\n3. صغ ذلك بأسلوب مؤثر وجميل ومختصر.`;
                  navigator.clipboard.writeText(text).then(() => {
                    triggerToast('تم نسخ الأمر والنص للحافظة بنجاح!', 'success');
                  });
                }}
              >
                <Copy size={16} />
                <span>نسخ الأمر والنص</span>
              </button>
              <button
                className="tool-btn"
                onClick={() => window.open('https://gemini.google.com/app', '_blank')}
              >
                <ExternalLink size={16} />
                <span>فتح Gemini</span>
              </button>
              <button
                className="tool-btn"
                onClick={() => setIsGeminiModalOpen(false)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

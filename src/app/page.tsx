'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Feather,
  Clock,
  Hash,
  Volume2,
  Bot,
  Bookmark,
  Share2,
  Edit,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Forward,
  Headphones,
  Upload,
  Link2,
  StopCircle,
  X,
  Copy,
  ExternalLink,
  List,
  Palette,
} from 'lucide-react';

import { Episode, ThemeType, FontType, GlobalAudio } from '@/types';
import { db, initAnalytics } from '@/lib/firebase';
import { INITIAL_SEED_EPISODES } from '@/lib/seedData';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { AudioWidget } from '@/components/AudioWidget';
import { Reflections } from '@/components/Reflections';
import { EpisodeModal } from '@/components/EpisodeModal';
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

  // UI State
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('midnight');
  const [currentFont, setCurrentFont] = useState<FontType>('amiri');
  const [fontSize, setFontSize] = useState<number>(18);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals State
  const [isEpModalOpen, setIsEpModalOpen] = useState<boolean>(false);
  const [editingEp, setEditingEp] = useState<Episode | null>(null);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState<boolean>(false);
  const [isGlobalAudioModalOpen, setIsGlobalAudioModalOpen] = useState<boolean>(false);
  const [globalAudioInputUrl, setGlobalAudioInputUrl] = useState<string>('');
  const [isGlobalAudioSaving, setIsGlobalAudioSaving] = useState<boolean>(false);

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
          // Auto-seed initial 8 episodes
          triggerToast('جارٍ تهيئة ونقل حلقات السيرة النبوية تلقائياً إلى السحابة...', 'info');
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
            triggerToast('تمت تهيئة الحلقات في Firebase بنجاح!', 'success');
          } catch (e: any) {
            console.error('Seeding error:', e);
            triggerToast('خطأ في التهيئة الأولية: ' + e.message, 'error');
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

  // Delete Current Episode
  const handleDeleteCurrentEpisode = async () => {
    if (!currentEpisode) return;
    if (!confirm(`هل أنت متأكد من حذف حلقة: "${currentEpisode.title}" نهائياً من السحابة؟`)) return;

    try {
      await deleteDoc(doc(db, 'episodes', currentEpisode.docId));
      triggerToast('تم حذف الحلقة من السحابة بنجاح', 'info');
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      triggerToast('فشل الحذف: ' + err.message, 'error');
    }
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

  // Global Audio Save Handler (Saved directly to Firestore without Storage)
  const handleSaveGlobalAudio = async () => {
    const url = globalAudioInputUrl.trim();
    if (!url) {
      triggerToast('يرجى كتابة رابط المقطع الصوتي أولاً', 'error');
      return;
    }

    setIsGlobalAudioSaving(true);
    try {
      const globalDocRef = doc(db, 'settings', 'global_audio');
      await writeBatch(db)
        .set(globalDocRef, {
          audioUrl: url,
          updatedAt: serverTimestamp(),
        })
        .commit();
      triggerToast('تم حفظ المقطع الصوتي العام في Firestore بنجاح! 🎧', 'success');
      setIsGlobalAudioModalOpen(false);
    } catch (e: any) {
      triggerToast('خطأ في حفظ الرابط: ' + e.message, 'error');
    } finally {
      setIsGlobalAudioSaving(false);
    }
  };

  const handleRemoveGlobalAudio = async () => {
    if (!confirm('هل تريد إزالة المقطع الصوتي العام؟')) return;
    try {
      await deleteDoc(doc(db, 'settings', 'global_audio'));
      triggerToast('تمت إزالة المقطع العام', 'info');
      setIsGlobalAudioModalOpen(false);
    } catch (err: any) {
      triggerToast('تعذّر الحذف: ' + err.message, 'error');
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
        onOpenAddModal={() => {
          setEditingEp(null);
          setIsEpModalOpen(true);
        }}
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
                    title="نسخ النص لـ Gemini"
                  >
                    <Bot size={16} />
                    <span>Gemini</span>
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

                  {/* Edit Episode */}
                  <button
                    className="tool-btn"
                    onClick={() => {
                      setEditingEp(currentEpisode);
                      setIsEpModalOpen(true);
                    }}
                    title="تعديل الحلقة"
                  >
                    <Edit size={16} />
                    <span>تعديل</span>
                  </button>

                  {/* Delete Episode */}
                  <button
                    className="tool-btn danger-action"
                    onClick={handleDeleteCurrentEpisode}
                    title="حذف الحلقة"
                  >
                    <Trash2 size={16} />
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

              {/* Episode Audio Widget (Record / Play / Upload) */}
              <AudioWidget
                episode={currentEpisode}
                onToast={triggerToast}
              />

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

          {/* Global Audio Card */}
          <section className="global-audio-card">
            <div className="global-audio-info">
              <div className="global-audio-icon">
                <Headphones size={20} />
              </div>
              <div className="global-audio-text">
                <h4>مقطع صوتي عام للسيرة</h4>
                <p>تسجيل صوتي أو مقدمة شاملة</p>
              </div>
            </div>

            <div className="global-audio-player-wrap">
              {globalAudio && globalAudio.audioUrl ? (
                <audio controls src={globalAudio.audioUrl} />
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  لا يوجد مقطع صوتي عام مضاف بعد
                </span>
              )}
            </div>

            <button
              className="tool-btn"
              onClick={() => setIsGlobalAudioModalOpen(true)}
            >
              <Upload size={14} />
              <span>{globalAudio?.audioUrl ? 'تغيير' : 'رفع مقطع'}</span>
            </button>
          </section>

          {/* Dedication Banner */}
          <footer className="dedication-card">
            <div className="dedication-badge">صَدَقَةٌ جَارِيَةٌ عَنّي</div>
            <div className="dedication-name">محمد هاشم ضيف الله</div>
            <div className="dedication-parents">وعن أبي وأمي رحمهم الله</div>

            <div className="social-share-row">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="share-btn"
                title="مشاركة عبر واتساب"
              >
                <span style={{ fontWeight: 'bold' }}>W</span>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                className="share-btn"
                title="مشاركة عبر تيليجرام"
              >
                <span style={{ fontWeight: 'bold' }}>T</span>
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
              </button>
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

      {/* Episode Add / Edit Modal */}
      <EpisodeModal
        isOpen={isEpModalOpen}
        onClose={() => setIsEpModalOpen(false)}
        episode={editingEp}
        totalEpisodes={episodes.length}
        onToast={triggerToast}
      />

      {/* Gemini Voice Prompt Modal */}
      {isGeminiModalOpen && currentEpisode && (
        <div className="modal-overlay" onClick={() => setIsGeminiModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>قراءة النص عبر Gemini</h3>
              <button className="modal-close-btn" onClick={() => setIsGeminiModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.7' }}>
              تم تجهيز نص الحلقة أدناه. اضغط على «نسخ النص» ثم «فتح تطبيق Gemini» والصق النص هناك واطلب منه أن يقرأه لك بصوت عربي واضح ومؤثر.
            </p>
            <textarea
              className="form-textarea"
              style={{ minHeight: '120px', fontSize: '0.85rem' }}
              readOnly
              value={`اقرأ لي النص التالي من السيرة النبوية الشريفة بصوت هادئ ومؤثر وواضح:\n\n${currentEpisode.html.replace(/<[^>]+>/g, '').trim()}`}
            />
            <div className="modal-actions">
              <button
                className="btn-gold"
                onClick={() => {
                  const text = `اقرأ لي النص التالي من السيرة النبوية الشريفة بصوت هادئ ومؤثر وواضح:\n\n${currentEpisode.html.replace(/<[^>]+>/g, '').trim()}`;
                  navigator.clipboard.writeText(text).then(() => {
                    triggerToast('تم نسخ النص للحافظة بنجاح!', 'success');
                  });
                }}
              >
                <Copy size={16} />
                <span>نسخ النص</span>
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

      {/* Global Audio Modal */}
      {isGlobalAudioModalOpen && (
        <div className="modal-overlay" onClick={() => setIsGlobalAudioModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>إضافة مقطع صوتي عام للسيرة</h3>
              <button className="modal-close-btn" onClick={() => setIsGlobalAudioModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">رابط المقطع الصوتي (MP3 مباشر)</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://example.com/audio.mp3"
                value={globalAudioInputUrl}
                onChange={(e) => setGlobalAudioInputUrl(e.target.value)}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                يمكنك استخدام أي رابط MP3 مباشر (مثل روابط Archive.org المجانية أو روابط التخزين المباشرة).
              </p>
            </div>
            <div className="modal-actions">
              {globalAudio?.audioUrl && (
                <button
                  className="tool-btn danger-action"
                  style={{ marginLeft: 'auto' }}
                  onClick={handleRemoveGlobalAudio}
                >
                  إزالة المقطع
                </button>
              )}
              <button
                className="tool-btn"
                onClick={() => setIsGlobalAudioModalOpen(false)}
              >
                إلغاء
              </button>
              <button
                className="btn-gold"
                onClick={handleSaveGlobalAudio}
                disabled={!globalAudioInputUrl.trim() || isGlobalAudioSaving}
              >
                {isGlobalAudioSaving ? 'جارٍ الحفظ...' : 'حفظ في Firestore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

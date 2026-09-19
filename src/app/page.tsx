'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Headphones,
  Sparkles,
  Smartphone,
  ArrowLeft,
  Layers,
  Palette,
  CheckCircle2,
  BookmarkCheck,
  ChevronLeft,
  Compass,
  RefreshCw,
} from 'lucide-react';
import { ThemeType, Episode, GlobalAudio } from '@/types';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { resolveGlobalAudioUrl } from '@/lib/audioStorage';
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer';
import { INITIAL_SEED_EPISODES } from '@/lib/seedData';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';

export default function LandingPage() {
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('midnight');
  const [lastReadEpisode, setLastReadEpisode] = useState<Episode | null>(null);
  const [lastReadIndex, setLastReadIndex] = useState<number>(0);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [globalAudio, setGlobalAudio] = useState<GlobalAudio | null>(null);
  const [resolvedGlobalAudioUrl, setResolvedGlobalAudioUrl] = useState<string | null>(null);
  const [isLoadingGlobalAudio, setIsLoadingGlobalAudio] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
    // Load theme
    try {
      const savedTheme = (localStorage.getItem('seerah_theme') as ThemeType) || 'midnight';
      setCurrentTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);

      // Check last read position
      const savedIndexStr = localStorage.getItem('seerah_last_index');
      if (savedIndexStr !== null) {
        const idx = parseInt(savedIndexStr, 10);
        setLastReadIndex(idx);

        // Try getting title from cached episodes or initial seed
        const cachedStr = localStorage.getItem('seerah_cached_episodes');
        let episodesList: any[] = INITIAL_SEED_EPISODES;
        if (cachedStr) {
          try {
            const parsed = JSON.parse(cachedStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              episodesList = parsed.filter((ep: any) => !ep.isHidden);
            }
          } catch {
            // fallback to seed
          }
        }

        if (idx >= 0 && idx < episodesList.length && !episodesList[idx]?.isHidden) {
          setLastReadEpisode(episodesList[idx]);
        }
      }
    } catch (e) {
      console.warn('Landing page storage initialization:', e);
    }
  }, []);

  // Real-time Global Audio Listener
  useEffect(() => {
    const docRef = doc(db, 'settings', 'global_audio');
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setGlobalAudio(docSnap.data() as GlobalAudio);
        } else {
          setGlobalAudio(null);
        }
      },
      (err) => {
        console.warn('Landing global audio listener notice:', err.message);
      }
    );
    return () => unsubscribe();
  }, []);

  // Resolve Global Audio URL (direct or chunked)
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
        console.error('Error resolving landing global audio:', err);
        if (isMounted) setIsLoadingGlobalAudio(false);
      });

    return () => {
      isMounted = false;
    };
  }, [globalAudio]);

  const cycleTheme = () => {
    const themes: ThemeType[] = ['midnight', 'obsidian', 'sepia', 'light'];
    const nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
    const next = themes[nextIdx];
    setCurrentTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('seerah_theme', next);
    } catch { }
  };

  const triggerPwaInstall = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trigger-pwa-install'));
    }
  };

  return (
    <div className="landing-wrapper">
      {/* Top Navbar */}
      <header className="landing-navbar">
        <div className="landing-brand">
          <div className="landing-brand-emblem">
            <span>🕌</span>
          </div>
          <div className="landing-brand-text">
            <span className="landing-brand-title">قصص الأنبياء وسيرة الرسول</span>
            <span className="landing-brand-sub">رحلة إيمانية مباركة</span>
          </div>
        </div>

        <div className="landing-nav-actions">
          {/* Theme switcher */}
          <button
            type="button"
            className="landing-nav-btn"
            onClick={cycleTheme}
            title="تبديل المظهر (ليلي / هادئ / نهاري)"
            aria-label="تبديل المظهر"
          >
            <Palette size={18} />
            <span className="btn-label-desktop">
              {currentTheme === 'midnight'
                ? 'ليلي'
                : currentTheme === 'obsidian'
                  ? 'داكن'
                  : currentTheme === 'sepia'
                    ? 'دافئ'
                    : 'فاتح'}
            </span>
          </button>

          {/* PWA Install Button */}
          <button
            type="button"
            className="landing-nav-btn pwa-btn"
            onClick={triggerPwaInstall}
            title="تثبيت التطبيق كبرنامج على جهازك"
            aria-label="تثبيت التطبيق كبرنامج"
          >
            <Smartphone size={18} />
            <span className="btn-label-desktop">تثبيت التطبيق</span>
          </button>

          {/* Quick Direct Enter Link */}
          <Link href="/read/" className="landing-enter-btn">
            <span>دخول القارئ</span>
            <ArrowLeft size={16} />
          </Link>
        </div>
      </header>

      {/* Main Single-Screen Hero Container */}
      <main className="landing-main-content">
        <div className="landing-hero-card">
          {/* Bismillah Islamic Badge */}
          <div className="landing-bismillah-badge">
            <span>✨ بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ✨</span>
          </div>

          {/* Main H1 Headline for SEO */}
          <h1 className="landing-title">
            قصص الأنبياء وسيرة الرسول ﷺ
          </h1>

          {/* Subtitle / Catchphrase */}
          <p className="landing-lead">
            رحلة إيمانية مباركة في هدايات الوحي وسيرة خير الأنام ﷺ، تجمع بين جمال السرد القرآني، ونقاء التسجيلات الصوتية، ورصانة التوثيق بالمصادر والمراجع، لتربية النفس وتزكيتها.
          </p>

          {/* Smart Resume Card (if user has read before) */}
          {isClient && lastReadEpisode && (
            <div className="landing-resume-box">
              <div className="landing-resume-info">
                <BookmarkCheck size={20} className="gold-text" />
                <div>
                  <span className="resume-label">مرحباً بعودتك! آخر ما توقفت عنده:</span>
                  <strong className="resume-episode-title">
                    «{lastReadEpisode.title}» - {lastReadEpisode.subtitle || `الحلقة ${lastReadIndex + 1}`}
                  </strong>
                </div>
              </div>
              <Link
                href={`/read/?ep=${lastReadIndex + 1}`}
                className="landing-resume-btn"
                title="متابعة القراءة من النقطة التي توقفت عندها"
              >
                <span>متابعة القراءة</span>
                <ChevronLeft size={16} />
              </Link>
            </div>
          )}

          {/* Luxury Global Audio Showcase */}
          {globalAudio && globalAudio.audioUrl && (
            <div className="landing-audio-showcase">
              <div className="landing-audio-header">
                <div className="landing-audio-titles">
                  <div className="landing-audio-icon">
                    <Headphones size={20} />
                  </div>
                  <div>
                    <h3>المقدمة الصوتية العامة 🎙️</h3>
                    <p>استمع إلى تلاوة ومقدمة مباركة لقصص الأنبياء وسيرة الرسول ﷺ</p>
                  </div>
                </div>
              </div>

              {isLoadingGlobalAudio ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--gold)', padding: '16px', fontSize: '0.85rem' }}>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>جارٍ تجهيز المقطع الصوتي...</span>
                </div>
              ) : (
                resolvedGlobalAudioUrl && (
                  <CustomAudioPlayer
                    src={resolvedGlobalAudioUrl}
                    title="المقدمة والتلاوة الصوتية العامة"
                    sizeBytes={globalAudio.compressedSize}
                    downloadFilename={globalAudio.originalFileName || 'المقدمة_الصوتية_العامة.mp3'}
                  />
                )
              )}
            </div>
          )}

          {/* Primary Action Buttons (CTAs) */}
          <div className="landing-cta-row">
            <Link href="/read/" className="btn-landing-primary">
              <BookOpen size={20} />
              <span>ابدأ القراءة والتدبر</span>
              <ArrowLeft size={18} />
            </Link>

            <Link href="/read/?audio=1" className="btn-landing-secondary">
              <Headphones size={20} />
              <span>الاستماع الصوتي المباشر</span>
            </Link>

            <button
              type="button"
              className="btn-landing-tertiary"
              onClick={triggerPwaInstall}
              title="تثبيت التطبيق على الجوال أو الكمبيوتر كبرنامج مستقل"
            >
              <Smartphone size={18} />
              <span>تثبيت البرنامج 📲</span>
            </button>
          </div>

          {/* 4 Feature Cards (Compact & Elegant Grid) */}
          <div className="landing-features-grid">
            <div className="landing-feature-item">
              <div className="feature-icon-wrap">
                <Layers size={22} />
              </div>
              <div className="feature-content">
                <h3>سلاسل وحلقات موثقة</h3>
                <p>سرد تاريخي ميسر مدعوم بالمراجع والمصادر الإسلامية المعتمدة.</p>
              </div>
            </div>

            <div className="landing-feature-item">
              <div className="feature-icon-wrap">
                <Headphones size={22} />
              </div>
              <div className="feature-content">
                <h3>تسجيلات صوتية نقية</h3>
                <p>استماع هادئ للأحداث والقصص بجودة صوتية عالية تلائم تنقلك.</p>
              </div>
            </div>

            <div className="landing-feature-item">
              <div className="feature-icon-wrap">
                <Sparkles size={22} />
              </div>
              <div className="feature-content">
                <h3>عِبر وفوائد إيمانية</h3>
                <p>هدايات ودروس تربوية مستنبطة لتزكية النفس وتطبيقها في واقعك.</p>
              </div>
            </div>

            <div className="landing-feature-item">
              <div className="feature-icon-wrap">
                <Smartphone size={22} />
              </div>
              <div className="feature-content">
                <h3>تطبيق يعمل بدون نت</h3>
                <p>تثبيت المنصة كبرنامج على جوالك أو حاسوبك ومتابعة القراءة دون اتصال.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Reverent & Subtle Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-dedication">
          <span>صَدَقَةٌ جَارِيَةٌ عَنْ مُحَمَّد هَاشِم ضَيْف اللَّه • وَعَنْ وَالِدَيْهِ رَحِمَهُمَا اللَّهُ</span>
        </div>
        <div className="landing-footer-credit">
          <span>تم تطوير الموقع بواسطة</span>
          <a
            href="https://mostafayasser.online"
            target="_blank"
            rel="noopener noreferrer"
            className="developer-credit-link"
          >
            مصطفى ياسر
          </a>
        </div>
      </footer>

      {/* PWA Install Prompt Banner and Modal */}
      <PwaInstallPrompt />
    </div>
  );
}

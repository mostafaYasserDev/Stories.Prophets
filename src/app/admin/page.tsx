'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  LogOut,
  ArrowRight,
  Plus,
  Edit3,
  Trash2,
  Volume2,
  Headphones,
  FileText,
  Search,
  Check,
  X,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Key,
  Play,
  Pause,
  UploadCloud,
  FileAudio,
  Sparkles,
  Link2,
  Pin,
  FolderPlus,
  Layers,
  Settings as SettingsIcon,
  HelpCircle,
  AlertTriangle,
  AlertCircle,
  GitMerge,
  Sliders,
  BookmarkCheck,
  CheckCircle2,
  Mic,
  Compass,
  Languages,
} from 'lucide-react';

import { Episode, Series, GlobalAudio, SiteSettings, ThemeType } from '@/types';
import { db, initAnalytics } from '@/lib/firebase';
import { INITIAL_SEED_EPISODES } from '@/lib/seedData';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';

import { Toast, ToastMessage } from '@/components/Toast';
import {
  saveAudioToEpisode,
  removeAudioFromEpisode,
  resolveAudioUrl,
  saveGlobalAudio,
  removeGlobalAudio,
  resolveGlobalAudioUrl,
} from '@/lib/audioStorage';
import { compressAudio, formatBytes, CompressionResult } from '@/lib/audioCompressor';
import { normalizeArabicText, formatFriendlyError } from '@/lib/errorHandler';
import {
  generateGeminiEpisodeAudio,
  cleanHtmlForSpeech,
  GenerationProgress,
  DEFAULT_GEMINI_KEY,
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_NAME,
  getDailyAudioUsage,
  DailyUsageStatus,
  FREE_TIER_DAILY_LIMIT,
} from '@/lib/geminiAudio';

export default function AdminPage() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Active Admin Tab
  const [adminTab, setAdminTab] = useState<'episodes' | 'series' | 'settings'>('episodes');

  // Data State
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [globalAudio, setGlobalAudio] = useState<GlobalAudio | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    siteTitle: 'السيرة النبوية الشريفة',
    siteSubtitle: 'رحلة تفاعلية مباركة في سيرة خير الأنام ﷺ',
    dedicationBadge: 'صَدَقَةٌ جَارِيَةٌ عَنّي',
    dedicationName: 'محمد هاشم ضيف الله',
    dedicationParents: 'وعن أبي وأمي رحمهم الله',
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState<string>('all');
  const [filterOnlyAudio, setFilterOnlyAudio] = useState<boolean>(false);
  const [filterOnlyPinned, setFilterOnlyPinned] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals State
  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState<boolean>(false);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);

  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState<boolean>(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);

  // Category Merging State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [mergeSourceSeriesId, setMergeSourceSeriesId] = useState<string>('');
  const [mergeTargetSeriesId, setMergeTargetSeriesId] = useState<string>('');
  const [isMerging, setIsMerging] = useState<boolean>(false);

  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);
  const [audioTargetEpisode, setAudioTargetEpisode] = useState<Episode | null>(null);

  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');

  // Custom Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Episode Form State & Validation
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formEra, setFormEra] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSubtitle, setFormSubtitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formIsPinned, setFormIsPinned] = useState<boolean>(false);
  const [isSavingEpisode, setIsSavingEpisode] = useState<boolean>(false);
  const [episodeFormErrors, setEpisodeFormErrors] = useState<{
    title?: string;
    era?: string;
    content?: string;
  }>({});

  // Series Form State
  const [seriesTitleInput, setSeriesTitleInput] = useState<string>('');
  const [seriesDescInput, setSeriesDescInput] = useState<string>('');
  const [seriesOrderInput, setSeriesOrderInput] = useState<number>(1);
  const [seriesPinnedInput, setSeriesPinnedInput] = useState<boolean>(false);
  const [isSavingSeries, setIsSavingSeries] = useState<boolean>(false);

  // Quick Series Add Inline
  const [isQuickSeriesOpen, setIsQuickSeriesOpen] = useState<boolean>(false);
  const [quickSeriesTitle, setQuickSeriesTitle] = useState<string>('');

  // Audio Compression & AI Generation State
  const [audioUploadTab, setAudioUploadTab] = useState<'ai' | 'upload' | 'url'>('ai');
  const [customAudioInstructions, setCustomAudioInstructions] = useState<string>('');
  const [dailyQuotaStatus, setDailyQuotaStatus] = useState<DailyUsageStatus>({
    dateStr: '',
    count: 0,
    maxLimit: FREE_TIER_DAILY_LIMIT,
    remaining: FREE_TIER_DAILY_LIMIT,
  });
  const [simulatedProgress, setSimulatedProgress] = useState<number>(0);
  const [simulatedPhrase, setSimulatedPhrase] = useState<string>('');
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState<string>(DEFAULT_GEMINI_KEY);
  const [showApiKeySettings, setShowApiKeySettings] = useState<boolean>(false);
  const [isGeneratingAiAudio, setIsGeneratingAiAudio] = useState<boolean>(false);
  const [aiGenerationProgress, setAiGenerationProgress] = useState<GenerationProgress | null>(null);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<{
    base64DataUrl: string;
    durationSeconds: number;
    sizeBytes: number;
  } | null>(null);

  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressionProgress, setCompressionProgress] = useState<number>(0);
  const [compressionMessage, setCompressionMessage] = useState<string>('');
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [audioUrlInput, setAudioUrlInput] = useState<string>('');
  const [isSavingAudio, setIsSavingAudio] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<SiteSettings>(siteSettings);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [globalAudioInput, setGlobalAudioInput] = useState<string>('');
  const [isSavingGlobalAudio, setIsSavingGlobalAudio] = useState<boolean>(false);

  // Global Audio Upload & Compression State
  const [globalAudioUploadTab, setGlobalAudioUploadTab] = useState<'upload' | 'url'>('upload');
  const [isCompressingGlobalAudio, setIsCompressingGlobalAudio] = useState<boolean>(false);
  const [globalCompressionProgress, setGlobalCompressionProgress] = useState<number>(0);
  const [globalCompressionMessage, setGlobalCompressionMessage] = useState<string>('');
  const [globalCompressionResult, setGlobalCompressionResult] = useState<CompressionResult | null>(null);
  const [globalAudioOriginalName, setGlobalAudioOriginalName] = useState<string>('');
  const [resolvedAdminGlobalAudioUrl, setResolvedAdminGlobalAudioUrl] = useState<string | null>(null);
  const [isLoadingAdminGlobalAudio, setIsLoadingAdminGlobalAudio] = useState<boolean>(false);
  const globalFileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Preview State
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Trigger Toast (Rich notifications with title, warning, and dismissibility)
  const triggerToast = (
    text: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    title?: string,
    durationMs?: number
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, text, type, title }]);
    const timeout =
      durationMs || (type === 'error' ? 7000 : type === 'warning' ? 5000 : 3500);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, timeout);
  };

  const handleCloseToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Auth Initialization
  useEffect(() => {
    initAnalytics();
    const savedAuth = sessionStorage.getItem('seerah_admin_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Theme Sync
  useEffect(() => {
    const savedTheme = (localStorage.getItem('seerah_theme') as ThemeType) || 'midnight';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Handle PIN Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = localStorage.getItem('seerah_admin_pin') || '1234';
    if (pinInput.trim() === storedPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem('seerah_admin_authenticated', 'true');
      setPinError('');
      triggerToast('مرحباً بك في لوحة تحكم السيرة النبوية الشريفة! 🌟', 'success');
    } else {
      setPinError('رمز المرور غير صحيح. حاول مجدداً.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('seerah_admin_authenticated');
    setPinInput('');
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      triggerToast('يجب أن يتكون رمز المرور من 4 أرقام أو رموز على الأقل لضمان الأمان', 'error', 'رمز مرور ضعيف');
      return;
    }
    if (newPin !== confirmPin) {
      triggerToast('تأكيد رمز المرور غير متطابق مع الرمز الجديد، يرجى كتابتهما بدقة', 'error', 'عدم تطابق الرمز');
      return;
    }
    localStorage.setItem('seerah_admin_pin', newPin);
    setIsPinModalOpen(false);
    setNewPin('');
    setConfirmPin('');
    triggerToast('تم تحديث رمز المرور بنجاح! 🔒', 'success', 'تغيير الرمز');
  };

  // 1. Fetch Episodes Realtime
  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, 'episodes'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          docId: d.id,
          ...d.data(),
        })) as Episode[];
        items.sort((a, b) => (a.order || 0) - (b.order || 0));
        setEpisodes(items);
        setLoading(false);
      },
      (err) => {
        console.error('Admin episodes error:', err);
        const friendly = formatFriendlyError(err, 'تعذّر جلب قائمة الحلقات من السحابة');
        triggerToast(friendly.message, 'error', friendly.title);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated]);

  // 2. Fetch Series Realtime & Auto-populate from episodes if empty
  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, 'series'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty && episodes.length > 0) {
          // Extract unique normalized eras from existing episodes to prevent duplicates
          const distinctMap = new Map<string, string>();
          episodes.forEach((e) => {
            if (e.era && e.era.trim()) {
              const norm = normalizeArabicText(e.era);
              if (!distinctMap.has(norm)) {
                distinctMap.set(norm, e.era.trim());
              }
            }
          });
          const distinct = Array.from(distinctMap.values());
          const batch = writeBatch(db);
          distinct.forEach((eraName, idx) => {
            const docRef = doc(collection(db, 'series'));
            batch.set(docRef, {
              title: eraName,
              description: `سلسلة حلقات ${eraName}`,
              order: idx + 1,
              isPinned: false,
              createdAt: serverTimestamp(),
            });
          });
          try {
            await batch.commit();
          } catch (e) {
            console.error('Error auto-seeding series:', e);
          }
          return;
        }

        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Series[];
        items.sort((a, b) => (a.order || 0) - (b.order || 0));
        setSeriesList(items);
      },
      (err) => {
        console.error('Admin series error:', err);
        const friendly = formatFriendlyError(err, 'تعذّر جلب السلاسل والتصنيفات من السحابة');
        triggerToast(friendly.message, 'error', friendly.title);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated, episodes.length]);

  // 3. Fetch Settings & Global Audio
  useEffect(() => {
    if (!isAuthenticated) return;
    const docRef = doc(db, 'settings', 'site_info');
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SiteSettings;
        setSiteSettings(data);
        setSettingsForm(data);
      }
    });

    const audioDocRef = doc(db, 'settings', 'global_audio');
    const unsubAudio = onSnapshot(audioDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GlobalAudio;
        setGlobalAudio(data);
        setGlobalAudioInput(data.audioUrl || '');
      } else {
        setGlobalAudio(null);
        setGlobalAudioInput('');
      }
    });

    return () => {
      unsub();
      unsubAudio();
    };
  }, [isAuthenticated]);

  // Real-time resolution for Global Audio preview in admin
  useEffect(() => {
    let isMounted = true;
    if (!globalAudio || !globalAudio.audioUrl) {
      setResolvedAdminGlobalAudioUrl(null);
      return;
    }

    if (globalAudio.audioUrl !== '__CHUNKS__') {
      setResolvedAdminGlobalAudioUrl(globalAudio.audioUrl);
      return;
    }

    setIsLoadingAdminGlobalAudio(true);
    resolveGlobalAudioUrl(globalAudio)
      .then((url) => {
        if (isMounted) {
          setResolvedAdminGlobalAudioUrl(url);
          setIsLoadingAdminGlobalAudio(false);
        }
      })
      .catch((err) => {
        console.error('Admin resolve global audio error:', err);
        if (isMounted) setIsLoadingAdminGlobalAudio(false);
      });

    return () => {
      isMounted = false;
    };
  }, [globalAudio]);

  // Filtered Episodes
  const filteredEpisodes = useMemo(() => {
    return episodes.filter((ep) => {
      const matchSeries = selectedSeriesFilter === 'all' || ep.era === selectedSeriesFilter;
      const matchAudio = !filterOnlyAudio || !!ep.audioUrl;
      const matchPinned = !filterOnlyPinned || !!ep.isPinned;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        ep.title.toLowerCase().includes(q) ||
        (ep.subtitle && ep.subtitle.toLowerCase().includes(q)) ||
        ep.era.toLowerCase().includes(q) ||
        ep.html.toLowerCase().includes(q);

      return matchSeries && matchAudio && matchPinned && matchQuery;
    });
  }, [episodes, selectedSeriesFilter, filterOnlyAudio, filterOnlyPinned, searchQuery]);

  // Series Episode Counts
  const seriesCounts = useMemo(() => {
    const map = new Map<string, number>();
    episodes.forEach((ep) => {
      map.set(ep.era, (map.get(ep.era) || 0) + 1);
    });
    return map;
  }, [episodes]);

  // Stats
  const stats = useMemo(() => {
    const total = episodes.length;
    const withAudio = episodes.filter((ep) => !!ep.audioUrl).length;
    const pinnedCount = episodes.filter((ep) => !!ep.isPinned).length;
    let totalWords = 0;
    episodes.forEach((ep) => {
      const text = ep.html.replace(/<[^>]+>/g, '').trim();
      totalWords += text ? text.split(/\s+/).length : 0;
    });
    return { total, withAudio, pinnedCount, totalWords, totalSeries: seriesList.length };
  }, [episodes, seriesList]);

  // Find duplicate groups in seriesList based on normalized Arabic text
  const duplicateSeriesGroups = useMemo(() => {
    const groups: { [norm: string]: Series[] } = {};
    seriesList.forEach((s) => {
      const key = normalizeArabicText(s.title);
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return Object.values(groups).filter((g) => g.length > 1);
  }, [seriesList]);

  // Duplicate warning for series form while typing
  const duplicateSeriesWarning = useMemo(() => {
    const norm = normalizeArabicText(seriesTitleInput);
    if (!norm) return null;
    return seriesList.find((s) => {
      if (editingSeries && s.id === editingSeries.id) return false;
      return normalizeArabicText(s.title) === norm;
    });
  }, [seriesTitleInput, seriesList, editingSeries]);

  // ==================== MERGE ENGINE ====================
  // 1. Auto-Merge all detected duplicate series groups
  const handleMergeAllDuplicates = async () => {
    if (duplicateSeriesGroups.length === 0) return;
    setIsSavingSeries(true);
    let mergedCount = 0;
    let episodesUpdated = 0;

    try {
      for (const group of duplicateSeriesGroups) {
        // Pick canonical: the one with the highest episode count or earliest order
        const sorted = [...group].sort((a, b) => {
          const countA = seriesCounts.get(a.title) || 0;
          const countB = seriesCounts.get(b.title) || 0;
          if (countB !== countA) return countB - countA;
          return (a.order || 0) - (b.order || 0);
        });

        const canonical = sorted[0];
        const duplicates = sorted.slice(1);

        const batch = writeBatch(db);

        for (const dup of duplicates) {
          const matchedEps = episodes.filter(
            (ep) =>
              ep.seriesId === dup.id ||
              normalizeArabicText(ep.era) === normalizeArabicText(dup.title)
          );
          for (const ep of matchedEps) {
            batch.update(doc(db, 'episodes', ep.docId), {
              era: canonical.title,
              seriesId: canonical.id,
            });
            episodesUpdated++;
          }
          batch.delete(doc(db, 'series', dup.id));
          mergedCount++;
        }

        await batch.commit();
      }

      triggerToast(
        `تم بنجاح دمج (${mergedCount}) تصنيفات مكررة وتحديث (${episodesUpdated}) حلقة ونقلها للتصنيف الأساسي! ✨`,
        'success',
        'تم دمج التصنيفات بنجاح'
      );
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'تعذّر إتمام دمج التصنيفات المكررة');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingSeries(false);
    }
  };

  // 2. Manual Merge of Two Categories
  const handleExecuteMergeSeries = async () => {
    if (!mergeSourceSeriesId || !mergeTargetSeriesId || mergeSourceSeriesId === mergeTargetSeriesId) {
      triggerToast('يرجى اختيار تصنيفين مختلفين لإتمام عملية الدمج', 'error', 'اختيار غير صالح');
      return;
    }

    const source = seriesList.find((s) => s.id === mergeSourceSeriesId);
    const target = seriesList.find((s) => s.id === mergeTargetSeriesId);
    if (!source || !target) {
      triggerToast('أحد التصنيفين غير متوفر في النظام', 'error', 'خطأ في البيانات');
      return;
    }

    setIsMerging(true);
    try {
      const matchedEpisodes = episodes.filter(
        (ep) =>
          ep.seriesId === source.id ||
          normalizeArabicText(ep.era) === normalizeArabicText(source.title)
      );

      const batch = writeBatch(db);
      matchedEpisodes.forEach((ep) => {
        batch.update(doc(db, 'episodes', ep.docId), {
          era: target.title,
          seriesId: target.id,
        });
      });

      batch.delete(doc(db, 'series', source.id));
      await batch.commit();

      triggerToast(
        `تم بنجاح نقل (${matchedEpisodes.length}) حلقة من «${source.title}» إلى «${target.title}» وحذف التصنيف المدمج! ✨`,
        'success',
        'اكتمل الدمج بنجاح'
      );
      setIsMergeModalOpen(false);
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'تعذّر إتمام دمج التصنيفين');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsMerging(false);
    }
  };

  // ==================== EPISODE ACTIONS ====================
  const handleOpenAddEpisode = () => {
    setEditingEpisode(null);
    setEpisodeFormErrors({});
    setFormOrder(episodes.length + 1);
    const defaultEra =
      selectedSeriesFilter !== 'all'
        ? selectedSeriesFilter
        : seriesList.length > 0
        ? seriesList[0].title
        : 'الجزيرة العربية في العصر الجاهلي';
    setFormEra(defaultEra);
    setFormTitle('');
    setFormSubtitle(`الحلقة ${String(episodes.length + 1).padStart(3, '0')}`);
    setFormContent('');
    setFormIsPinned(false);
    setIsEpisodeModalOpen(true);
  };

  const handleOpenEditEpisode = (ep: Episode) => {
    setEditingEpisode(ep);
    setEpisodeFormErrors({});
    setFormOrder(ep.order || 1);
    setFormEra(ep.era || (seriesList[0]?.title ?? ''));
    setFormTitle(ep.title || '');
    setFormSubtitle(ep.subtitle || '');
    const plain = (ep.html || '').replace(/<p>/gi, '').replace(/<\/p>/gi, '\n\n').trim();
    setFormContent(plain);
    setFormIsPinned(!!ep.isPinned);
    setIsEpisodeModalOpen(true);
  };

  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { title?: string; era?: string; content?: string } = {};
    if (!formTitle.trim()) errors.title = 'يرجى إدخال عنوان الحلقة';
    if (!formEra.trim()) errors.era = 'يرجى اختيار تصنيف أو سلسلة للحلقة';
    if (!formContent.trim()) errors.content = 'يرجى كتابة نص أو محتوى الحلقة';

    if (Object.keys(errors).length > 0) {
      setEpisodeFormErrors(errors);
      const firstErr = Object.values(errors)[0];
      triggerToast(firstErr, 'error', 'بيانات ناقصة');
      return;
    }
    setEpisodeFormErrors({});

    setIsSavingEpisode(true);
    const formattedHtml = formContent
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
      .join('\n');

    // Find matching series id if exists
    const matchingSeries = seriesList.find(
      (s) => normalizeArabicText(s.title) === normalizeArabicText(formEra.trim())
    );

    try {
      if (editingEpisode) {
        await updateDoc(doc(db, 'episodes', editingEpisode.docId), {
          order: Number(formOrder),
          era: formEra.trim(),
          seriesId: matchingSeries?.id || null,
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          html: formattedHtml,
          isPinned: formIsPinned,
          updatedAt: serverTimestamp(),
        });
        triggerToast('تم تحديث بيانات الحلقة بنجاح! ✓', 'success', 'تم التحديث');
      } else {
        await addDoc(collection(db, 'episodes'), {
          order: Number(formOrder),
          era: formEra.trim(),
          seriesId: matchingSeries?.id || null,
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          html: formattedHtml,
          audioUrl: null,
          isPinned: formIsPinned,
          createdAt: serverTimestamp(),
        });
        triggerToast('تمت إضافة الحلقة الجديدة بنجاح! 🌟', 'success', 'إضافة حلقة');
      }
      setIsEpisodeModalOpen(false);
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'فشل حفظ الحلقة في السحابة');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingEpisode(false);
    }
  };

  // Quick Inline Series Creator inside Episode Modal (with duplicate prevention)
  const handleQuickAddSeries = async () => {
    const title = quickSeriesTitle.trim();
    if (!title) {
      triggerToast('يرجى كتابة اسم التصنيف أولاً', 'warning', 'حقل فارغ');
      return;
    }

    const normalized = normalizeArabicText(title);
    const existing = seriesList.find((s) => normalizeArabicText(s.title) === normalized);

    if (existing) {
      setFormEra(existing.title);
      setQuickSeriesTitle('');
      setIsQuickSeriesOpen(false);
      triggerToast(
        `تم اختيار التصنيف الموجود مسبقاً: «${existing.title}» تلقائياً لتفادي التكرار ✓`,
        'info',
        'تم تحديد التصنيف'
      );
      return;
    }

    try {
      await addDoc(collection(db, 'series'), {
        title,
        description: `سلسلة ${title}`,
        order: seriesList.length + 1,
        isPinned: false,
        createdAt: serverTimestamp(),
      });
      setFormEra(title);
      setQuickSeriesTitle('');
      setIsQuickSeriesOpen(false);
      triggerToast(`تمت إضافة سلسلة «${title}» واختيارها بنجاح!`, 'success', 'إضافة سلسلة');
    } catch (e: any) {
      const friendly = formatFriendlyError(e, 'تعذّر إضافة السلسلة الجديدة');
      triggerToast(friendly.message, 'error', friendly.title);
    }
  };

  // Toggle Episode Pinning
  const handleTogglePinEpisode = async (ep: Episode) => {
    try {
      const nextPinned = !ep.isPinned;
      await updateDoc(doc(db, 'episodes', ep.docId), {
        isPinned: nextPinned,
        updatedAt: serverTimestamp(),
      });
      triggerToast(
        nextPinned ? 'تم تثبيت الحلقة في الصدارة 📌' : 'تم إلغاء تثبيت الحلقة',
        'info',
        'تثبيت الحلقة'
      );
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'تعذّر تحديث حالة تثبيت الحلقة');
      triggerToast(friendly.message, 'error', friendly.title);
    }
  };

  // Delete Episode (with Custom Dialog)
  const handleDeleteEpisodePrompt = (ep: Episode) => {
    setConfirmDialog({
      isOpen: true,
      title: 'تأكيد حذف الحلقة',
      message: `هل أنت متأكد من رغبتك في حذف حلقة: «${ep.title}» نهائياً من السحابة؟ سيتم حذف نصوصها وأي تسجيلات صوتية مرتبطة بها.`,
      onConfirm: async () => {
        try {
          await removeAudioFromEpisode(ep.docId);
          await deleteDoc(doc(db, 'episodes', ep.docId));
          triggerToast('تم حذف الحلقة من السحابة بنجاح', 'info', 'حذف الحلقة');
        } catch (err: any) {
          const friendly = formatFriendlyError(err, 'تعذّر حذف الحلقة من السحابة');
          triggerToast(friendly.message, 'error', friendly.title);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Reorder Episode
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= episodes.length) return;

    const currentEp = episodes[index];
    const targetEp = episodes[targetIndex];

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'episodes', currentEp.docId), { order: targetEp.order });
      batch.update(doc(db, 'episodes', targetEp.docId), { order: currentEp.order });
      await batch.commit();
      triggerToast('تم تحديث ترتيب الحلقات', 'success', 'الترتيب');
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'تعذّر تحديث ترتيب الحلقات');
      triggerToast(friendly.message, 'error', friendly.title);
    }
  };

  // ==================== SERIES ACTIONS ====================
  const handleOpenAddSeries = () => {
    setEditingSeries(null);
    setSeriesTitleInput('');
    setSeriesDescInput('');
    setSeriesOrderInput(seriesList.length + 1);
    setSeriesPinnedInput(false);
    setIsSeriesModalOpen(true);
  };

  const handleOpenEditSeries = (s: Series) => {
    setEditingSeries(s);
    setSeriesTitleInput(s.title);
    setSeriesDescInput(s.description || '');
    setSeriesOrderInput(s.order || 1);
    setSeriesPinnedInput(!!s.isPinned);
    setIsSeriesModalOpen(true);
  };

  const handleSaveSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = seriesTitleInput.trim();
    if (!title) {
      triggerToast('يرجى إدخال اسم السلسلة أو التصنيف', 'error', 'حقل مطلوب');
      return;
    }

    // Strict duplicate check
    const normTitle = normalizeArabicText(title);
    const existingDup = seriesList.find((s) => {
      if (editingSeries && s.id === editingSeries.id) return false;
      return normalizeArabicText(s.title) === normTitle;
    });

    if (existingDup) {
      triggerToast(
        `يوجد تصنيف مسجل بالفعل بهذا الاسم: «${existingDup.title}». لا يمكن إنشاء تصنيفين بنفس الاسم لمنع التضارب. يمكنك دمج السلسلتين إذا رغبت.`,
        'error',
        'اسم التصنيف مكرر'
      );
      return;
    }

    setIsSavingSeries(true);
    const description = seriesDescInput.trim();
    const order = Number(seriesOrderInput);
    const isPinned = seriesPinnedInput;

    try {
      if (editingSeries) {
        // If title changed, update existing episodes with old title
        const oldTitle = editingSeries.title;
        await updateDoc(doc(db, 'series', editingSeries.id), {
          title,
          description,
          order,
          isPinned,
          updatedAt: serverTimestamp(),
        });

        if (oldTitle !== title) {
          const epBatch = writeBatch(db);
          episodes
            .filter((ep) => ep.era === oldTitle || ep.seriesId === editingSeries.id)
            .forEach((ep) => {
              epBatch.update(doc(db, 'episodes', ep.docId), {
                era: title,
                seriesId: editingSeries.id,
              });
            });
          await epBatch.commit();
        }

        triggerToast('تم تحديث بيانات السلسلة بنجاح! ✓', 'success', 'تحديث السلسلة');
      } else {
        await addDoc(collection(db, 'series'), {
          title,
          description,
          order,
          isPinned,
          createdAt: serverTimestamp(),
        });
        triggerToast('تمت إضافة السلسلة الجديدة بنجاح! 📚', 'success', 'إضافة سلسلة');
      }
      setIsSeriesModalOpen(false);
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'تعذّر حفظ بيانات السلسلة');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingSeries(false);
    }
  };

  const handleTogglePinSeries = async (s: Series) => {
    try {
      const next = !s.isPinned;
      await updateDoc(doc(db, 'series', s.id), {
        isPinned: next,
        updatedAt: serverTimestamp(),
      });
      triggerToast(
        next ? 'تم تثبيت السلسلة في الصدارة 📌' : 'تم إلغاء تثبيت السلسلة',
        'info',
        'تثبيت السلسلة'
      );
    } catch (e: any) {
      const friendly = formatFriendlyError(e, 'تعذّر تحديث تثبيت السلسلة');
      triggerToast(friendly.message, 'error', friendly.title);
    }
  };

  const handleDeleteSeriesPrompt = (s: Series) => {
    const count = seriesCounts.get(s.title) || 0;
    setConfirmDialog({
      isOpen: true,
      title: 'تأكيد حذف السلسلة',
      message:
        count > 0
          ? `تنبيه: هذه السلسلة تحتوي على (${count}) حلقة. حذف السلسلة لن يحذف الحلقات ولكن ستحتاج لإعادة تصنيفها أو دمجها مع تصنيف آخر. هل تريد المتابعة؟`
          : `هل تريد بالتأكيد حذف سلسلة: «${s.title}»؟`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'series', s.id));
          triggerToast('تم حذف السلسلة بنجاح', 'info', 'حذف السلسلة');
        } catch (e: any) {
          const friendly = formatFriendlyError(e, 'تعذّر حذف السلسلة');
          triggerToast(friendly.message, 'error', friendly.title);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Reorder Series
  const handleMoveSeriesOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= seriesList.length) return;

    const currentS = seriesList[index];
    const targetS = seriesList[targetIndex];

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'series', currentS.id), { order: targetS.order });
      batch.update(doc(db, 'series', targetS.id), { order: currentS.order });
      await batch.commit();
      triggerToast('تم تحديث ترتيب السلاسل', 'success', 'الترتيب');
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'تعذّر تحديث ترتيب السلسلة');
      triggerToast(friendly.message, 'error', friendly.title);
    }
  };

  // ==================== AUDIO COMPRESSION & BASE64 UPLOAD ====================
  const handleOpenAudioModal = (ep: Episode) => {
    setAudioTargetEpisode(ep);
    setAudioUrlInput(
      ep.audioUrl && ep.audioUrl !== '__CHUNKS__' && !ep.audioUrl.startsWith('data:')
        ? ep.audioUrl
        : ''
    );
    setCompressionResult(null);
    setIsCompressing(false);
    setCompressionProgress(0);
    setCompressionMessage('');
    setAiGeneratedResult(null);
    setAiGenerationProgress(null);
    setIsGeneratingAiAudio(false);
    setCustomAudioInstructions('');
    setSimulatedProgress(0);
    setSimulatedPhrase('');
    setDailyQuotaStatus(getDailyAudioUsage());

    setAudioUploadTab('ai');
    setIsAudioModalOpen(true);
  };

  // Gemini AI Audio Generation Handler
  const handleGenerateAiAudio = async () => {
    if (!audioTargetEpisode) return;
    setIsGeneratingAiAudio(true);
    setAiGenerationProgress(null);
    setAiGeneratedResult(null);
    setSimulatedProgress(6);
    setSimulatedPhrase('🎙️ استدعاء الراوي وضبط النبرة الإيمانية...');

    const phrases = [
      '🎙️ استدعاء الراوي وضبط النبرة الإيمانية...',
      '📖 قراءة فصيحة متقنة مع مراعاة سياق المعاني...',
      '✨ ترتيل الآيات الكريمة والأحاديث بالفصحى والخشوع...',
      '🎵 مواءمة الوقفات التعبيرية وتلوين نبرة السرد القصصي...',
      '🎼 هندسة الصوت الاستوديو وتجميع التردد النقي (24kHz)...',
      '⚡ اللمسات الأخيرة وتجهيز الملف الصوتي النهائي...',
    ];
    let phraseIdx = 0;
    let currentPct = 6;

    const progressTimer = setInterval(() => {
      currentPct = Math.min(93, currentPct + Math.max(1, Math.floor((93 - currentPct) * 0.08)));
      setSimulatedProgress(currentPct);
    }, 450);

    const phraseTimer = setInterval(() => {
      phraseIdx = (phraseIdx + 1) % phrases.length;
      setSimulatedPhrase(phrases[phraseIdx]);
    }, 3200);

    try {
      const result = await generateGeminiEpisodeAudio({
        text: audioTargetEpisode.html,
        customInstructions: customAudioInstructions,
        voiceName: DEFAULT_VOICE_ID,
        apiKey: geminiApiKeyInput || DEFAULT_GEMINI_KEY,
        onProgress: (p) => {
          setAiGenerationProgress(p);
          if (p.percent) {
            setSimulatedProgress((prev) => Math.max(prev, p.percent));
          }
        },
      });

      clearInterval(progressTimer);
      clearInterval(phraseTimer);
      setSimulatedProgress(100);
      setSimulatedPhrase('✓ تم اكتمال هندسة التسجيل الصوتي بنجاح!');

      setAiGeneratedResult(result);
      setDailyQuotaStatus(getDailyAudioUsage());

      triggerToast(
        `تم توليد الصوت الاستوديو بنجاح! المدة: ${Math.round(result.durationSeconds)} ثانية (${formatBytes(result.sizeBytes)})`,
        'success',
        'تم التوليد بنجاح'
      );
    } catch (err: any) {
      clearInterval(progressTimer);
      clearInterval(phraseTimer);
      console.error('Gemini audio generation failed:', err);
      const friendly = formatFriendlyError(err, 'تعذّر توليد الصوت بنموذج Gemini');
      triggerToast(friendly.message, 'error', friendly.title);
      setDailyQuotaStatus(getDailyAudioUsage());
    } finally {
      setIsGeneratingAiAudio(false);
    }
  };

  const handleSaveAiAudio = async () => {
    if (!audioTargetEpisode || !aiGeneratedResult) return;
    setIsSavingAudio(true);
    try {
      await saveAudioToEpisode(audioTargetEpisode.docId, aiGeneratedResult.base64DataUrl);

      // Update local state
      setEpisodes((prev) =>
        prev.map((ep) =>
          ep.docId === audioTargetEpisode.docId
            ? { ...ep, audioUrl: aiGeneratedResult.base64DataUrl, audioType: 'direct' }
            : ep
        )
      );

      triggerToast('تم حفظ التسجيل الصوتي الاستوديو للحلقة بنجاح! 🎵', 'success', 'تم حفظ الصوت');
      setIsAudioModalOpen(false);
    } catch (err: any) {
      console.error('Save AI audio failed:', err);
      const friendly = formatFriendlyError(err, 'فشل حفظ الصوت في السحابة');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingAudio(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (
      !file.type.startsWith('audio/') &&
      !file.name.match(/\.(mp3|m4a|wav|ogg|aac|webm|flac)$/i)
    ) {
      triggerToast(
        'يرجى اختيار ملف صوتي صالح بصيغة (MP3, WAV, M4A, OGG)',
        'error',
        'صيغة غير مدعومة'
      );
      return;
    }

    setIsCompressing(true);
    setCompressionProgress(10);
    setCompressionMessage('بدء معالجة الملف الصوتي...');
    setCompressionResult(null);

    try {
      const result = await compressAudio(file, 32, (percent, msg) => {
        setCompressionProgress(percent);
        setCompressionMessage(msg);
      });
      setCompressionResult(result);
      triggerToast(
        `تم ضغط الصوت بنجاح! الحجم تقلص بنسبة ${result.compressionRatio}% (${formatBytes(result.originalSize)} ⬅ ${formatBytes(result.compressedSize)})`,
        'success',
        'تم الضغط بنجاح'
      );
    } catch (err: any) {
      console.error('Audio compression failed:', err);
      const friendly = formatFriendlyError(err, 'تعذّر ضغط ومعالجة الملف الصوتي');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSaveCompressedAudio = async () => {
    if (!audioTargetEpisode || !compressionResult) return;
    setIsSavingAudio(true);
    try {
      await saveAudioToEpisode(audioTargetEpisode.docId, compressionResult.base64DataUrl);
      triggerToast('تم حفظ التسجيل الصوتي المضغوط في السحابة بنجاح! 🎵', 'success', 'تم حفظ الصوت');
      setIsAudioModalOpen(false);
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'فشل حفظ المقطع الصوتي في السحابة');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingAudio(false);
    }
  };

  const handleSaveUrlAudio = async () => {
    if (!audioTargetEpisode) return;
    const url = audioUrlInput.trim();
    if (!url) {
      triggerToast('يرجى إدخال الرابط الصوتي أولاً', 'warning', 'حقل فارغ');
      return;
    }
    setIsSavingAudio(true);
    try {
      await saveAudioToEpisode(audioTargetEpisode.docId, url);
      triggerToast('تم حفظ الرابط الصوتي بنجاح! 🎵', 'success', 'تم الحفظ');
      setIsAudioModalOpen(false);
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'تعذّر حفظ الرابط الصوتي');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingAudio(false);
    }
  };

  const handleRemoveAudioPrompt = () => {
    if (!audioTargetEpisode) return;
    setConfirmDialog({
      isOpen: true,
      title: 'تأكيد إزالة الصوت',
      message: `هل تريد بالتأكيد إزالة المقطع الصوتي لحلقة: «${audioTargetEpisode.title}»؟`,
      onConfirm: async () => {
        try {
          await removeAudioFromEpisode(audioTargetEpisode.docId);
          triggerToast('تمت إزالة المقطع الصوتي للحلقة', 'info', 'إزالة الصوت');
          setIsAudioModalOpen(false);
        } catch (err: any) {
          const friendly = formatFriendlyError(err, 'تعذّر إزالة المقطع الصوتي');
          triggerToast(friendly.message, 'error', friendly.title);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Preview Play
  const togglePlayPreview = async (ep: Episode) => {
    if (playingAudioId === ep.docId) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      try {
        const playableUrl = await resolveAudioUrl(ep);
        if (!playableUrl) {
          triggerToast('تعذّر العثور على المقطع الصوتي أو لم يعد متوفراً', 'error', 'ملف غير متاح');
          return;
        }
        const audio = new Audio(playableUrl);
        previewAudioRef.current = audio;
        audio.play().catch(() =>
          triggerToast(
            'منع المتصفح التشغيل التلقائي أو الرابط غير صالح',
            'warning',
            'تشغيل الصوت'
          )
        );
        audio.onended = () => setPlayingAudioId(null);
        setPlayingAudioId(ep.docId);
      } catch (e: any) {
        const friendly = formatFriendlyError(e, 'تعذّر تشغيل المقطع الصوتي');
        triggerToast(friendly.message, 'error', friendly.title);
      }
    }
  };

  // ==================== SITE SETTINGS ACTIONS ====================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm.siteTitle?.trim()) {
      triggerToast('يرجى كتابة عنوان للموقع', 'error', 'حقل مطلوب');
      return;
    }

    setIsSavingSettings(true);
    try {
      const docRef = doc(db, 'settings', 'site_info');
      await writeBatch(db)
        .set(docRef, {
          ...settingsForm,
          updatedAt: serverTimestamp(),
        })
        .commit();
      setSiteSettings(settingsForm);
      triggerToast('تم حفظ إعدادات الموقع وتحديثها في السحابة بنجاح! ⚙️', 'success', 'إعدادات الموقع');
    } catch (e: any) {
      const friendly = formatFriendlyError(e, 'تعذّر حفظ وتحديث إعدادات الموقع');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ==================== GLOBAL AUDIO ACTIONS ====================
  const handleGlobalAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !file.type.startsWith('audio/') &&
      !file.name.match(/\.(mp3|m4a|wav|ogg|aac|webm|flac)$/i)
    ) {
      triggerToast(
        'يرجى اختيار ملف صوتي صالح بصيغة (MP3, WAV, M4A, OGG)',
        'error',
        'صيغة غير مدعومة'
      );
      return;
    }

    setGlobalAudioOriginalName(file.name);
    setIsCompressingGlobalAudio(true);
    setGlobalCompressionProgress(10);
    setGlobalCompressionMessage('بدء معالجة وضغط المقطع العام...');
    setGlobalCompressionResult(null);

    try {
      const result = await compressAudio(file, 32, (percent, msg) => {
        setGlobalCompressionProgress(percent);
        setGlobalCompressionMessage(msg);
      });
      setGlobalCompressionResult(result);
      triggerToast(
        `تم ضغط المقطع العام بنجاح! تقلص الحجم بنسبة ${result.compressionRatio}% (${formatBytes(result.originalSize)} ⬅ ${formatBytes(result.compressedSize)})`,
        'success',
        'تم الضغط بنجاح'
      );
    } catch (err: any) {
      console.error('Global audio compression failed:', err);
      const friendly = formatFriendlyError(err, 'تعذّر ضغط ومعالجة المقطع الصوتي العام');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsCompressingGlobalAudio(false);
    }
  };

  const handleSaveCompressedGlobalAudio = async () => {
    if (!globalCompressionResult) return;
    setIsSavingGlobalAudio(true);
    try {
      await saveGlobalAudio(globalCompressionResult.base64DataUrl, {
        originalFileName: globalAudioOriginalName,
        originalSize: globalCompressionResult.originalSize,
        compressedSize: globalCompressionResult.compressedSize,
      });
      setGlobalCompressionResult(null);
      triggerToast(
        'تم حفظ المقطع الصوتي العام المضغوط في السحابة بنجاح! 🎧',
        'success',
        'المقطع العام'
      );
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'فشل حفظ المقطع الصوتي العام في السحابة');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingGlobalAudio(false);
    }
  };

  const handleSaveUrlGlobalAudio = async () => {
    const url = globalAudioInput.trim();
    if (!url) {
      triggerToast('يرجى إدخال رابط صوتي صحيح أولاً', 'warning', 'حقل فارغ');
      return;
    }
    setIsSavingGlobalAudio(true);
    try {
      await writeBatch(db)
        .set(doc(db, 'settings', 'global_audio'), {
          audioUrl: url,
          audioType: 'direct',
          updatedAt: serverTimestamp(),
        })
        .commit();
      triggerToast('تم حفظ الرابط الصوتي العام في السحابة! 🎧', 'success', 'المقطع العام');
    } catch (err: any) {
      const friendly = formatFriendlyError(err, 'تعذّر تحديث المقطع الصوتي العام');
      triggerToast(friendly.message, 'error', friendly.title);
    } finally {
      setIsSavingGlobalAudio(false);
    }
  };

  const handleRemoveGlobalAudioPrompt = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'تأكيد إزالة المقطع الصوتي العام',
      message: 'هل تريد بالتأكيد إزالة المقطع الصوتي العام للسيرة الشريفة نهائياً من السحابة؟',
      onConfirm: async () => {
        try {
          await removeGlobalAudio();
          setGlobalAudioInput('');
          setGlobalCompressionResult(null);
          triggerToast('تمت إزالة المقطع الصوتي العام بنجاح', 'info', 'إزالة المقطع');
        } catch (err: any) {
          const friendly = formatFriendlyError(err, 'تعذّر إزالة المقطع العام');
          triggerToast(friendly.message, 'error', friendly.title);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // ==================== RENDER PIN LOGIN ====================
  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper">
        <Toast toasts={toasts} onClose={handleCloseToast} />
        <div className="admin-login-card">
          <div className="admin-lock-icon">
            <Lock size={32} />
          </div>
          <h2>لوحة إدارة السيرة النبوية</h2>
          <p>أدخل رمز المرور المخصص للإدارة لتعديل الحلقات وإدارة السلاسل والصوتيات</p>

          <form onSubmit={handleLogin} style={{ marginTop: '20px' }}>
            <div className="form-group">
              <input
                type="password"
                className="form-input"
                style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '1.4rem' }}
                placeholder="••••"
                maxLength={10}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                required
              />
            </div>

            {pinError && <div className="admin-login-error">{pinError}</div>}

            <button type="submit" className="btn-gold" style={{ width: '100%', marginTop: '12px' }}>
              <ShieldCheck size={18} />
              <span>تسجيل الدخول</span>
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Link href="/" className="back-link">
              <ArrowRight size={16} />
              <span>العودة إلى موقع القراءة</span>
            </Link>
          </div>

          <div style={{ marginTop: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            الرمز الافتراضي: <code>1234</code>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER ADMIN DASHBOARD ====================
  return (
    <div className="admin-page-container">
      <Toast toasts={toasts} onClose={handleCloseToast} />

      {/* Admin Top Navigation */}
      <header className="admin-top-nav">
        <div className="admin-nav-inner">
          <div className="admin-nav-right">
            <Link href="/" className="admin-back-btn" title="العودة لموقع القراءة">
              <ArrowRight size={18} />
              <span>عرض الموقع</span>
            </Link>
            <div className="admin-badge-title">
              <span className="admin-badge-icon">🕌</span>
              <div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-title)' }}>
                  لوحة إدارة السيرة النبوية
                </h1>
                <span style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>لوحة تحكم المشرف</span>
              </div>
            </div>
          </div>

          <div className="admin-nav-actions">
            <button
              className="tool-btn"
              onClick={() => setIsPinModalOpen(true)}
              title="تغيير رمز المرور"
            >
              <Key size={16} />
              <span>رمز المرور</span>
            </button>
            <button
              className="tool-btn danger-action"
              onClick={handleLogout}
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Wrapper */}
      <main className="admin-main-wrap">
        {/* Navigation Tabs Bar */}
        <nav className="admin-main-tabs">
          <button
            className={`admin-main-tab ${adminTab === 'episodes' ? 'active' : ''}`}
            onClick={() => setAdminTab('episodes')}
          >
            <FileText size={18} />
            <span>الحلقات ({episodes.length})</span>
          </button>
          <button
            className={`admin-main-tab ${adminTab === 'series' ? 'active' : ''}`}
            onClick={() => setAdminTab('series')}
          >
            <Layers size={18} />
            <span>السلاسل والتصنيفات ({seriesList.length})</span>
          </button>
          <button
            className={`admin-main-tab ${adminTab === 'settings' ? 'active' : ''}`}
            onClick={() => setAdminTab('settings')}
          >
            <SettingsIcon size={18} />
            <span>إعدادات وتخصيص الموقع</span>
          </button>
        </nav>

        {/* Stats Grid */}
        <section className="admin-stats-grid">
          <div className="stat-card">
            <div className="stat-icon gold">
              <FileText size={22} />
            </div>
            <div className="stat-data">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">إجمالي الحلقات</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <Layers size={22} />
            </div>
            <div className="stat-data">
              <span className="stat-value">{stats.totalSeries}</span>
              <span className="stat-label">السلاسل والتصنيفات</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon emerald">
              <Volume2 size={22} />
            </div>
            <div className="stat-data">
              <span className="stat-value">{stats.withAudio}</span>
              <span className="stat-label">حلقات بها مقاطع صوتية</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon amber">
              <Pin size={22} />
            </div>
            <div className="stat-data">
              <span className="stat-value">{stats.pinnedCount}</span>
              <span className="stat-label">حلقات مثبتة في الصدارة</span>
            </div>
          </div>
        </section>

        {/* ==================== TAB 1: EPISODES ==================== */}
        {adminTab === 'episodes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Toolbar: Actions & Filters */}
            <section className="admin-toolbar-card">
              <div className="admin-actions-bar">
                <div className="actions-primary">
                  <button className="btn-gold" onClick={handleOpenAddEpisode}>
                    <Plus size={18} />
                    <span>إضافة حلقة جديدة</span>
                  </button>

                  <button
                    className={`tool-btn ${filterOnlyPinned ? 'active' : ''}`}
                    onClick={() => setFilterOnlyPinned(!filterOnlyPinned)}
                    title="تصفية الحلقات المثبتة"
                  >
                    <Pin size={15} />
                    <span>المثبتة فقط</span>
                  </button>

                  <button
                    className={`tool-btn ${filterOnlyAudio ? 'active' : ''}`}
                    onClick={() => setFilterOnlyAudio(!filterOnlyAudio)}
                    title="تصفية الحلقات التي تحتوي على صوت"
                  >
                    <Volume2 size={15} />
                    <span>بها صوت فقط</span>
                  </button>
                </div>

                <div className="filters-row">
                  {/* Series Filter Dropdown */}
                  <select
                    className="form-input"
                    style={{ width: 'auto', minWidth: '180px', padding: '8px 12px' }}
                    value={selectedSeriesFilter}
                    onChange={(e) => setSelectedSeriesFilter(e.target.value)}
                  >
                    <option value="all">كل السلاسل ({episodes.length})</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.title}>
                        {s.title} ({seriesCounts.get(s.title) || 0}) {s.isPinned ? '📌' : ''}
                      </option>
                    ))}
                  </select>

                  {/* Search Input */}
                  <div className="admin-search-wrap">
                    <Search size={16} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="بحث في العناوين أو النصوص..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingRight: '36px' }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Episodes Table */}
            <section className="admin-table-container">
              <div className="table-header-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3>قائمة الحلقات ({filteredEpisodes.length})</h3>
                  {selectedSeriesFilter !== 'all' && (
                    <span className="filter-active-tag">سلسلة: {selectedSeriesFilter}</span>
                  )}
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  يمكنك تثبيت الحلقات 📌 وترتيبها ورفع ملفات صوتية مضغوطة Base64
                </span>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 10px' }} />
                  <p>جارٍ تحميل الحلقات من السحابة...</p>
                </div>
              ) : filteredEpisodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  <p>لا توجد حلقات مطابقة للبحث أو التصفية الحالية.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>#</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>تثبيت</th>
                        <th style={{ width: '190px' }}>السلسلة / التصنيف</th>
                        <th>عنوان الحلقة</th>
                        <th style={{ width: '210px' }}>🎙️ التسجيل الصوتي (AI)</th>
                        <th style={{ width: '90px' }}>الكلمات</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>الترتيب</th>
                        <th style={{ width: '130px', textAlign: 'center' }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEpisodes.map((ep, idx) => {
                        const wordsCount = ep.html.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
                        const isAudioPlaying = playingAudioId === ep.docId;
                        const hasAudio = !!ep.audioUrl;
                        const isBase64 = ep.audioUrl?.startsWith('data:') || ep.audioUrl === '__CHUNKS__';

                        return (
                          <tr key={ep.docId} className={`admin-table-row ${ep.isPinned ? 'row-pinned' : ''}`}>
                            <td>
                              <span className="order-badge">{ep.order || idx + 1}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className={`pin-toggle-btn ${ep.isPinned ? 'pinned' : ''}`}
                                onClick={() => handleTogglePinEpisode(ep)}
                                title={ep.isPinned ? 'حلقة مثبتة في الصدارة (انقر لإلغاء التثبيت)' : 'تثبيت الحلقة في الصدارة'}
                              >
                                <Pin size={15} />
                              </button>
                            </td>
                            <td>
                              <span className="era-badge">
                                {ep.era}
                              </span>
                            </td>
                            <td>
                              <div className="title-cell">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong className="ep-title-text">{ep.title}</strong>
                                  {ep.isPinned && <span className="pin-tiny-badge">مثبتة 📌</span>}
                                </div>
                                <span className="ep-subtitle-text">{ep.subtitle || '—'}</span>
                              </div>
                            </td>
                            <td>
                              {hasAudio ? (
                                <div className="audio-cell-active" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    className={`audio-play-mini-btn ${isAudioPlaying ? 'playing' : ''}`}
                                    onClick={() => togglePlayPreview(ep)}
                                    title={isAudioPlaying ? 'إيقاف المعاينة' : 'معاينة واستماع'}
                                  >
                                    {isAudioPlaying ? <Pause size={13} /> : <Play size={13} />}
                                  </button>
                                  <button
                                    className="audio-link-tag"
                                    onClick={() => handleOpenAudioModal(ep)}
                                    title="إدارة أو إعادة توليد الصوت"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Mic size={12} style={{ color: 'var(--gold)' }} />
                                    <span>{isBase64 ? 'صوت استوديو ✓' : 'رابط خارجي ✓'}</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="audio-add-prompt-btn"
                                  onClick={() => handleOpenAudioModal(ep)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'linear-gradient(135deg, rgba(200, 155, 60, 0.16), rgba(200, 155, 60, 0.06))',
                                    border: '1px solid rgba(200, 155, 60, 0.4)',
                                    color: 'var(--gold)',
                                    fontWeight: 600,
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    transition: 'all 0.2s ease',
                                  }}
                                  title="🎙️ توليد صوت بشري بالذكاء الاصطناعي (Gemini) أو رفع ملف"
                                >
                                  <Mic size={14} style={{ color: 'var(--gold)' }} />
                                  <span>🎙️ توليد صوت (AI)</span>
                                </button>
                              )}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {wordsCount}
                            </td>
                            <td>
                              <div className="reorder-btns">
                                <button
                                  className="reorder-btn"
                                  onClick={() => handleMoveOrder(idx, 'up')}
                                  disabled={idx === 0}
                                  title="رفع الترتيب لأعلى"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  className="reorder-btn"
                                  onClick={() => handleMoveOrder(idx, 'down')}
                                  disabled={idx === episodes.length - 1}
                                  title="خفض الترتيب لأسفل"
                                >
                                  <ArrowDown size={14} />
                                </button>
                              </div>
                            </td>
                            <td>
                              <div className="actions-cell">
                                <button
                                  className="action-icon-btn"
                                  onClick={() => handleOpenAudioModal(ep)}
                                  title="🎙️ توليد تسجيل صوتي بالذكاء الاصطناعي (Gemini) أو إدارة الصوت"
                                  style={{ color: hasAudio ? 'var(--gold)' : 'var(--text-muted)' }}
                                >
                                  <Mic size={16} />
                                </button>
                                <button
                                  className="action-icon-btn"
                                  onClick={() => handleOpenEditEpisode(ep)}
                                  title="تعديل محتوى الحلقة"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  className="action-icon-btn danger"
                                  onClick={() => handleDeleteEpisodePrompt(ep)}
                                  title="حذف الحلقة نهائياً"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ==================== TAB 2: SERIES MANAGEMENT ==================== */}
        {adminTab === 'series' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Duplicate Categories Detected Warning Banner */}
            {duplicateSeriesGroups.length > 0 && (
              <div className="admin-duplicate-banner">
                <div className="duplicate-banner-content">
                  <div className="duplicate-banner-icon">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h4 className="duplicate-banner-title">
                      تنبيه: تم رصد ({duplicateSeriesGroups.length}) مجموعة تصنيفات مكررة بنفس الاسم!
                    </h4>
                    <p className="duplicate-banner-desc">
                      توجد تصنيفات مكررة في قاعدة البيانات:{' '}
                      <strong>
                        {duplicateSeriesGroups
                          .map((g) => `«${g[0].title}» (${g.length} تكرار)`)
                          .join('، ')}
                      </strong>
                      . يمكنك دمجها تلقائياً الآن لتوحيد جميع الحلقات تحت التصنيف الأساسي وحذف السجلات المكررة.
                    </p>
                  </div>
                </div>
                <div className="duplicate-banner-actions">
                  <button
                    type="button"
                    className="btn-merge-auto"
                    onClick={handleMergeAllDuplicates}
                    disabled={isSavingSeries}
                  >
                    <GitMerge size={16} />
                    <span>دمج التصنيفات المكررة الآن ⚡</span>
                  </button>
                </div>
              </div>
            )}

            <section className="admin-toolbar-card">
              <div className="admin-actions-bar">
                <div className="actions-primary">
                  <button className="btn-gold" onClick={handleOpenAddSeries}>
                    <FolderPlus size={18} />
                    <span>إضافة سلسلة جديدة</span>
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => {
                      if (seriesList.length < 2) {
                        triggerToast('يلزم وجود تصنيفين على الأقل لإجراء عملية الدمج', 'warning', 'تنبيه');
                        return;
                      }
                      setMergeSourceSeriesId(seriesList[1]?.id || '');
                      setMergeTargetSeriesId(seriesList[0]?.id || '');
                      setIsMergeModalOpen(true);
                    }}
                    title="دمج سلسلتين ونقل الحلقات بينهما"
                  >
                    <GitMerge size={16} />
                    <span>دمج تصنيفين</span>
                  </button>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  إجمالي السلاسل المعتمدة: <strong>{seriesList.length}</strong>
                </div>
              </div>
            </section>

            {/* Series Cards Grid */}
            <div className="series-cards-grid">
              {seriesList.map((s, idx) => {
                const count = seriesCounts.get(s.title) || 0;

                return (
                  <div key={s.id} className={`series-card ${s.isPinned ? 'series-pinned' : ''}`}>
                    <div className="series-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="series-order-badge">{s.order || idx + 1}</div>
                        <div>
                          <h4 className="series-title">{s.title}</h4>
                          <span className="series-ep-count">{count} حلقة</span>
                        </div>
                      </div>

                      <button
                        className={`pin-toggle-btn ${s.isPinned ? 'pinned' : ''}`}
                        onClick={() => handleTogglePinSeries(s)}
                        title={s.isPinned ? 'سلسلة مثبتة في الصدارة (انقر لإلغاء التثبيت)' : 'تثبيت السلسلة في الصدارة'}
                      >
                        <Pin size={16} />
                      </button>
                    </div>

                    {s.description && (
                      <p className="series-desc">{s.description}</p>
                    )}

                    <div className="series-card-footer">
                      <div className="reorder-btns">
                        <button
                          className="reorder-btn"
                          onClick={() => handleMoveSeriesOrder(idx, 'up')}
                          disabled={idx === 0}
                          title="رفع الترتيب"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="reorder-btn"
                          onClick={() => handleMoveSeriesOrder(idx, 'down')}
                          disabled={idx === seriesList.length - 1}
                          title="خفض الترتيب"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="action-icon-btn"
                          onClick={() => handleOpenEditSeries(s)}
                          title="تعديل السلسلة"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          className="action-icon-btn danger"
                          onClick={() => handleDeleteSeriesPrompt(s)}
                          title="حذف السلسلة"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: SITE SETTINGS ==================== */}
        {adminTab === 'settings' && (
          <div className="admin-settings-container">
            {/* 1. Global Audio Settings */}
            <div className="settings-section-card">
              <div className="section-card-header">
                <Headphones size={20} className="gold-text" />
                <div>
                  <h4>المقطع الصوتي العام للسيرة الشريفة</h4>
                  <p>مقطع صوتي رئيسي يظهر لجميع الزوار في أسفل صفحة القراءة كمقدمة وتلاوة عامة</p>
                </div>
              </div>

              {/* Active Global Audio Player / Details */}
              {globalAudio?.audioUrl && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(212, 175, 55, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          padding: '3px 10px',
                        }}
                      >
                        <CheckCircle2 size={13} />
                        مقطع صوتي عام نشط
                      </span>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          color: 'var(--text-muted)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        {globalAudio.audioType === 'chunked'
                          ? `مخزن سحابياً (${globalAudio.audioChunksCount || 1} أجزاء Base64)`
                          : globalAudio.audioType === 'direct'
                          ? 'مخزن سحابياً (Base64 مباشر)'
                          : 'رابط خارجي مباشر'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        color: '#ef4444',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onClick={handleRemoveGlobalAudioPrompt}
                    >
                      <Trash2 size={14} />
                      <span>إزالة المقطع</span>
                    </button>
                  </div>

                  {/* Metadata if present */}
                  {(globalAudio.originalFileName || globalAudio.compressedSize) && (
                    <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      {globalAudio.originalFileName && <span>📁 الملف: {globalAudio.originalFileName}</span>}
                      {globalAudio.compressedSize && (
                        <span>📦 الحجم: {formatBytes(globalAudio.compressedSize)}</span>
                      )}
                    </div>
                  )}

                  {/* Audio Preview Player */}
                  <div style={{ marginTop: '12px' }}>
                    {isLoadingAdminGlobalAudio ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--gold)' }}>
                        <RefreshCw size={14} className="spin-slow" />
                        <span>جارٍ استرجاع المقطع الصوتي العام من السحابة...</span>
                      </div>
                    ) : (
                      <audio
                        controls
                        src={resolvedAdminGlobalAudioUrl || globalAudio.audioUrl}
                        style={{ width: '100%' }}
                        preload="metadata"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Upload or Update Audio Tabs */}
              <div style={{ marginTop: '20px' }}>
                <h5 style={{ fontSize: '0.9rem', color: 'var(--text-title)', marginBottom: '8px' }}>
                  {globalAudio?.audioUrl ? 'استبدال أو تحديث المقطع الصوتي العام:' : 'إضافة مقطع صوتي عام جديد:'}
                </h5>

                <div className="audio-tabs-bar">
                  <button
                    type="button"
                    className={`audio-tab-btn ${globalAudioUploadTab === 'upload' ? 'active' : ''}`}
                    onClick={() => setGlobalAudioUploadTab('upload')}
                  >
                    <UploadCloud size={16} />
                    <span>رفع ملف وضغطه تلقائياً (Base64)</span>
                  </button>
                  <button
                    type="button"
                    className={`audio-tab-btn ${globalAudioUploadTab === 'url' ? 'active' : ''}`}
                    onClick={() => setGlobalAudioUploadTab('url')}
                  >
                    <Link2 size={16} />
                    <span>رابط خارجي مباشر</span>
                  </button>
                </div>

                {/* Tab 1: Upload & Compress */}
                {globalAudioUploadTab === 'upload' && (
                  <div style={{ marginTop: '14px' }}>
                    <input
                      type="file"
                      ref={globalFileInputRef}
                      accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.webm,.flac"
                      style={{ display: 'none' }}
                      onChange={handleGlobalAudioFileSelect}
                    />

                    <div
                      className="audio-upload-dropzone"
                      onClick={() => globalFileInputRef.current?.click()}
                    >
                      <div className="dropzone-icon">
                        <FileAudio size={36} />
                      </div>
                      <h4>اختر ملفاً صوتياً للمقطع العام من جهازك</h4>
                      <p>يدعم جميع الصيغ: MP3, M4A, WAV, OGG, AAC, WebM</p>
                      <span className="dropzone-badge">
                        يتم تقليص الحجم تلقائياً حتى 90% وحفظه في السحابة مجاناً بدون ستورج
                      </span>
                    </div>

                    {/* Compression Progress */}
                    {isCompressingGlobalAudio && (
                      <div className="compression-progress-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--gold)' }}>
                            {globalCompressionMessage}
                          </span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)' }}>
                            {globalCompressionProgress}%
                          </span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${globalCompressionProgress}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Compression Result Preview */}
                    {globalCompressionResult && !isCompressingGlobalAudio && (
                      <div className="compression-result-card">
                        <div className="result-stats-row">
                          <div className="result-stat-item">
                            <span className="res-label">الحجم الأصلي:</span>
                            <span className="res-val original">{formatBytes(globalCompressionResult.originalSize)}</span>
                          </div>
                          <div className="result-stat-item">
                            <span className="res-label">الحجم بعد الضغط:</span>
                            <span className="res-val compressed">{formatBytes(globalCompressionResult.compressedSize)}</span>
                          </div>
                          <div className="result-stat-item">
                            <span className="res-label">نسبة التخفيض:</span>
                            <span className="res-badge-ratio">-{globalCompressionResult.compressionRatio}%</span>
                          </div>
                        </div>

                        <div style={{ marginTop: '14px' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            معاينة المقطع العام المضغوط قبل اعتماده:
                          </label>
                          <audio controls src={globalCompressionResult.base64DataUrl} style={{ width: '100%' }} />
                        </div>

                        <button
                          type="button"
                          className="btn-gold"
                          style={{ width: '100%', marginTop: '14px', padding: '12px' }}
                          onClick={handleSaveCompressedGlobalAudio}
                          disabled={isSavingGlobalAudio}
                        >
                          <Check size={18} />
                          <span>
                            {isSavingGlobalAudio ? 'جارٍ الحفظ في السحابة...' : 'اعتماد وحفظ المقطع العام في قاعدة البيانات (Base64)'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: URL */}
                {globalAudioUploadTab === 'url' && (
                  <div style={{ marginTop: '14px' }}>
                    <label className="form-label">رابط المقطع الصوتي (MP3 مباشر أو Data URL)</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="https://example.com/audio.mp3"
                        value={globalAudioInput}
                        onChange={(e) => setGlobalAudioInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-gold"
                        onClick={handleSaveUrlGlobalAudio}
                        disabled={isSavingGlobalAudio}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {isSavingGlobalAudio ? 'جارٍ الحفظ...' : 'حفظ الرابط'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Site Identity & Dedication Settings */}
            <div className="settings-section-card">
              <div className="section-card-header">
                <Sliders size={20} className="gold-text" />
                <div>
                  <h4>تخصيص نصوص الموقع والإهداء (الصدقة الجارية)</h4>
                  <p>يمكنك تعديل عنوان الموقع ونصوص الإهداء التي تظهر في أسفل كل صفحة</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} style={{ marginTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">عنوان الموقع الرئيسي</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settingsForm.siteTitle || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, siteTitle: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">الوصف التوضيحي للهيدر</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settingsForm.siteSubtitle || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, siteSubtitle: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">شارة الإهداء</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settingsForm.dedicationBadge || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, dedicationBadge: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">اسم صاحب الصدقة الجارية</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settingsForm.dedicationName || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, dedicationName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">إهداء الوالدين</label>
                    <input
                      type="text"
                      className="form-input"
                      value={settingsForm.dedicationParents || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, dedicationParents: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button type="submit" className="btn-gold" disabled={isSavingSettings}>
                    <Check size={18} />
                    <span>{isSavingSettings ? 'جارٍ الحفظ في السحابة...' : 'حفظ التغييرات'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ==================== MODAL: ADD / EDIT EPISODE ==================== */}
      {isEpisodeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEpisodeModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editingEpisode ? 'تعديل حلقة في السيرة' : 'إضافة حلقة جديدة للسيرة'}</h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsEpisodeModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEpisode}>
              {/* Order & Series Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">الترتيب الرقمي</label>
                  <input
                    type="number"
                    min={1}
                    className="form-input"
                    value={formOrder}
                    onChange={(e) => setFormOrder(parseInt(e.target.value, 10) || 1)}
                    required
                  />
                </div>

                <div className={`form-group ${episodeFormErrors.era ? 'has-error' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>السلسلة / العصر</label>
                    <button
                      type="button"
                      className="inline-text-btn"
                      onClick={() => setIsQuickSeriesOpen(!isQuickSeriesOpen)}
                    >
                      {isQuickSeriesOpen ? 'إلغاء' : '+ إضافة سلسلة جديدة'}
                    </button>
                  </div>

                  {/* Inline quick add */}
                  {isQuickSeriesOpen ? (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="اكتب اسم السلسلة الجديدة..."
                        value={quickSeriesTitle}
                        onChange={(e) => setQuickSeriesTitle(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-gold"
                        style={{ padding: '6px 14px', whiteSpace: 'nowrap' }}
                        onClick={handleQuickAddSeries}
                      >
                        إضافة
                      </button>
                    </div>
                  ) : (
                    <select
                      className="form-input"
                      value={formEra}
                      onChange={(e) => {
                        setFormEra(e.target.value);
                        if (episodeFormErrors.era) {
                          setEpisodeFormErrors((prev) => ({ ...prev, era: undefined }));
                        }
                      }}
                      required
                    >
                      {seriesList.map((s) => (
                        <option key={s.id} value={s.title}>
                          {s.title} {s.isPinned ? '📌' : ''}
                        </option>
                      ))}
                      {/* If current era is not in seriesList, add as option */}
                      {formEra && !seriesList.some((s) => s.title === formEra) && (
                        <option value={formEra}>{formEra}</option>
                      )}
                    </select>
                  )}
                  {episodeFormErrors.era && (
                    <div className="form-field-error">
                      <AlertCircle size={14} />
                      <span>{episodeFormErrors.era}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Title & Subtitle */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div className={`form-group ${episodeFormErrors.title ? 'has-error' : ''}`}>
                  <label className="form-label">عنوان الحلقة</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      if (episodeFormErrors.title) {
                        setEpisodeFormErrors((prev) => ({ ...prev, title: undefined }));
                      }
                    }}
                    placeholder="مثال: ظلام مطبق ويأس قاتل"
                    required
                  />
                  {episodeFormErrors.title && (
                    <div className="form-field-error">
                      <AlertCircle size={14} />
                      <span>{episodeFormErrors.title}</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">الوصف الفرعي (اختياري)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="مثال: الحلقة 008"
                  />
                </div>
              </div>

              {/* Pin Checkbox */}
              <div className="pin-checkbox-row">
                <label className="custom-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                  />
                  <Pin size={16} className="gold-text" />
                  <span>تثبيت هذه الحلقة في الصدارة وتمييزها في الفهرس 📌</span>
                </label>
              </div>

              {/* Studio AI Audio Status & Quick Generate Action */}
              {editingEpisode && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(200, 155, 60, 0.08)',
                    border: '1px solid rgba(200, 155, 60, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '10px',
                    marginBottom: '16px',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: editingEpisode.audioUrl ? 'rgba(34, 197, 94, 0.15)' : 'rgba(200, 155, 60, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: editingEpisode.audioUrl ? '#22c55e' : 'var(--gold)',
                        flexShrink: 0,
                      }}
                    >
                      <Mic size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-title)' }}>
                        {editingEpisode.audioUrl ? 'التسجيل الصوتي متوفر للحلقة ✓' : 'لم يتم توليد تسجيل صوتي بعد لهذه الحلقة'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {editingEpisode.audioUrl
                          ? 'الحلقة جاهزة ومتاحة للزوار في مشغل الاستوديو الفخم'
                          : 'يمكنك توليد قراءة استوديو بشرية بنموذج Gemini 2.5 AI بضغطة زر'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-gold"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.82rem',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onClick={() => {
                      setIsEpisodeModalOpen(false);
                      handleOpenAudioModal(editingEpisode);
                    }}
                  >
                    <Mic size={15} />
                    <span>{editingEpisode.audioUrl ? 'إدارة / إعادة توليد الصوت' : '🎙️ توليد صوت (AI)'}</span>
                  </button>
                </div>
              )}

              {/* Text Body */}
              <div className={`form-group ${episodeFormErrors.content ? 'has-error' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="form-label">نص الحلقة الشريفة (افصل بين الفقرات بسطر فارغ)</label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    الآيات القرآنية تُنسق تلقائياً بوضعها بين أقواس ﴿ ... ﴾
                  </span>
                </div>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '260px', fontSize: '0.95rem', lineHeight: '1.9' }}
                  value={formContent}
                  onChange={(e) => {
                    setFormContent(e.target.value);
                    if (episodeFormErrors.content) {
                      setEpisodeFormErrors((prev) => ({ ...prev, content: undefined }));
                    }
                  }}
                  placeholder="اكتب أو الصق نص الحلقة الشريفة هنا..."
                  required
                />
                {episodeFormErrors.content && (
                  <div className="form-field-error">
                    <AlertCircle size={14} />
                    <span>{episodeFormErrors.content}</span>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => setIsEpisodeModalOpen(false)}
                  disabled={isSavingEpisode}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-gold" disabled={isSavingEpisode}>
                  {isSavingEpisode ? 'جارٍ الحفظ في السحابة...' : 'حفظ ونشر في السحابة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT SERIES ==================== */}
      {isSeriesModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSeriesModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingSeries ? 'تعديل السلسلة' : 'إضافة سلسلة / تصنيف جديد'}</h3>
              <button className="modal-close-btn" onClick={() => setIsSeriesModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSeries}>
              <div className={`form-group ${duplicateSeriesWarning ? 'has-error' : ''}`}>
                <label className="form-label">اسم السلسلة / المرحلة</label>
                <input
                  type="text"
                  className="form-input"
                  value={seriesTitleInput}
                  onChange={(e) => setSeriesTitleInput(e.target.value)}
                  placeholder="مثال: العهد المكي أو الغزوات والسرايا"
                  required
                />
                {duplicateSeriesWarning && (
                  <div className="form-field-error">
                    <AlertCircle size={14} />
                    <span>
                      يوجد تصنيف مسجل بهذا الاسم مسبقاً («{duplicateSeriesWarning.title}»). يرجى اختيار اسم فريد لمنع التكرار.
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">وصف مختصر للسلسلة (اختياري)</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '80px' }}
                  value={seriesDescInput}
                  onChange={(e) => setSeriesDescInput(e.target.value)}
                  placeholder="اكتب نبذة توضيحية عن هذه السلسلة..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">الترتيب الرقمي للسلسلة</label>
                <input
                  type="number"
                  min={1}
                  className="form-input"
                  value={seriesOrderInput}
                  onChange={(e) => setSeriesOrderInput(parseInt(e.target.value, 10) || 1)}
                  required
                />
              </div>

              <div className="pin-checkbox-row" style={{ marginBottom: '16px' }}>
                <label className="custom-checkbox-label">
                  <input
                    type="checkbox"
                    checked={seriesPinnedInput}
                    onChange={(e) => setSeriesPinnedInput(e.target.checked)}
                  />
                  <Pin size={16} className="gold-text" />
                  <span>تثبيت السلسلة في صدارة الفهرس 📌</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => setIsSeriesModalOpen(false)}
                  disabled={isSavingSeries}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-gold"
                  disabled={isSavingSeries || !!duplicateSeriesWarning}
                >
                  {isSavingSeries ? 'جارٍ الحفظ...' : 'حفظ السلسلة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: MERGE TWO CATEGORIES ==================== */}
      {isMergeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMergeModalOpen(false)}>
          <div className="modal-card merge-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitMerge size={20} style={{ color: 'var(--gold)' }} />
                <h3>دمج تصنيفين ونقل الحلقات</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsMergeModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="merge-categories-flow">
              <div className="merge-box">
                <label>التصنيف المُراد نقله وحذفه (المصدر):</label>
                <select
                  value={mergeSourceSeriesId}
                  onChange={(e) => setMergeSourceSeriesId(e.target.value)}
                >
                  {seriesList.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === mergeTargetSeriesId}>
                      {s.title} ({seriesCounts.get(s.title) || 0} حلقة)
                    </option>
                  ))}
                </select>
              </div>

              <div className="merge-flow-arrow">
                <ArrowDown size={22} />
              </div>

              <div className="merge-box">
                <label>التصنيف المستقر الذي ستُنقل إليه الحلقات (الهدف):</label>
                <select
                  value={mergeTargetSeriesId}
                  onChange={(e) => setMergeTargetSeriesId(e.target.value)}
                >
                  {seriesList.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === mergeSourceSeriesId}>
                      {s.title} ({seriesCounts.get(s.title) || 0} حلقة)
                    </option>
                  ))}
                </select>
              </div>

              <div className="merge-impact-notice">
                💡 تنبيه: سيتم نقل كافة الحلقات المرتبطة بالتصنيف المصدري إلى التصنيف المستهدف في قاعدة البيانات، ثم حذف التصنيف المصدري لمنع وجود أي تكرار.
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="tool-btn"
                onClick={() => setIsMergeModalOpen(false)}
                disabled={isMerging}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-gold"
                onClick={handleExecuteMergeSeries}
                disabled={isMerging || !mergeSourceSeriesId || !mergeTargetSeriesId || mergeSourceSeriesId === mergeTargetSeriesId}
              >
                {isMerging ? 'جارٍ الدمج ونقل الحلقات...' : 'تأكيد دمج التصنيفين ⚡'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: AUDIO COMPRESSOR & BASE64 UPLOAD ==================== */}
      {isAudioModalOpen && audioTargetEpisode && (
        <div className="modal-overlay" onClick={() => setIsAudioModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mic size={22} style={{ color: 'var(--gold)' }} />
                <h3>🎙️ تسجيل استوديو بالذكاء الاصطناعي (Gemini): {audioTargetEpisode.title}</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsAudioModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Audio Mode Tabs */}
            <div className="audio-tabs-bar">
              <button
                className={`audio-tab-btn ${audioUploadTab === 'ai' ? 'active' : ''}`}
                onClick={() => setAudioUploadTab('ai')}
              >
                <Mic size={16} />
                <span>🎙️ توليد صوت بشري (Gemini AI)</span>
              </button>
              <button
                className={`audio-tab-btn ${audioUploadTab === 'upload' ? 'active' : ''}`}
                onClick={() => setAudioUploadTab('upload')}
              >
                <UploadCloud size={16} />
                <span>رفع ملف وضغطه (Base64)</span>
              </button>
              <button
                className={`audio-tab-btn ${audioUploadTab === 'url' ? 'active' : ''}`}
                onClick={() => setAudioUploadTab('url')}
              >
                <Link2 size={16} />
                <span>رابط مباشر</span>
              </button>
            </div>

            {/* TAB 0: Gemini AI Studio Audio */}
            {audioUploadTab === 'ai' && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Daily Quota Status Banner */}
                <div
                  style={{
                    background: 'rgba(212, 175, 55, 0.08)',
                    border: '1px solid rgba(212, 175, 55, 0.28)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: dailyQuotaStatus.remaining > 0 ? 'rgba(34, 197, 94, 0.16)' : 'rgba(239, 68, 68, 0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: dailyQuotaStatus.remaining > 0 ? '#22c55e' : '#ef4444',
                        flexShrink: 0,
                      }}
                    >
                      <Mic size={17} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-title)' }}>
                        الحصة اليومية المجانية: {dailyQuotaStatus.maxLimit} طلبات يومياً
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        المستخدم اليوم:{' '}
                        <strong style={{ color: 'var(--gold)' }}>{dailyQuotaStatus.count}</strong> من{' '}
                        {dailyQuotaStatus.maxLimit} | المتبقي اليوم:{' '}
                        <strong
                          style={{
                            color: dailyQuotaStatus.remaining > 0 ? '#22c55e' : '#ef4444',
                          }}
                        >
                          {dailyQuotaStatus.remaining} طلبات
                        </strong>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowApiKeySettings(!showApiKeySettings)}
                    className="inline-text-btn"
                    style={{ fontSize: '0.75rem', color: 'var(--gold)', textDecoration: 'underline' }}
                  >
                    {showApiKeySettings ? 'إخفاء المفتاح' : 'مفتاح API إضافي ⚙️'}
                  </button>
                </div>

                {/* Optional API Key Input */}
                {showApiKeySettings && (
                  <div
                    style={{
                      background: 'var(--bg-base)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: '4px' }}>
                      مفتاح Gemini API مخصص (في حال نفاد حصة المفتاح الافتراضي):
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="أدخل مفتاح Google AI Studio الخاص بك..."
                      value={geminiApiKeyInput}
                      onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    />
                  </div>
                )}

                {/* Narrator Banner */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Sparkles size={17} style={{ color: 'var(--gold)' }} />
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-title)' }}>
                      قراءة استوديو بصوت {DEFAULT_VOICE_NAME} (الذكاء الاصطناعي Gemini)
                    </h4>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    الأولوية المطلقة للفصحى الوقورة، مع نطق سياقي ذكي للكلمات بالعامية المصرية الخفيفة، وتلاوة الآيات والأحاديث بخشوع تام.
                  </p>
                </div>

                {/* Optional Custom Instructions Field */}
                {!isGeneratingAiAudio && !aiGeneratedResult && (
                  <div>
                    <label
                      className="form-label"
                      style={{ marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-title)' }}
                    >
                      توجيهات إضافية للنطق والأداء (اختياري):
                    </label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      style={{ minHeight: '62px', fontSize: '0.82rem', padding: '8px 12px' }}
                      placeholder="اكتب أي ملاحظة تريد أن يراعيها الراوي يوسف (مثال: اجعل النبرة حزينة ومؤثرة في البداية، تمهل عند ذكر الأحداث...)"
                      value={customAudioInstructions}
                      onChange={(e) => setCustomAudioInstructions(e.target.value)}
                    />
                  </div>
                )}

                {/* Text Excerpt Preview */}
                {!isGeneratingAiAudio && !aiGeneratedResult && (
                  <div
                    style={{
                      background: 'var(--bg-base)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>مقتطف نص الحلقة:</span>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: '0.82rem',
                        color: 'var(--text-body)',
                        maxHeight: '65px',
                        overflowY: 'auto',
                        lineHeight: '1.6',
                      }}
                    >
                      {cleanHtmlForSpeech(audioTargetEpisode.html).slice(0, 240)}...
                    </p>
                  </div>
                )}

                {/* Action Button */}
                {!isGeneratingAiAudio && !aiGeneratedResult && (
                  <button
                    type="button"
                    className="btn-gold"
                    style={{ width: '100%', padding: '12px', fontSize: '0.92rem', fontWeight: 700 }}
                    onClick={handleGenerateAiAudio}
                  >
                    <Mic size={18} />
                    <span>توليد التسجيل الصوتي للحلقة الآن</span>
                  </button>
                )}

                {/* Modern Dynamic Studio Loading & Progress Bar */}
                {isGeneratingAiAudio && (
                  <div className="studio-ai-progress-card">
                    <div className="studio-pulse-icon-wrap">
                      <div className="studio-pulse-ring"></div>
                      <Mic size={28} style={{ color: 'var(--gold)' }} />
                    </div>

                    <div className="studio-progress-pct">{simulatedProgress}%</div>

                    <div className="studio-progress-phrase">
                      {simulatedPhrase || '🎙️ جارٍ استدعاء الراوي وضبط النبرة...'}
                    </div>

                    <div className="studio-progress-track">
                      <div
                        className="studio-progress-bar"
                        style={{ width: `${simulatedProgress}%` }}
                      />
                    </div>

                    <div className="studio-progress-hint">
                      يستغرق التوليد الاستوديو حوالي 15-25 ثانية لإنتاج مقطع صوتي نقي متصل.
                    </div>
                  </div>
                )}

                {/* Result Preview & Save */}
                {aiGeneratedResult && !isGeneratingAiAudio && (
                  <div className="compression-result-card" style={{ border: '1px solid rgba(212, 175, 55, 0.4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--gold)' }}>
                        ✓ تم التوليد الصوتي بنجاح!
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        المدة: {Math.round(aiGeneratedResult.durationSeconds)} ثانية | الحجم: {formatBytes(aiGeneratedResult.sizeBytes)}
                      </span>
                    </div>

                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      استمع للتسجيل قبل الاعتماد:
                    </label>
                    <audio controls src={aiGeneratedResult.base64DataUrl} style={{ width: '100%', height: '42px' }} />

                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                      <button
                        type="button"
                        className="btn-gold"
                        style={{ flex: 1, padding: '12px' }}
                        onClick={handleSaveAiAudio}
                        disabled={isSavingAudio}
                      >
                        <Check size={18} />
                        <span>{isSavingAudio ? 'جارٍ الحفظ في السحابة...' : 'اعتماد وحفظ الصوت في الحلقة'}</span>
                      </button>
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={handleGenerateAiAudio}
                        disabled={isSavingAudio}
                        title="إعادة التوليد"
                      >
                        <RefreshCw size={16} />
                        <span>إعادة</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: Upload & Compress */}
            {audioUploadTab === 'upload' && (
              <div style={{ marginTop: '16px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.webm,.flac"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                <div
                  className="audio-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="dropzone-icon">
                    <FileAudio size={36} />
                  </div>
                  <h4>اختر ملفاً صوتياً من جهازك للضغط والرفع</h4>
                  <p>يدعم جميع الصيغ: MP3, M4A, WAV, OGG, AAC, WebM</p>
                  <span className="dropzone-badge">
                    يتم تقليص الحجم تلقائياً حتى 90% وحفظه Base64 في السحابة مجاناً
                  </span>
                </div>

                {/* Compression Progress */}
                {isCompressing && (
                  <div className="compression-progress-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--gold)' }}>
                        {compressionMessage}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-title)' }}>
                        {compressionProgress}%
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${compressionProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Compression Result Preview */}
                {compressionResult && !isCompressing && (
                  <div className="compression-result-card">
                    <div className="result-stats-row">
                      <div className="result-stat-item">
                        <span className="res-label">الحجم الأصلي:</span>
                        <span className="res-val original">{formatBytes(compressionResult.originalSize)}</span>
                      </div>
                      <div className="result-stat-item">
                        <span className="res-label">الحجم بعد الضغط:</span>
                        <span className="res-val compressed">{formatBytes(compressionResult.compressedSize)}</span>
                      </div>
                      <div className="result-stat-item">
                        <span className="res-label">نسبة التخفيض:</span>
                        <span className="res-badge-ratio">-{compressionResult.compressionRatio}%</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '14px' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        معاينة الصوت المضغوط قبل الحفظ:
                      </label>
                      <audio controls src={compressionResult.base64DataUrl} style={{ width: '100%' }} />
                    </div>

                    <button
                      className="btn-gold"
                      style={{ width: '100%', marginTop: '14px', padding: '12px' }}
                      onClick={handleSaveCompressedAudio}
                      disabled={isSavingAudio}
                    >
                      <Check size={18} />
                      <span>
                        {isSavingAudio ? 'جارٍ الحفظ في السحابة...' : 'اعتماد وحفظ الصوت في قاعدة البيانات (Base64)'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: External URL */}
            {audioUploadTab === 'url' && (
              <div style={{ marginTop: '16px' }}>
                <label className="form-label">رابط المقطع الصوتي المباشر (MP3 خارجي)</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://archive.org/download/.../audio.mp3"
                  value={audioUrlInput}
                  onChange={(e) => setAudioUrlInput(e.target.value)}
                />
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.6' }}>
                  يمكنك وضع رابط MP3 مباشر إذا كان لديك رابط جاهز من موقع خارجي مثل Archive.org.
                </p>
                <button
                  className="btn-gold"
                  style={{ width: '100%', marginTop: '14px' }}
                  onClick={handleSaveUrlAudio}
                  disabled={isSavingAudio}
                >
                  <Check size={18} />
                  <span>{isSavingAudio ? 'جارٍ الحفظ...' : 'حفظ الرابط الخارجي'}</span>
                </button>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="modal-actions" style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
              {audioTargetEpisode.audioUrl && (
                <button
                  type="button"
                  className="tool-btn danger-action"
                  style={{ marginLeft: 'auto' }}
                  onClick={handleRemoveAudioPrompt}
                  disabled={isSavingAudio}
                >
                  <Trash2 size={15} />
                  <span>إزالة الصوت الحالي</span>
                </button>
              )}
              <button
                type="button"
                className="tool-btn"
                onClick={() => setIsAudioModalOpen(false)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CHANGE PIN ==================== */}
      {isPinModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPinModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تغيير رمز المرور</h3>
              <button className="modal-close-btn" onClick={() => setIsPinModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleChangePin}>
              <div className="form-group">
                <label className="form-label">رمز المرور الجديد (4 أرقام على الأقل)</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">تأكيد رمز المرور الجديد</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="••••"
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="tool-btn"
                  onClick={() => setIsPinModalOpen(false)}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-gold">
                  حفظ الرمز
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== CUSTOM CONFIRM DIALOG ==================== */}
      {confirmDialog.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}>
          <div className="modal-card confirm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon-box">
              <AlertTriangle size={32} />
            </div>
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>

            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
              <button
                type="button"
                className="tool-btn"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-gold"
                style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                onClick={confirmDialog.onConfirm}
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

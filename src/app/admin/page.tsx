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
  Sliders,
  BookmarkCheck,
  CheckCircle2,
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
import { compressAudio, formatBytes, CompressionResult } from '@/lib/audioCompressor';
import { saveAudioToEpisode, removeAudioFromEpisode, resolveAudioUrl } from '@/lib/audioStorage';

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

  // Episode Form State
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formEra, setFormEra] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSubtitle, setFormSubtitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formIsPinned, setFormIsPinned] = useState<boolean>(false);
  const [isSavingEpisode, setIsSavingEpisode] = useState<boolean>(false);

  // Series Form State
  const [seriesTitleInput, setSeriesTitleInput] = useState<string>('');
  const [seriesDescInput, setSeriesDescInput] = useState<string>('');
  const [seriesOrderInput, setSeriesOrderInput] = useState<number>(1);
  const [seriesPinnedInput, setSeriesPinnedInput] = useState<boolean>(false);
  const [isSavingSeries, setIsSavingSeries] = useState<boolean>(false);

  // Quick Series Add Inline
  const [isQuickSeriesOpen, setIsQuickSeriesOpen] = useState<boolean>(false);
  const [quickSeriesTitle, setQuickSeriesTitle] = useState<string>('');

  // Audio Compression State
  const [audioUploadTab, setAudioUploadTab] = useState<'upload' | 'url'>('upload');
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

  // Audio Preview State
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Trigger Toast
  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
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
      triggerToast('يجب أن يتكون رمز المرور من 4 أرقام على الأقل', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      triggerToast('رمزا المرور غير متطابقين', 'error');
      return;
    }
    localStorage.setItem('seerah_admin_pin', newPin);
    setIsPinModalOpen(false);
    setNewPin('');
    setConfirmPin('');
    triggerToast('تم تحديث رمز المرور بنجاح!', 'success');
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
        triggerToast('خطأ في جلب الحلقات: ' + err.message, 'error');
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
          // Extract unique eras from existing episodes and create initial series
          const distinct = Array.from(new Set(episodes.map((e) => e.era).filter(Boolean)));
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

  // ==================== EPISODE ACTIONS ====================
  const handleOpenAddEpisode = () => {
    setEditingEpisode(null);
    setFormOrder(episodes.length + 1);
    // Default to first series or selected filter
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
    if (!formEra.trim() || !formTitle.trim() || !formContent.trim()) {
      triggerToast('يرجى ملء كافة الحقول الأساسية: السلسلة، عنوان الحلقة، والنص', 'error');
      return;
    }

    setIsSavingEpisode(true);
    const formattedHtml = formContent
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
      .join('\n');

    try {
      if (editingEpisode) {
        await updateDoc(doc(db, 'episodes', editingEpisode.docId), {
          order: Number(formOrder),
          era: formEra.trim(),
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          html: formattedHtml,
          isPinned: formIsPinned,
          updatedAt: serverTimestamp(),
        });
        triggerToast('تم تحديث بيانات الحلقة بنجاح! ✓', 'success');
      } else {
        await addDoc(collection(db, 'episodes'), {
          order: Number(formOrder),
          era: formEra.trim(),
          title: formTitle.trim(),
          subtitle: formSubtitle.trim(),
          html: formattedHtml,
          audioUrl: null,
          isPinned: formIsPinned,
          createdAt: serverTimestamp(),
        });
        triggerToast('تمت إضافة الحلقة الجديدة بنجاح! 🌟', 'success');
      }
      setIsEpisodeModalOpen(false);
    } catch (err: any) {
      triggerToast('فشل الحفظ: ' + err.message, 'error');
    } finally {
      setIsSavingEpisode(false);
    }
  };

  // Quick Inline Series Creator inside Episode Modal
  const handleQuickAddSeries = async () => {
    const title = quickSeriesTitle.trim();
    if (!title) return;
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
      triggerToast(`تمت إضافة سلسلة «${title}» واختيارها بنجاح!`, 'success');
    } catch (e: any) {
      triggerToast('تعذّر إضافة السلسلة: ' + e.message, 'error');
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
      triggerToast(nextPinned ? 'تم تثبيت الحلقة في الصدارة 📌' : 'تم إلغاء تثبيت الحلقة', 'info');
    } catch (err: any) {
      triggerToast('خطأ في التثبيت: ' + err.message, 'error');
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
          triggerToast('تم حذف الحلقة من السحابة بنجاح', 'info');
        } catch (err: any) {
          triggerToast('تعذّر الحذف: ' + err.message, 'error');
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
      triggerToast('تم تحديث ترتيب الحلقات', 'success');
    } catch (err: any) {
      triggerToast('خطأ في الترتيب: ' + err.message, 'error');
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
    if (!seriesTitleInput.trim()) {
      triggerToast('يرجى إدخال اسم السلسلة', 'error');
      return;
    }

    setIsSavingSeries(true);
    const title = seriesTitleInput.trim();
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
            .filter((ep) => ep.era === oldTitle)
            .forEach((ep) => {
              epBatch.update(doc(db, 'episodes', ep.docId), { era: title });
            });
          await epBatch.commit();
        }

        triggerToast('تم تحديث بيانات السلسلة بنجاح! ✓', 'success');
      } else {
        await addDoc(collection(db, 'series'), {
          title,
          description,
          order,
          isPinned,
          createdAt: serverTimestamp(),
        });
        triggerToast('تمت إضافة السلسلة الجديدة بنجاح! 📚', 'success');
      }
      setIsSeriesModalOpen(false);
    } catch (err: any) {
      triggerToast('خطأ أثناء حفظ السلسلة: ' + err.message, 'error');
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
      triggerToast(next ? 'تم تثبيت السلسلة في الصدارة 📌' : 'تم إلغاء تثبيت السلسلة', 'info');
    } catch (e: any) {
      triggerToast('خطأ: ' + e.message, 'error');
    }
  };

  const handleDeleteSeriesPrompt = (s: Series) => {
    const count = seriesCounts.get(s.title) || 0;
    setConfirmDialog({
      isOpen: true,
      title: 'تأكيد حذف السلسلة',
      message:
        count > 0
          ? `تنبيه: هذه السلسلة تحتوي على (${count}) حلقة. حذف السلسلة لن يحذف الحلقات ولكن ستحتاج لإعادة تصنيفها. هل تريد المتابعة؟`
          : `هل تريد بالتأكيد حذف سلسلة: «${s.title}»؟`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'series', s.id));
          triggerToast('تم حذف السلسلة بنجاح', 'info');
        } catch (e: any) {
          triggerToast('تعذّر الحذف: ' + e.message, 'error');
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
      triggerToast('تم تحديث ترتيب السلاسل', 'success');
    } catch (err: any) {
      triggerToast('خطأ في الترتيب: ' + err.message, 'error');
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
    setAudioUploadTab('upload');
    setIsAudioModalOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        'success'
      );
    } catch (err: any) {
      console.error('Audio compression failed:', err);
      triggerToast('خطأ أثناء ضغط الملف: ' + err.message, 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSaveCompressedAudio = async () => {
    if (!audioTargetEpisode || !compressionResult) return;
    setIsSavingAudio(true);
    try {
      await saveAudioToEpisode(audioTargetEpisode.docId, compressionResult.base64DataUrl);
      triggerToast('تم حفظ التسجيل الصوتي المضغوط في السحابة بنجاح! 🎵', 'success');
      setIsAudioModalOpen(false);
    } catch (err: any) {
      triggerToast('فشل حفظ الصوت: ' + err.message, 'error');
    } finally {
      setIsSavingAudio(false);
    }
  };

  const handleSaveUrlAudio = async () => {
    if (!audioTargetEpisode) return;
    const url = audioUrlInput.trim();
    if (!url) {
      triggerToast('يرجى كتابة الرابط الصوتي أولاً', 'error');
      return;
    }
    setIsSavingAudio(true);
    try {
      await saveAudioToEpisode(audioTargetEpisode.docId, url);
      triggerToast('تم حفظ الرابط الصوتي بنجاح! 🎵', 'success');
      setIsAudioModalOpen(false);
    } catch (err: any) {
      triggerToast('خطأ في حفظ الرابط: ' + err.message, 'error');
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
          triggerToast('تمت إزالة المقطع الصوتي للحلقة', 'info');
          setIsAudioModalOpen(false);
        } catch (err: any) {
          triggerToast('تعذّر الحذف: ' + err.message, 'error');
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
          triggerToast('تعذّر العثور على المقطع الصوتي', 'error');
          return;
        }
        const audio = new Audio(playableUrl);
        previewAudioRef.current = audio;
        audio.play().catch(() => triggerToast('تعذّر تشغيل الرابط الصوتي', 'error'));
        audio.onended = () => setPlayingAudioId(null);
        setPlayingAudioId(ep.docId);
      } catch (e: any) {
        triggerToast('خطأ في تشغيل المقطع: ' + e.message, 'error');
      }
    }
  };

  // ==================== SITE SETTINGS ACTIONS ====================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
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
      triggerToast('تم حفظ إعدادات الموقع وتحديثها في السحابة بنجاح! ⚙️', 'success');
    } catch (e: any) {
      triggerToast('خطأ أثناء الحفظ: ' + e.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveGlobalAudio = async () => {
    const url = globalAudioInput.trim();
    setIsSavingGlobalAudio(true);
    try {
      const docRef = doc(db, 'settings', 'global_audio');
      if (url) {
        await writeBatch(db)
          .set(docRef, { audioUrl: url, updatedAt: serverTimestamp() })
          .commit();
        triggerToast('تم حفظ المقطع الصوتي العام في السحابة! 🎧', 'success');
      } else {
        await deleteDoc(docRef);
        triggerToast('تمت إزالة المقطع العام', 'info');
      }
    } catch (err: any) {
      triggerToast('خطأ: ' + err.message, 'error');
    } finally {
      setIsSavingGlobalAudio(false);
    }
  };

  // ==================== RENDER PIN LOGIN ====================
  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper">
        <Toast toasts={toasts} />
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
      <Toast toasts={toasts} />

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
                        <th style={{ width: '180px' }}>المقطع الصوتي</th>
                        <th style={{ width: '90px' }}>الكلمات</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>الترتيب</th>
                        <th style={{ width: '120px', textAlign: 'center' }}>الإجراءات</th>
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
                                <div className="audio-cell-active">
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
                                    title="تعديل أو استبدال الصوت"
                                  >
                                    <span>{isBase64 ? 'مضغوط Base64 ✓' : 'رابط خارجي ✓'}</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="audio-add-prompt-btn"
                                  onClick={() => handleOpenAudioModal(ep)}
                                >
                                  <UploadCloud size={13} />
                                  <span>رفع صوت مضغوط</span>
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
            <section className="admin-toolbar-card">
              <div className="admin-actions-bar">
                <div className="actions-primary">
                  <button className="btn-gold" onClick={handleOpenAddSeries}>
                    <FolderPlus size={18} />
                    <span>إضافة سلسلة جديدة</span>
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
                  <p>مقطع صوتي يظهر في أسفل صفحة القراءة كمقدمة شاملة</p>
                </div>
              </div>

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
                    className="btn-gold"
                    onClick={handleSaveGlobalAudio}
                    disabled={isSavingGlobalAudio}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {isSavingGlobalAudio ? 'جارٍ الحفظ...' : 'حفظ المقطع'}
                  </button>
                </div>
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

                <div className="form-group">
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
                      onChange={(e) => setFormEra(e.target.value)}
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
                </div>
              </div>

              {/* Title & Subtitle */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">عنوان الحلقة</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="مثال: ظلام مطبق ويأس قاتل"
                    required
                  />
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

              {/* Text Body */}
              <div className="form-group">
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
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="اكتب أو الصق نص الحلقة الشريفة هنا..."
                  required
                />
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
              <div className="form-group">
                <label className="form-label">اسم السلسلة / المرحلة</label>
                <input
                  type="text"
                  className="form-input"
                  value={seriesTitleInput}
                  onChange={(e) => setSeriesTitleInput(e.target.value)}
                  placeholder="مثال: العهد المكي أو الغزوات والسرايا"
                  required
                />
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
                <button type="submit" className="btn-gold" disabled={isSavingSeries}>
                  {isSavingSeries ? 'جارٍ الحفظ...' : 'حفظ السلسلة'}
                </button>
              </div>
            </form>
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
                <Sparkles size={20} style={{ color: 'var(--gold)' }} />
                <h3>رفع وضغط صوت: {audioTargetEpisode.title}</h3>
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
                className={`audio-tab-btn ${audioUploadTab === 'upload' ? 'active' : ''}`}
                onClick={() => setAudioUploadTab('upload')}
              >
                <UploadCloud size={16} />
                <span>رفع ملف وضغطه تلقائياً (Base64)</span>
              </button>
              <button
                className={`audio-tab-btn ${audioUploadTab === 'url' ? 'active' : ''}`}
                onClick={() => setAudioUploadTab('url')}
              >
                <Link2 size={16} />
                <span>رابط خارجي مباشر</span>
              </button>
            </div>

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

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
  Mic,
  Headphones,
  FileText,
  Search,
  Check,
  X,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Key,
  ExternalLink,
  Play,
  Pause,
  AlertTriangle,
} from 'lucide-react';

import { Episode, GlobalAudio, ThemeType } from '@/types';
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
} from 'firebase/firestore';

import { Toast, ToastMessage } from '@/components/Toast';

export default function AdminPage() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isChangingPin, setIsChangingPin] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');

  // Data State
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [globalAudio, setGlobalAudio] = useState<GlobalAudio | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEra, setSelectedEra] = useState<string>('all');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals
  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState<boolean>(false);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);
  const [audioTargetEpisode, setAudioTargetEpisode] = useState<Episode | null>(null);
  const [isGlobalAudioModalOpen, setIsGlobalAudioModalOpen] = useState<boolean>(false);

  // Form State for Episode
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formEra, setFormEra] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSubtitle, setFormSubtitle] = useState<string>('');
  const [formContent, setFormContent] = useState<string>('');
  const [formAudioUrl, setFormAudioUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Audio Modal State
  const [audioUrlInput, setAudioUrlInput] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recSeconds, setRecSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Global Audio Form
  const [globalAudioInput, setGlobalAudioInput] = useState<string>('');
  const [isGlobalSaving, setIsGlobalSaving] = useState<boolean>(false);

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
    setIsChangingPin(false);
    setNewPin('');
    setConfirmPin('');
    triggerToast('تم تحديث رمز المرور بنجاح!', 'success');
  };

  // Fetch Episodes from Firestore
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
        console.error('Admin Firestore error:', err);
        triggerToast('خطأ في جلب البيانات: ' + err.message, 'error');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated]);

  // Fetch Global Audio
  useEffect(() => {
    if (!isAuthenticated) return;
    const docRef = doc(db, 'settings', 'global_audio');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GlobalAudio;
        setGlobalAudio(data);
        setGlobalAudioInput(data.audioUrl || '');
      } else {
        setGlobalAudio(null);
        setGlobalAudioInput('');
      }
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  // Distinct Eras for filter
  const distinctEras = useMemo(() => {
    const set = new Set<string>();
    episodes.forEach((ep) => {
      if (ep.era) set.add(ep.era);
    });
    return Array.from(set);
  }, [episodes]);

  // Filtered Episodes
  const filteredEpisodes = useMemo(() => {
    return episodes.filter((ep) => {
      const matchEra = selectedEra === 'all' || ep.era === selectedEra;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        ep.title.toLowerCase().includes(q) ||
        (ep.subtitle && ep.subtitle.toLowerCase().includes(q)) ||
        ep.era.toLowerCase().includes(q) ||
        ep.html.toLowerCase().includes(q);
      return matchEra && matchQuery;
    });
  }, [episodes, selectedEra, searchQuery]);

  // Stats Calculations
  const stats = useMemo(() => {
    const total = episodes.length;
    const withAudio = episodes.filter((ep) => !!ep.audioUrl).length;
    let totalWords = 0;
    episodes.forEach((ep) => {
      const text = ep.html.replace(/<[^>]+>/g, '').trim();
      totalWords += text ? text.split(/\s+/).length : 0;
    });
    return { total, withAudio, totalWords };
  }, [episodes]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingEpisode(null);
    setFormOrder(episodes.length + 1);
    setFormEra(episodes.length > 0 ? episodes[episodes.length - 1].era : 'الجزيرة العربية في العصر الجاهلي');
    setFormTitle('');
    setFormSubtitle(`الحلقة ${String(episodes.length + 1).padStart(3, '0')}`);
    setFormContent('');
    setFormAudioUrl('');
    setIsEpisodeModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (ep: Episode) => {
    setEditingEpisode(ep);
    setFormOrder(ep.order || 1);
    setFormEra(ep.era || '');
    setFormTitle(ep.title || '');
    setFormSubtitle(ep.subtitle || '');
    const plain = (ep.html || '').replace(/<p>/gi, '').replace(/<\/p>/gi, '\n\n').trim();
    setFormContent(plain);
    setFormAudioUrl(ep.audioUrl || '');
    setIsEpisodeModalOpen(true);
  };

  // Save Episode (Add or Update)
  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEra.trim() || !formTitle.trim() || !formContent.trim()) {
      triggerToast('يرجى ملء الحقول الأساسية: المرحلة، العنوان، ونَص الحلقة', 'error');
      return;
    }

    setIsSaving(true);
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
          audioUrl: formAudioUrl.trim() || null,
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
          audioUrl: formAudioUrl.trim() || null,
          createdAt: serverTimestamp(),
        });
        triggerToast('تمت إضافة الحلقة الجديدة بنجاح! 🌟', 'success');
      }
      setIsEpisodeModalOpen(false);
    } catch (err: any) {
      triggerToast('فشل الحفظ في السحابة: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Episode
  const handleDeleteEpisode = async (ep: Episode) => {
    if (!confirm(`تحذير: هل أنت متأكد تماماً من حذف حلقة: "${ep.title}" نهائياً من السحابة؟`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'episodes', ep.docId));
      triggerToast('تم حذف الحلقة من السحابة بنجاح', 'info');
    } catch (err: any) {
      triggerToast('تعذّر الحذف: ' + err.message, 'error');
    }
  };

  // Move Episode Order
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
      triggerToast('خطأ في تغيير الترتيب: ' + err.message, 'error');
    }
  };

  // Reset to Initial Seed Data
  const handleResetSeed = async () => {
    if (
      !confirm(
        'هل تريد استعادة وتحديث الحلقات الـ 8 الأساسية للسيرة النبوية من النسخة المعتمدة؟ (لن يتم حذف الحلقات الإضافية إلا إذا وافقت)'
      )
    ) {
      return;
    }

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
      triggerToast('تمت إضافة الحلقات الأساسية الـ 8 بنجاح!', 'success');
    } catch (err: any) {
      triggerToast('فشل الاستعادة: ' + err.message, 'error');
    }
  };

  // Audio Manager Handlers
  const handleOpenAudioModal = (ep: Episode) => {
    setAudioTargetEpisode(ep);
    setAudioUrlInput(ep.audioUrl || '');
    setIsRecording(false);
    setIsAudioModalOpen(true);
  };

  const handleSaveEpisodeAudio = async () => {
    if (!audioTargetEpisode) return;
    try {
      await updateDoc(doc(db, 'episodes', audioTargetEpisode.docId), {
        audioUrl: audioUrlInput.trim() || null,
        updatedAt: serverTimestamp(),
      });
      triggerToast('تم تحديث الرابط الصوتي للحلقة بنجاح! 🎵', 'success');
      setIsAudioModalOpen(false);
    } catch (err: any) {
      triggerToast('خطأ في حفظ الرابط: ' + err.message, 'error');
    }
  };

  const handleRemoveEpisodeAudio = async () => {
    if (!audioTargetEpisode) return;
    if (!confirm('هل تريد حذف المقطع الصوتي لهذه الحلقة؟')) return;
    try {
      await updateDoc(doc(db, 'episodes', audioTargetEpisode.docId), {
        audioUrl: null,
        updatedAt: serverTimestamp(),
      });
      triggerToast('تم حذف المقطع الصوتي للحلقة', 'info');
      setIsAudioModalOpen(false);
    } catch (err: any) {
      triggerToast('تعذّر الحذف: ' + err.message, 'error');
    }
  };

  // Microphone Recording in Admin
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      triggerToast('المتصفح لا يدعم التسجيل بالميكروفون', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err: any) {
      triggerToast('تعذر الوصول للميكروفون، يرجى منح الإذن', 'error');
      return;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { audioBitsPerSecond: 32000 });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (chunksRef.current.length === 0) return;

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        if (dataUrl.length > 900000) {
          triggerToast('التسجيل طويل جداً على السعة المباشرة، يُفضل وضع رابط MP3 خارجي (Archive.org)', 'error');
          return;
        }
        if (audioTargetEpisode) {
          try {
            await updateDoc(doc(db, 'episodes', audioTargetEpisode.docId), {
              audioUrl: dataUrl,
              updatedAt: serverTimestamp(),
            });
            triggerToast('تم حفظ التسجيل الصوتي في السحابة بنجاح! 🎙️', 'success');
            setIsAudioModalOpen(false);
          } catch (e: any) {
            triggerToast('خطأ أثناء الحفظ: ' + e.message, 'error');
          }
        }
      };
      reader.readAsDataURL(blob);
    };

    recorder.start();
    setIsRecording(true);
    setRecSeconds(0);
    timerIntervalRef.current = setInterval(() => {
      setRecSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = (discard = false) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (discard) chunksRef.current = [];
      mediaRecorderRef.current.stop();
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  // Global Audio Save
  const handleSaveGlobalAudio = async () => {
    const url = globalAudioInput.trim();
    setIsGlobalSaving(true);
    try {
      const docRef = doc(db, 'settings', 'global_audio');
      if (url) {
        await writeBatch(db)
          .set(docRef, { audioUrl: url, updatedAt: serverTimestamp() })
          .commit();
        triggerToast('تم حفظ رابط المقطع الصوتي العام في Firestore بنجاح! 🎧', 'success');
      } else {
        await deleteDoc(docRef);
        triggerToast('تم حذف المقطع الصوتي العام', 'info');
      }
      setIsGlobalAudioModalOpen(false);
    } catch (err: any) {
      triggerToast('خطأ في حفظ المقطع العام: ' + err.message, 'error');
    } finally {
      setIsGlobalSaving(false);
    }
  };

  // Audio Preview Toggle
  const togglePlayPreview = (epId: string, url: string) => {
    if (playingAudioId === epId) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.play().catch(() => triggerToast('تعذّر تشغيل الرابط الصوتي', 'error'));
      audio.onended = () => setPlayingAudioId(null);
      setPlayingAudioId(epId);
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
          <p>أدخل رمز المرور المخصص للإدارة لتعديل الحلقات وإضافة المقاطع الصوتية</p>

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
            الرمز الافتراضي: <code>1234</code> (يمكنك تغييره من داخل اللوحة)
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER ADMIN DASHBOARD ====================
  return (
    <div className="admin-page-container">
      <Toast toasts={toasts} />

      {/* Admin Top Header */}
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
              onClick={() => setIsChangingPin(true)}
              title="تغيير رمز المرور"
            >
              <Key size={16} />
              <span>تغيير الرمز</span>
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

      {/* Main Admin Content */}
      <main className="admin-main-wrap">
        {/* Stats Grid */}
        <section className="admin-stats-grid">
          <div className="stat-card">
            <div className="stat-icon gold">
              <FileText size={24} />
            </div>
            <div className="stat-data">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">إجمالي الحلقات</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon emerald">
              <Volume2 size={24} />
            </div>
            <div className="stat-data">
              <span className="stat-value">{stats.withAudio}</span>
              <span className="stat-label">حلقات بها تسجيل صوتي</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue">
              <Headphones size={24} />
            </div>
            <div className="stat-data">
              <span className="stat-value">
                {globalAudio?.audioUrl ? 'مفعّل 🎧' : 'غير مضاف'}
              </span>
              <span className="stat-label">المقطع الصوتي العام</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon amber">
              <Check size={24} />
            </div>
            <div className="stat-data">
              <span className="stat-value">{stats.totalWords.toLocaleString('ar-EG')}</span>
              <span className="stat-label">إجمالي الكلمات تقريباً</span>
            </div>
          </div>
        </section>

        {/* Global Controls & Actions */}
        <section className="admin-toolbar-card">
          <div className="admin-actions-bar">
            <div className="actions-primary">
              <button className="btn-gold" onClick={handleOpenAdd}>
                <Plus size={18} />
                <span>إضافة حلقة جديدة</span>
              </button>

              <button
                className="tool-btn"
                onClick={() => setIsGlobalAudioModalOpen(true)}
              >
                <Headphones size={16} />
                <span>إدارة المقطع الصوتي العام</span>
              </button>

              <button
                className="tool-btn"
                onClick={handleResetSeed}
                title="استعادة الـ 8 حلقات التأسيسية"
              >
                <RefreshCw size={15} />
                <span>استعادة الحلقات الأساسية</span>
              </button>
            </div>

            <div className="filters-row">
              {/* Era Filter */}
              <select
                className="form-input"
                style={{ width: 'auto', minWidth: '180px', padding: '8px 12px' }}
                value={selectedEra}
                onChange={(e) => setSelectedEra(e.target.value)}
              >
                <option value="all">كل المراحل والعصور ({episodes.length})</option>
                {distinctEras.map((era) => (
                  <option key={era} value={era}>
                    {era} ({episodes.filter((ep) => ep.era === era).length})
                  </option>
                ))}
              </select>

              {/* Search Box */}
              <div className="admin-search-wrap">
                <Search size={16} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="بحث في العنوان أو النص..."
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
            <h3>قائمة حلقات السيرة النبوية ({filteredEpisodes.length})</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              جميع التعديلات والحذف تُحفظ مباشرة في قاعدة بيانات Firestore السحابية
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
                    <th style={{ width: '60px' }}>#</th>
                    <th style={{ width: '180px' }}>المرحلة</th>
                    <th>عنوان الحلقة</th>
                    <th style={{ width: '150px' }}>المقطع الصوتي</th>
                    <th style={{ width: '90px' }}>الكلمات</th>
                    <th style={{ width: '110px' }}>الترتيب</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEpisodes.map((ep, idx) => {
                    const wordsCount = ep.html.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
                    const isAudioPlaying = playingAudioId === ep.docId;

                    return (
                      <tr key={ep.docId} className="admin-table-row">
                        <td>
                          <span className="order-badge">{ep.order || idx + 1}</span>
                        </td>
                        <td>
                          <span className="era-badge">{ep.era}</span>
                        </td>
                        <td>
                          <div className="title-cell">
                            <strong className="ep-title-text">{ep.title}</strong>
                            <span className="ep-subtitle-text">{ep.subtitle || '—'}</span>
                          </div>
                        </td>
                        <td>
                          {ep.audioUrl ? (
                            <div className="audio-cell-active">
                              <button
                                className={`audio-play-mini-btn ${isAudioPlaying ? 'playing' : ''}`}
                                onClick={() => togglePlayPreview(ep.docId, ep.audioUrl!)}
                                title={isAudioPlaying ? 'إيقاف المعاينة' : 'معاينة الصوت'}
                              >
                                {isAudioPlaying ? <Pause size={13} /> : <Play size={13} />}
                              </button>
                              <button
                                className="audio-link-tag"
                                onClick={() => handleOpenAudioModal(ep)}
                                title="تعديل الرابط الصوتي"
                              >
                                <span>مضاف ✓</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              className="audio-add-prompt-btn"
                              onClick={() => handleOpenAudioModal(ep)}
                            >
                              <Plus size={13} />
                              <span>إضافة صوت</span>
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
                              onClick={() => handleOpenEdit(ep)}
                              title="تعديل محتوى الحلقة"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              className="action-icon-btn danger"
                              onClick={() => handleDeleteEpisode(ep)}
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
      </main>

      {/* ==================== MODAL: ADD / EDIT EPISODE ==================== */}
      {isEpisodeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEpisodeModalOpen(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto' }}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '14px' }}>
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
                  <label className="form-label">المرحلة / العصر</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formEra}
                    onChange={(e) => setFormEra(e.target.value)}
                    placeholder="مثال: الجزيرة العربية في العصر الجاهلي أو العهد المكي"
                    required
                  />
                </div>
              </div>

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

              <div className="form-group">
                <label className="form-label">
                  رابط المقطع الصوتي للحلقة (اختياري - MP3 مباشر مثل روابط Archive.org)
                </label>
                <input
                  type="url"
                  className="form-input"
                  value={formAudioUrl}
                  onChange={(e) => setFormAudioUrl(e.target.value)}
                  placeholder="https://ia800.../episode1.mp3"
                />
              </div>

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
                  disabled={isSaving}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-gold" disabled={isSaving}>
                  {isSaving ? 'جارٍ الحفظ في السحابة...' : 'حفظ ونشر في السحابة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: AUDIO MANAGER FOR EPISODE ==================== */}
      {isAudioModalOpen && audioTargetEpisode && (
        <div className="modal-overlay" onClick={() => setIsAudioModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>إدارة المقطع الصوتي للحلقة: {audioTargetEpisode.title}</h3>
              <button
                className="modal-close-btn"
                onClick={() => {
                  stopRecording(true);
                  setIsAudioModalOpen(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">رابط المقطع الصوتي (رابط MP3 مجاني مباشر)</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://archive.org/download/.../track.mp3"
                value={audioUrlInput}
                onChange={(e) => setAudioUrlInput(e.target.value)}
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.6' }}>
                💡 نصيحة: يمكنك رفع ملفات MP3 مجاناً بدون حدود على موقع <strong>Archive.org</strong> ووضع الرابط المباشر هنا، ليعمل الموقع مجاناً 100% دون الحاجة لاشتراكات مدفوعة.
              </p>
            </div>

            {/* Microphone Recording Option */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginBottom: '16px' }}>
              <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--gold)', marginBottom: '8px' }}>
                أو تسجيل صوتك مباشرة بالميكروفون (يُحفظ في السحابة مجاناً):
              </span>

              {isRecording ? (
                <div className="rec-box">
                  <div className="rec-pulse-dot" />
                  <div className="rec-timer">
                    {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:
                    {String(recSeconds % 60).padStart(2, '0')}
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
                    جارٍ التسجيل...
                  </span>
                  <button
                    className="btn-gold"
                    onClick={() => stopRecording(false)}
                    style={{ background: '#ef4444', color: '#fff' }}
                  >
                    إنهاء وحفظ
                  </button>
                </div>
              ) : (
                <button className="tool-btn accent" onClick={startRecording}>
                  <Mic size={16} />
                  <span>بدء التسجيل بالميكروفون</span>
                </button>
              )}
            </div>

            <div className="modal-actions">
              {audioTargetEpisode.audioUrl && (
                <button
                  type="button"
                  className="tool-btn danger-action"
                  style={{ marginLeft: 'auto' }}
                  onClick={handleRemoveEpisodeAudio}
                >
                  إزالة المقطع الصوتي
                </button>
              )}
              <button
                type="button"
                className="tool-btn"
                onClick={() => {
                  stopRecording(true);
                  setIsAudioModalOpen(false);
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-gold"
                onClick={handleSaveEpisodeAudio}
              >
                حفظ الرابط الصوتي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: GLOBAL AUDIO ==================== */}
      {isGlobalAudioModalOpen && (
        <div className="modal-overlay" onClick={() => setIsGlobalAudioModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>المقطع الصوتي العام للسيرة</h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsGlobalAudioModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.6' }}>
              هذا المقطع يظهر في أسفل صفحة القراءة للمستخدمين كمقدمة شاملة أو تسجيل عام للسيرة الشريفة.
            </p>

            <div className="form-group">
              <label className="form-label">رابط المقطع الصوتي (MP3 مباشر)</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://example.com/audio.mp3"
                value={globalAudioInput}
                onChange={(e) => setGlobalAudioInput(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="tool-btn"
                onClick={() => setIsGlobalAudioModalOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-gold"
                onClick={handleSaveGlobalAudio}
                disabled={isGlobalSaving}
              >
                {isGlobalSaving ? 'جارٍ الحفظ...' : 'حفظ في السحابة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CHANGE PIN ==================== */}
      {isChangingPin && (
        <div className="modal-overlay" onClick={() => setIsChangingPin(false)}>
          <div className="modal-card" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تغيير رمز المرور</h3>
              <button className="modal-close-btn" onClick={() => setIsChangingPin(false)}>
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
                  onClick={() => setIsChangingPin(false)}
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
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Episode } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

interface EpisodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  episode: Episode | null;
  totalEpisodes: number;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const EpisodeModal: React.FC<EpisodeModalProps> = ({
  isOpen,
  onClose,
  episode,
  totalEpisodes,
  onToast,
}) => {
  const isEdit = !!episode;
  const [era, setEra] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (episode) {
      setEra(episode.era || '');
      setTitle(episode.title || '');
      setSubtitle(episode.subtitle || '');
      // Strip HTML tags for clean text editing
      const plain = (episode.html || '').replace(/<p>/gi, '').replace(/<\/p>/gi, '\n\n').trim();
      setContent(plain);
    } else {
      setEra('الجزيرة العربية في العصر الجاهلي');
      setTitle('');
      setSubtitle(`الحلقة ${String(totalEpisodes + 1).padStart(3, '0')}`);
      setContent('');
    }
  }, [episode, totalEpisodes, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!era.trim() || !title.trim() || !content.trim()) {
      onToast('يرجى ملء كافة الحقول الأساسية', 'error');
      return;
    }

    setIsSaving(true);
    // Wrap paragraphs in <p>
    const formattedHtml = content
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
      .join('\n');

    try {
      if (isEdit && episode) {
        await updateDoc(doc(db, 'episodes', episode.docId), {
          era: era.trim(),
          title: title.trim(),
          subtitle: subtitle.trim(),
          html: formattedHtml,
          updatedAt: serverTimestamp(),
        });
        onToast('تم تحديث الحلقة في السحابة بنجاح! ✓', 'success');
      } else {
        await addDoc(collection(db, 'episodes'), {
          order: totalEpisodes + 1,
          era: era.trim(),
          title: title.trim(),
          subtitle: subtitle.trim(),
          html: formattedHtml,
          audioUrl: null,
          createdAt: serverTimestamp(),
        });
        onToast('تمت إضافة الحلقة الجديدة إلى السحابة بنجاح! 🌟', 'success');
      }
      onClose();
    } catch (err: any) {
      onToast('حدث خطأ أثناء الحفظ في السحابة: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'تعديل حلقة' : 'إضافة حلقة جديدة للسيرة'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">المرحلة / العصر</label>
            <input
              type="text"
              className="form-input"
              value={era}
              onChange={(e) => setEra(e.target.value)}
              placeholder="مثال: الجزيرة العربية في العصر الجاهلي"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">عنوان الحلقة</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: ظلام مطبق ويأس قاتل"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">الوصف الفرعي (اختياري)</label>
            <input
              type="text"
              className="form-input"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="مثال: الحلقة 008"
            />
          </div>

          <div className="form-group">
            <label className="form-label">نص الحلقة (افصل بين الفقرات بسطر فارغ)</label>
            <textarea
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب نص الحلقة بالتفصيل هنا..."
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="tool-btn"
              onClick={onClose}
              disabled={isSaving}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="btn-gold"
              disabled={isSaving}
            >
              {isSaving ? 'جارٍ الحفظ في السحابة...' : 'حفظ في السحابة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

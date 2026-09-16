'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import { Reflection } from '@/types';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

interface ReflectionsProps {
  episodeId: string;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const Reflections: React.FC<ReflectionsProps> = ({ episodeId, onToast }) => {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!episodeId) return;

    const q = query(
      collection(db, 'reflections'),
      where('episodeId', '==', episodeId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Reflection[];
        // Sort descending by date
        items.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setReflections(items);
      },
      (err) => console.warn('Reflections listener error:', err)
    );

    return () => unsubscribe();
  }, [episodeId]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'reflections'), {
        episodeId,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      setText('');
      setIsOpen(false);
      onToast('تم حفظ التأمل في السحابة بنجاح! 💡', 'success');
    } catch (e: any) {
      onToast('تعذّر حفظ التأمل: ' + e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا التأمل؟')) return;
    try {
      await deleteDoc(doc(db, 'reflections', id));
      onToast('تم حذف التأمل.', 'info');
    } catch (e: any) {
      onToast('تعذّر الحذف: ' + e.message, 'error');
    }
  };

  return (
    <div className="reflections-section">
      <div className="reflections-header">
        <div className="reflections-title">
          <Lightbulb size={18} />
          <span>تأملات وفوائد من الحلقة ({reflections.length})</span>
        </div>
        <button
          className="tool-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Plus size={14} />
          <span>إضافة تأمل</span>
        </button>
      </div>

      {isOpen && (
        <div className="reflection-input-box" style={{ marginBottom: '16px' }}>
          <textarea
            className="reflection-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب هنا فائدة أو تأملاً أو خاطرة استفدتها من هذه الحلقة المباركة..."
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              className="btn-gold"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ التأمل'}
            </button>
            <button
              className="tool-btn"
              onClick={() => {
                setIsOpen(false);
                setText('');
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {reflections.length === 0 && !isOpen ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          لا توجد تأملات مسجلة لهذه الحلقة بعد. اضغط على «إضافة تأمل» لتسجيل خواطرك.
        </p>
      ) : (
        reflections.map((r) => {
          let dateStr = 'الآن';
          if (r.createdAt?.toDate) {
            dateStr = r.createdAt.toDate().toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
          }
          return (
            <div key={r.id} className="reflection-item">
              <p>{r.text}</p>
              <div className="reflection-meta">
                <span>{dateStr}</span>
                <button
                  className="reflection-del-btn"
                  onClick={() => handleDelete(r.id)}
                  title="حذف التأمل"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

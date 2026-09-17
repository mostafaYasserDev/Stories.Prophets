'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, Plus, Trash2, Heart, User, Send, AlertTriangle, X } from 'lucide-react';
import { Reflection } from '@/types';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  increment,
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
  const [authorName, setAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Load saved author name and liked reflections from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('seerah_author_name') || '';
      setAuthorName(savedName);
      const savedLikes = new Set<string>(
        JSON.parse(localStorage.getItem('seerah_reflection_likes') || '[]')
      );
      setLikedIds(savedLikes);
    }
  }, []);

  // Real-time reflections listener
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

    const finalAuthor = authorName.trim() || 'قارئ متدبر';

    try {
      if (typeof window !== 'undefined' && authorName.trim()) {
        localStorage.setItem('seerah_author_name', authorName.trim());
      }

      await addDoc(collection(db, 'reflections'), {
        episodeId,
        text: text.trim(),
        author: finalAuthor,
        likesCount: 0,
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

  const handleToggleLike = async (reflection: Reflection) => {
    const isAlreadyLiked = likedIds.has(reflection.id);
    const updated = new Set(likedIds);

    if (isAlreadyLiked) {
      updated.delete(reflection.id);
      setLikedIds(updated);
      localStorage.setItem('seerah_reflection_likes', JSON.stringify(Array.from(updated)));
      try {
        await updateDoc(doc(db, 'reflections', reflection.id), {
          likesCount: increment(-1),
        });
      } catch (e) { }
    } else {
      updated.add(reflection.id);
      setLikedIds(updated);
      localStorage.setItem('seerah_reflection_likes', JSON.stringify(Array.from(updated)));
      try {
        await updateDoc(doc(db, 'reflections', reflection.id), {
          likesCount: increment(1),
        });
      } catch (e) { }
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteDoc(doc(db, 'reflections', confirmDeleteId));
      onToast('تم حذف التأمل بنجاح', 'info');
    } catch (e: any) {
      onToast('تعذّر الحذف: ' + e.message, 'error');
    } finally {
      setConfirmDeleteId(null);
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
          type="button"
          className="tool-btn"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Plus size={14} />
          <span>{isOpen ? 'إغلاق' : 'إضافة تأمل'}</span>
        </button>
      </div>

      {isOpen && (
        <div className="reflection-input-box" style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '0.82rem', padding: '8px 12px' }}
              placeholder="اسمك أو كنيتك (اختياري، مثلاً: أبو أنس، سارة...)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </div>

          <textarea
            className="reflection-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب هنا فائدة أو تأملاً أو خاطرة استفدتها من هذه الحلقة المباركة..."
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              className="btn-gold"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ التأمل'}
            </button>
            <button
              type="button"
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
          لا توجد تأملات مسجلة لهذه الحلقة بعد. اضغط على «إضافة تأمل» لتسجيل خواطرك والفوائد المستفادة.
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
          const isLiked = likedIds.has(r.id);
          const currentLikes = Math.max(0, r.likesCount || 0);

          return (
            <div key={r.id} className="reflection-item">
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>{r.text}</p>
              <div className="reflection-meta">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--gold-light)', fontWeight: 600 }}>
                    <User size={12} />
                    <span>{r.author || 'قارئ متدبر'}</span>
                  </span>
                  <span>•</span>
                  <span>{dateStr}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Like Button */}
                  <button
                    type="button"
                    className="tool-btn"
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.74rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isLiked ? '#ef4444' : 'var(--text-muted)',
                      borderColor: isLiked ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-light)',
                    }}
                    onClick={() => handleToggleLike(r)}
                    title={isLiked ? 'إلغاء الإعجاب' : 'أعجبني هذا التأمل'}
                  >
                    <Heart size={13} fill={isLiked ? '#ef4444' : 'none'} />
                    <span>{currentLikes > 0 ? currentLikes : ''}</span>
                  </button>

                  <button
                    type="button"
                    className="reflection-del-btn"
                    onClick={() => setConfirmDeleteId(r.id)}
                    title="حذف التأمل"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Luxury Confirmation Modal for Reflections Delete */}
      {confirmDeleteId && (
        <div
          className="modal-overlay"
          style={{ zIndex: 160 }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div className="modal-card confirm-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setConfirmDeleteId(null)}
              style={{ position: 'absolute', top: '16px', left: '16px' }}
              title="إغلاق"
            >
              <X size={18} />
            </button>

            <div className="confirm-icon-box">
              <AlertTriangle size={30} />
            </div>

            <h3>تأكيد حذف التأمل</h3>
            <p style={{ lineHeight: '1.7', marginTop: '8px' }}>
              هل تريد بالتأكيد حذف هذا التأمل والمشاركة؟ لا يمكن التراجع عن هذا الإجراء بعد الحذف.
            </p>

            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '24px', gap: '14px' }}>
              <button
                type="button"
                className="tool-btn"
                onClick={() => setConfirmDeleteId(null)}
              >
                <X size={16} />
                <span>تراجع وإلغاء</span>
              </button>
              <button
                type="button"
                className="confirm-danger-btn"
                onClick={confirmDelete}
              >
                <Trash2 size={16} />
                <span>نعم، تأكيد الحذف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

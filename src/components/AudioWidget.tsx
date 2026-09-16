'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Trash2, Edit2, Link, StopCircle, Check } from 'lucide-react';
import { Episode } from '@/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface AudioWidgetProps {
  episode: Episode;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ episode, onToast }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState('1');
  const [isSaving, setIsSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Apply playback speed
  useEffect(() => {
    if (audioElRef.current) {
      audioElRef.current.playbackRate = parseFloat(playbackSpeed);
    }
  }, [playbackSpeed, episode.audioUrl]);

  // Reset when episode changes
  useEffect(() => {
    stopRecording(true);
    setIsFormOpen(false);
    setInputUrl(episode.audioUrl || '');
  }, [episode.docId, episode.audioUrl]);

  // Start microphone recording
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onToast('متصفحك لا يدعم التسجيل المباشر بالميكروفون.', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err: any) {
      onToast('تعذّر الوصول إلى الميكروفون. تأكد من إعطاء الصلاحية للمتصفح.', 'error');
      return;
    }

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      audioBitsPerSecond: 32000, // Compact bitrate for Firestore storage
    });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (chunksRef.current.length === 0) return;

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      // Convert to base64 Data URL and save directly to Firestore (no Storage needed!)
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        // Check size: Firestore document limit is 1MB
        if (dataUrl.length > 900000) {
          onToast('التسجيل طويل جداً على الحفظ المباشر. يُفضل استخدام رابط MP3 خارجي (مثل Archive.org).', 'error');
          return;
        }

        setIsSaving(true);
        try {
          await updateDoc(doc(db, 'episodes', episode.docId), {
            audioUrl: dataUrl,
            updatedAt: serverTimestamp(),
          });
          onToast('تم حفظ التسجيل الصوتي في Firestore بنجاح! 🎙️', 'success');
          setIsFormOpen(false);
        } catch (e: any) {
          onToast('تعذّر حفظ التسجيل: ' + e.message, 'error');
        } finally {
          setIsSaving(false);
        }
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecSeconds(0);

    timerIntervalRef.current = setInterval(() => {
      setRecSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Stop recording
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

  // Save external audio URL to Firestore
  const handleSaveUrl = async () => {
    const url = inputUrl.trim();
    if (!url) {
      onToast('يرجى كتابة رابط الصوت أولاً', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'episodes', episode.docId), {
        audioUrl: url,
        updatedAt: serverTimestamp(),
      });
      onToast('تم حفظ رابط الصوت في Firestore بنجاح! 🎵', 'success');
      setIsFormOpen(false);
    } catch (e: any) {
      onToast('خطأ أثناء الحفظ: ' + e.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete audio
  const handleDeleteAudio = async () => {
    if (!confirm('هل تريد حذف المقطع الصوتي لهذه الحلقة؟')) return;
    try {
      await updateDoc(doc(db, 'episodes', episode.docId), {
        audioUrl: null,
        updatedAt: serverTimestamp(),
      });
      setInputUrl('');
      onToast('تم حذف المقطع الصوتي.', 'info');
    } catch (e: any) {
      onToast('تعذّر الحذف: ' + e.message, 'error');
    }
  };

  const formatTimer = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="audio-player-widget">
      {episode.audioUrl && !isFormOpen ? (
        <>
          <div className="audio-widget-header">
            <div className="audio-title-tag">
              <Mic size={16} />
              <span>مقطع صوتي للحلقة</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                className="speed-select"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(e.target.value)}
                title="سرعة التشغيل"
              >
                <option value="0.75">0.75x</option>
                <option value="1">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
              <button
                className="tool-btn"
                onClick={() => setIsFormOpen(true)}
                title="تغيير المقطع الصوتي"
              >
                <Edit2 size={14} />
              </button>
              <button
                className="tool-btn danger-action"
                onClick={handleDeleteAudio}
                title="إزالة الصوت"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="audio-controls-row">
            <audio ref={audioElRef} controls src={episode.audioUrl} />
          </div>
        </>
      ) : !isFormOpen ? (
        <div className="audio-widget-header">
          <div className="audio-title-tag" style={{ color: 'var(--text-muted)' }}>
            <MicOff size={16} />
            <span>لا يوجد تسجيل صوتي لهذه الحلقة</span>
          </div>
          <button
            className="btn-gold"
            onClick={() => setIsFormOpen(true)}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <Mic size={14} />
            <span>إضافة صوت / رابط MP3</span>
          </button>
        </div>
      ) : (
        /* Audio Options: Enter URL or Record Voice */
        <div>
          <div className="audio-widget-header" style={{ marginBottom: '12px' }}>
            <div className="audio-title-tag">
              <Link size={16} />
              <span>إضافة مقطع صوتي (رابط مجاني أو تسجيل صوتي)</span>
            </div>
            <button
              className="tool-btn"
              onClick={() => {
                stopRecording(true);
                setIsFormOpen(false);
              }}
            >
              إلغاء
            </button>
          </div>

          {/* Option 1: Paste any free audio link */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--gold)', marginBottom: '6px' }}>
              ضع رابط المقطع الصوتي (MP3 من Archive.org أو أي رابط صوتي مباشر):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="url"
                className="form-input"
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                placeholder="https://example.com/audio.mp3"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
              />
              <button
                className="btn-gold"
                onClick={handleSaveUrl}
                disabled={isSaving}
                style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}
              >
                <Check size={16} />
                <span>حفظ الرابط</span>
              </button>
            </div>
          </div>

          {/* Option 2: Microphone voice recording */}
          <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '10px' }}>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              أو سجّل صوتك مباشرة بالميكروفون (يُحفظ مجاناً في Firestore):
            </span>

            {isRecording ? (
              <div className="rec-box">
                <div className="rec-pulse-dot" />
                <div className="rec-timer">{formatTimer(recSeconds)}</div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
                  جارٍ تسجيل صوتك بالميكروفون...
                </span>
                <button
                  className="btn-gold"
                  onClick={() => stopRecording(false)}
                  style={{ background: '#ef4444', color: '#fff' }}
                  disabled={isSaving}
                >
                  <StopCircle size={16} />
                  <span>{isSaving ? 'جارٍ الحفظ...' : 'إنهاء وحفظ'}</span>
                </button>
              </div>
            ) : (
              <button className="tool-btn accent" onClick={startRecording}>
                <Mic size={16} />
                <span>ابدأ التسجيل بالميكروفون</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

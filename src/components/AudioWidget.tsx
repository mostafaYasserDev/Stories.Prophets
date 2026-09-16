'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Pause, Trash2, Edit2, Upload, StopCircle } from 'lucide-react';
import { Episode } from '@/types';
import { storage, db } from '@/lib/firebase';
import { ref as sRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface AudioWidgetProps {
  episode: Episode;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ episode, onToast }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState('1');

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

  // Clean up on unmount or episode change
  useEffect(() => {
    stopRecording(true);
    setIsFormOpen(false);
  }, [episode.docId]);

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
      onToast('تعذّر الوصول إلى الميكروفون. تأكد من إعطاء الصلاحية.', 'error');
      return;
    }

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current);
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

      const mime = mediaRecorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      uploadAudioBlob(blob, 'mic_recording.webm');
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

  // Upload to Firebase Storage
  const uploadAudioBlob = (fileOrBlob: Blob, filename = 'audio.mp3') => {
    setUploadProgress(0);
    const storagePath = `episodes_audio/${episode.docId}_${Date.now()}_${filename}`;
    const fileRef = sRef(storage, storagePath);
    const uploadTask = uploadBytesResumable(fileRef, fileOrBlob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(percent);
      },
      (error) => {
        console.error('Storage upload error:', error);
        onToast('فشل رفع التسجيل الصوتي: ' + error.message, 'error');
        setUploadProgress(null);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, 'episodes', episode.docId), {
            audioUrl: downloadUrl,
            updatedAt: serverTimestamp(),
          });
          onToast('تم رفع وحفظ التسجيل في السحابة بنجاح! 🎙️', 'success');
          setIsFormOpen(false);
        } catch (e: any) {
          onToast('تعذّر حفظ رابط الصوت في السحابة: ' + e.message, 'error');
        } finally {
          setUploadProgress(null);
        }
      }
    );
  };

  // Delete audio
  const handleDeleteAudio = async () => {
    if (!confirm('هل تريد حذف المقطع الصوتي لهذه الحلقة نهائياً؟')) return;
    try {
      await updateDoc(doc(db, 'episodes', episode.docId), {
        audioUrl: null,
        updatedAt: serverTimestamp(),
      });
      onToast('تم حذف التسجيل الصوتي.', 'info');
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
              <span>تسجيل صوتي لهذه الحلقة</span>
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
                title="إزالة التسجيل"
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
            <span>لا يوجد تسجيل صوتي لهذه الحلقة بعد</span>
          </div>
          <button
            className="btn-gold"
            onClick={() => setIsFormOpen(true)}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <Mic size={14} />
            <span>تسجيل أو رفع صوت</span>
          </button>
        </div>
      ) : (
        /* Recording / Uploading Form */
        <div>
          <div className="audio-widget-header" style={{ marginBottom: '10px' }}>
            <div className="audio-title-tag">
              <Mic size={16} />
              <span>تسجيل صوتي مباشر أو رفع ملف</span>
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
              >
                <StopCircle size={16} />
                <span>إنهاء ورفع</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn-gold" onClick={startRecording}>
                <Mic size={16} />
                <span>ابدأ التسجيل بالميكروفون</span>
              </button>
              <label className="tool-btn" style={{ cursor: 'pointer' }}>
                <Upload size={16} />
                <span>اختيار ملف من جهازك</span>
                <input
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0];
                    if (file) uploadAudioBlob(file, file.name);
                  }}
                />
              </label>
            </div>
          )}

          {uploadProgress !== null && (
            <div className="upload-progress-bar" style={{ marginTop: '10px' }}>
              <div
                className="upload-progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Volume2,
  Gauge,
  Sparkles,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { VoiceOption } from '@/hooks/useTextToSpeech';

interface TtsFloatingBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  currentSentenceIndex: number;
  totalSentences: number;
  rate: number;
  voices: VoiceOption[];
  selectedVoiceId: string;
  onPlayPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSetRate: (rate: number) => void;
  onSetVoice: (voiceId: string) => void;
  onClose: () => void;
}

export const TtsFloatingBar: React.FC<TtsFloatingBarProps> = ({
  isPlaying,
  isPaused,
  currentSentenceIndex,
  totalSentences,
  rate,
  voices,
  selectedVoiceId,
  onPlayPause,
  onStop,
  onNext,
  onPrev,
  onSetRate,
  onSetVoice,
  onClose,
}) => {
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);

  const progressPercent =
    totalSentences > 0 && currentSentenceIndex >= 0
      ? Math.round(((currentSentenceIndex + 1) / totalSentences) * 100)
      : 0;

  const currentVoice = voices.find((v) => v.id === selectedVoiceId) || voices[0];

  return (
    <div className="tts-floating-container" dir="rtl">
      {/* Mini Progress Bar on Top of Bar */}
      <div className="tts-floating-progress-track">
        <div
          className="tts-floating-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="tts-floating-bar-inner">
        {/* Left Side: Status & Sentence Tracker */}
        <div className="tts-info-group">
          <div className="tts-live-pulse-icon">
            <Volume2 size={18} className={isPlaying && !isPaused ? 'animate-pulse' : ''} />
          </div>
          <div className="tts-labels">
            <span className="tts-title">
              {currentVoice?.type === 'neural' ? 'القارئ الآلي العصبي 🎙️' : 'القارئ الآلي الذكي'}
            </span>
            <span className="tts-counter">
              {currentSentenceIndex >= 0
                ? `جملة ${currentSentenceIndex + 1} من ${totalSentences} (${progressPercent}%)`
                : `جاهز للقراءة (${totalSentences} جملة)`}
            </span>
          </div>
        </div>

        {/* Center: Controls (Prev, Play/Pause, Next, Stop) */}
        <div className="tts-controls-group">
          <button
            type="button"
            className="tts-ctrl-btn"
            onClick={onPrev}
            title="الجملة السابقة"
            disabled={currentSentenceIndex <= 0}
          >
            <SkipForward size={16} />
          </button>

          <button
            type="button"
            className={`tts-play-btn ${isPlaying && !isPaused ? 'playing' : ''}`}
            onClick={onPlayPause}
            title={isPlaying && !isPaused ? 'إيقاف مؤقت' : 'متابعة القراءة'}
          >
            {isPlaying && !isPaused ? <Pause size={18} /> : <Play size={18} style={{ marginRight: '-2px' }} />}
          </button>

          <button
            type="button"
            className="tts-ctrl-btn"
            onClick={onNext}
            title="الجملة التالية"
            disabled={currentSentenceIndex >= totalSentences - 1}
          >
            <SkipBack size={16} />
          </button>

          <button
            type="button"
            className="tts-ctrl-btn stop"
            onClick={onStop}
            title="إيقاف نهائي"
          >
            <Square size={14} />
          </button>
        </div>

        {/* Right Side: Speed Selector, Voice Selector, Close */}
        <div className="tts-settings-group">
          {/* Speed Selector */}
          <div className="tts-rate-pills">
            <Gauge size={14} className="tts-icon-muted" />
            {[0.75, 1.0, 1.25, 1.5].map((s) => (
              <button
                key={s}
                type="button"
                className={`tts-rate-pill ${rate === s ? 'active' : ''}`}
                onClick={() => onSetRate(s)}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Voice Selector */}
          <div className="tts-voice-dropdown-wrapper">
            <button
              type="button"
              className="tts-voice-trigger"
              onClick={() => setIsVoiceMenuOpen(!isVoiceMenuOpen)}
              title="تغيير الصوت واللهجة"
            >
              <Sparkles size={14} style={{ color: 'var(--gold)' }} />
              <span className="tts-voice-name">
                {currentVoice ? currentVoice.name.replace(/🎙️|📱/g, '').trim().slice(0, 14) : 'الصوت'}
              </span>
              {isVoiceMenuOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>

            {isVoiceMenuOpen && (
              <div className="tts-voice-menu">
                <div className="tts-voice-menu-header">اختر القارئ واللهجة المفضلة:</div>
                {voices.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`tts-voice-menu-item ${v.id === selectedVoiceId ? 'active' : ''}`}
                    onClick={() => {
                      onSetVoice(v.id);
                      setIsVoiceMenuOpen(false);
                    }}
                  >
                    <span>{v.name}</span>
                    {v.id === selectedVoiceId && <span className="gold-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Close Floating Bar Button */}
          <button
            type="button"
            className="tts-close-btn"
            onClick={onClose}
            title="إغلاق القارئ الآلي"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

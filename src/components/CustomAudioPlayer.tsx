'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  Radio,
} from 'lucide-react';

interface CustomAudioPlayerProps {
  src: string;
  title?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  downloadFilename?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({
  src,
  title = 'تسجيل استوديو نقي (Gemini AI)',
  durationSeconds,
  sizeBytes,
  downloadFilename = 'تسجيل_قصص_الأنبياء_وسير_الرسول.wav',
  className = '',
  style = {},
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(durationSeconds || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSeekingRef = useRef<boolean>(false);

  const [safeSrc, setSafeSrc] = useState<string>('');

  useEffect(() => {
    if (!src) {
      setSafeSrc('');
      return;
    }
    // If src is a massive Base64 data URL, convert it to a lightweight native Blob URL
    if (src.startsWith('data:audio') && src.length > 20000) {
      try {
        const parts = src.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'audio/mp3';
        const bstr = atob(parts[1] || parts[0]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const b = new Blob([u8arr], { type: mime });
        const objUrl = URL.createObjectURL(b);
        setSafeSrc(objUrl);
        return () => {
          URL.revokeObjectURL(objUrl);
        };
      } catch (e) {
        setSafeSrc(src);
      }
    } else {
      setSafeSrc(src);
    }
  }, [src]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
      audioRef.current.currentTime = 0;
      if (durationSeconds) {
        setDuration(durationSeconds);
      }
    }
  }, [safeSrc, durationSeconds]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !safeSrc) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn('Playback failed:', err));
    }
  }, [isPlaying, safeSrc]);

  const skipTime = useCallback(
    (delta: number) => {
      if (!audioRef.current) return;
      const target = Math.max(0, Math.min(duration || 9999, audioRef.current.currentTime + delta));
      audioRef.current.currentTime = target;
      setCurrentTime(target);
    },
    [duration]
  );

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`studio-custom-player ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(16, 21, 32, 0.95))',
        border: '1px solid rgba(212, 175, 55, 0.35)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 18px',
        boxShadow: '0 10px 28px -6px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(212, 175, 55, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={safeSrc}
        preload="metadata"
        onTimeUpdate={() => {
          if (!isSeekingRef.current && audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || durationSeconds || 0);
            audioRef.current.playbackRate = playbackSpeed;
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={15} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--gold)' }}>
            {title}
          </span>
          {isPlaying && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              <Radio size={11} className="pulse-radio-icon" />
              <span>جاري الاستماع</span>
            </span>
          )}
        </div>

        {/* Animated Sound Waves & Speed Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className={`studio-wave-bars ${isPlaying ? 'is-playing' : ''}`}>
            <span className="studio-wave-bar"></span>
            <span className="studio-wave-bar"></span>
            <span className="studio-wave-bar"></span>
            <span className="studio-wave-bar"></span>
            <span className="studio-wave-bar"></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {[1.0, 1.25, 1.5].map((s) => (
              <button
                key={s}
                type="button"
                className={`speed-pill ${playbackSpeed === s ? 'active' : ''}`}
                onClick={() => handleSpeedChange(s)}
                style={{
                  padding: '2px 7px',
                  fontSize: '0.7rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Controls Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        {/* Playback Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Skip -10s */}
          <button
            type="button"
            className="studio-btn-secondary"
            onClick={() => skipTime(-10)}
            title="تأخير 10 ثوانٍ"
            style={{ width: '36px', height: '36px' }}
          >
            <RotateCcw size={16} />
            <span className="skip-hint" style={{ fontSize: '0.58rem' }}>10-</span>
          </button>

          {/* Big Play / Pause */}
          <button
            type="button"
            className={`studio-btn-play ${isPlaying ? 'is-playing' : ''}`}
            onClick={togglePlay}
            title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            style={{
              width: '46px',
              height: '46px',
              boxShadow: isPlaying ? '0 0 18px rgba(212, 175, 55, 0.6)' : '0 4px 14px rgba(212, 175, 55, 0.35)',
            }}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} style={{ marginRight: '-2px' }} />}
          </button>

          {/* Skip +10s */}
          <button
            type="button"
            className="studio-btn-secondary"
            onClick={() => skipTime(10)}
            title="تقديم 10 ثوانٍ"
            style={{ width: '36px', height: '36px' }}
          >
            <RotateCw size={16} />
            <span className="skip-hint" style={{ fontSize: '0.58rem' }}>10+</span>
          </button>
        </div>

        {/* Seekbar and Timeline */}
        <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--gold)', fontWeight: 600, direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(currentTime)}
            </span>
            <span style={{ direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(duration)}
            </span>
          </div>

          <div className="studio-range-container">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.2"
              value={currentTime}
              onChange={handleSeek}
              onMouseDown={() => {
                isSeekingRef.current = true;
              }}
              onMouseUp={() => {
                isSeekingRef.current = false;
              }}
              onTouchStart={() => {
                isSeekingRef.current = true;
              }}
              onTouchEnd={() => {
                isSeekingRef.current = false;
              }}
              className="studio-seekbar"
              style={{
                background: `linear-gradient(to left, var(--gold) ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%)`,
              }}
              aria-label="شريط تقديم التسجيل الصوتي"
            />
          </div>
        </div>

        {/* Aux Buttons: Mute and Download */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="studio-aux-btn"
            onClick={toggleMute}
            title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
            style={{ width: '34px', height: '34px' }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {safeSrc && (
            <a
              href={safeSrc}
              download={downloadFilename}
              className="studio-aux-btn"
              title="تحميل الملف الصوتي للجهاز"
              style={{ width: '34px', height: '34px', textDecoration: 'none' }}
            >
              <Download size={16} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

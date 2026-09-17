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
  RefreshCw,
  Radio,
} from 'lucide-react';
import { Episode } from '@/types';
import { resolveAudioUrl } from '@/lib/audioStorage';

interface AudioWidgetProps {
  episode: Episode;
  onPlay?: () => void;
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ episode, onPlay }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSeekingRef = useRef<boolean>(false);
  const shouldAutoPlayRef = useRef<boolean>(false);

  // 1. Episode switch handler: LAZY loading (Do not fetch heavy audio on initial page render!)
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setStreamProgress(0);
    setIsLoadingAudio(false);
    shouldAutoPlayRef.current = false;

    if (!episode.audioUrl) {
      setResolvedUrl(null);
      return;
    }

    // If already cached in memory, resolve instantly without any network overhead
    if (episode.docId && typeof window !== 'undefined') {
      import('@/lib/audioStorage').then(({ blobUrlCache }) => {
        if (blobUrlCache.has(episode.docId)) {
          setResolvedUrl(blobUrlCache.get(episode.docId)!);
        } else {
          setResolvedUrl(null);
        }
      });
    } else {
      setResolvedUrl(null);
    }
  }, [episode.docId, episode.audioUrl]);

  // 2. Format Seconds -> MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  // 3. Play / Pause Handlers with Lazy Progressive Streaming
  const togglePlay = useCallback(async () => {
    if (!episode.audioUrl) return;

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    // If audio is not yet resolved, stream & buffer it on demand!
    if (!resolvedUrl) {
      setIsLoadingAudio(true);
      setStreamProgress(10);
      shouldAutoPlayRef.current = true;

      try {
        const url = await resolveAudioUrl(episode, (loaded, total) => {
          setStreamProgress(Math.round((loaded / total) * 100));
        });

        if (url) {
          setResolvedUrl(url);
          setIsLoadingAudio(false);
        } else {
          setIsLoadingAudio(false);
        }
      } catch (err) {
        console.error('Streaming audio error:', err);
        setIsLoadingAudio(false);
      }
      return;
    }

    // If audio is already loaded and ready:
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          onPlay?.();
        })
        .catch((e) => console.warn('Audio play error:', e));
    }
  }, [episode, isPlaying, resolvedUrl, onPlay]);

  // When audio becomes resolved after user clicked play, auto-trigger play
  useEffect(() => {
    if (resolvedUrl && shouldAutoPlayRef.current && audioRef.current) {
      shouldAutoPlayRef.current = false;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          onPlay?.();
        })
        .catch((e) => console.warn('Autoplay error:', e));
    }
  }, [resolvedUrl, onPlay]);

  // 4. Skip Backward / Forward 10s
  const skipTime = useCallback(
    (delta: number) => {
      if (!audioRef.current) return;
      const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + delta));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  // 5. Seek Bar Change
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  // 6. Change Speed
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // 7. Toggle Mute
  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  // 8. Mobile Lock Screen & Background Playback (MediaSession API)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (resolvedUrl && episode) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: episode.title,
        artist: 'قصص الأنبياء وسيرة الرسول',
        album: episode.era || 'قصص الأنبياء وسيرة الرسول',
        artwork: [
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => skipTime(-10));
      navigator.mediaSession.setActionHandler('seekforward', () => skipTime(10));
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number' && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      }
    };
  }, [resolvedUrl, episode, skipTime]);

  if (!episode.audioUrl) {
    return null;
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="studio-audio-player">
      {/* Hidden Native Audio Element for Audio Processing */}
      {resolvedUrl && (
        <audio
          ref={audioRef}
          src={resolvedUrl}
          preload="metadata"
          onTimeUpdate={() => {
            if (!isSeekingRef.current && audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || 0);
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
      )}

      {/* Top Header */}
      <div className="studio-player-header">
        <div className="studio-player-badge">
          <Sparkles size={14} className="sparkle-gold" />
          <span className="badge-text">تسجيل صوتي استوديو نقي (AI)</span>
          {isPlaying && (
            <>
              <div className="studio-wave-bars is-playing" style={{ marginRight: '6px' }}>
                <span className="studio-wave-bar"></span>
                <span className="studio-wave-bar"></span>
                <span className="studio-wave-bar"></span>
                <span className="studio-wave-bar"></span>
                <span className="studio-wave-bar"></span>
              </div>
              <span className="playing-pulse-tag">
                <Radio size={12} className="pulse-radio-icon" />
                <span>جاري الاستماع</span>
              </span>
            </>
          )}
        </div>

        {/* Speed Pills */}
        <div className="speed-pills-row">
          <span className="speed-label">السرعة:</span>
          {[0.75, 1.0, 1.25, 1.5].map((s) => (
            <button
              key={s}
              type="button"
              className={`speed-pill ${playbackSpeed === s ? 'active' : ''}`}
              onClick={() => handleSpeedChange(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {isLoadingAudio ? (
        <div className="studio-player-loading">
          <RefreshCw className="animate-spin" size={18} />
          <span>جارٍ تدفق وبث الصوت السحابي {streamProgress > 0 ? `(${streamProgress}%)` : ''}...</span>
        </div>
      ) : (
        <>
          {/* Main Controls & Waveform Track */}
          <div className="studio-player-body">
            {/* Playback Button Group */}
            <div className="studio-controls-group">
              {/* Skip 10s Backward */}
              <button
                type="button"
                className="studio-btn-secondary"
                onClick={() => skipTime(-10)}
                title="تأخير 10 ثوانٍ"
              >
                <RotateCcw size={18} />
                <span className="skip-hint">10-</span>
              </button>

              {/* Main Play / Pause Button */}
              <button
                type="button"
                className={`studio-btn-play ${isPlaying ? 'is-playing' : ''}`}
                onClick={togglePlay}
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل الاستماع'}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginRight: '-2px' }} />}
              </button>

              {/* Skip 10s Forward */}
              <button
                type="button"
                className="studio-btn-secondary"
                onClick={() => skipTime(10)}
                title="تقديم 10 ثوانٍ"
              >
                <RotateCw size={18} />
                <span className="skip-hint">10+</span>
              </button>
            </div>

            {/* Timeline Progress Bar */}
            <div className="studio-timeline-wrap">
              <div className="studio-time-display">
                <span className="time-current">{formatTime(currentTime)}</span>
                <span className="time-separator">/</span>
                <span className="time-duration">{formatTime(duration)}</span>
              </div>

              <div className="studio-range-container">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.5"
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
                    background: `linear-gradient(to left, var(--gold) ${progressPercent}%, rgba(255, 255, 255, 0.12) ${progressPercent}%)`,
                  }}
                  aria-label="شريط تقدم الاستماع الصوتي"
                />
              </div>
            </div>

            {/* Volume & Download Actions */}
            <div className="studio-aux-group">
              <button
                type="button"
                className="studio-aux-btn"
                onClick={toggleMute}
                title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              {resolvedUrl && (
                <a
                  href={resolvedUrl}
                  download={`${episode.title || 'قصص_الأنبياء_وسيرة_الرسول'}.wav`}
                  className="studio-aux-btn"
                  title="تحميل المقطع الصوتي للجهاز"
                >
                  <Download size={18} />
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

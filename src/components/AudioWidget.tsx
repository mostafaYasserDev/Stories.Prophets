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
  UploadCloud,
  Link2,
} from 'lucide-react';
import { Episode } from '@/types';
import { resolveAudioUrl, isValidPlayableUrl, getAudioSourceInfo } from '@/lib/audioStorage';
import { audioManager } from '@/lib/audioManager';

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
  const activeDocIdRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef<number>(0);

  const sourceInfo = getAudioSourceInfo(episode);

  // 1. Episode switch handler: Only re-initialize when episode ID actually changes
  useEffect(() => {
    // If it is the exact same episode and already resolved, do not reset state
    if (activeDocIdRef.current === episode.docId && resolvedUrl) {
      return;
    }

    activeDocIdRef.current = episode.docId;
    const currentReq = ++loadRequestIdRef.current;

    if (audioRef.current) {
      audioRef.current.pause();
      audioManager.unregisterPlayingAudio(audioRef.current);
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setStreamProgress(0);

    if (!episode.audioUrl) {
      setResolvedUrl(null);
      setIsLoadingAudio(false);
      return;
    }

    // Eager background resolution: resolves audio before user even clicks
    resolveAudioUrl(episode, (loaded, total) => {
      if (currentReq === loadRequestIdRef.current) {
        setStreamProgress(Math.round((loaded / total) * 100));
      }
    })
      .then((url) => {
        if (currentReq !== loadRequestIdRef.current) return;
        if (url && isValidPlayableUrl(url)) {
          setResolvedUrl(url);
          setIsLoadingAudio(false);
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.load();
          }
        } else {
          setIsLoadingAudio(false);
        }
      })
      .catch((err) => {
        console.warn('Eager audio resolve warning:', err);
        if (currentReq === loadRequestIdRef.current) {
          setIsLoadingAudio(false);
        }
      });
  }, [episode.docId, episode.audioUrl]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      loadRequestIdRef.current++;
      if (audioRef.current) {
        audioRef.current.pause();
        audioManager.unregisterPlayingAudio(audioRef.current);
      }
    };
  }, []);

  // Format Seconds -> MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  // Play / Pause Handlers: Guaranteed synchronous user gesture invocation
  const togglePlay = useCallback(async () => {
    if (!episode.audioUrl) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      audioManager.unregisterPlayingAudio(audio);
      return;
    }

    // Stop all other playing audio across the application
    audioManager.stopAllAudio();

    // Case 1: Audio is already resolved and ready in state
    if (resolvedUrl && isValidPlayableUrl(resolvedUrl)) {
      try {
        if (audio.src !== resolvedUrl) {
          audio.src = resolvedUrl;
        }
        await audio.play();
        setIsPlaying(true);
        audioManager.registerPlayingAudio(audio, () => {
          setIsPlaying(false);
        });
        onPlay?.();
      } catch (err) {
        console.warn('Playback play() call failed:', err);
        setIsPlaying(false);
      }
      return;
    }

    // Case 2: Audio is still resolving
    setIsLoadingAudio(true);
    const currentReq = loadRequestIdRef.current;

    try {
      const url = await resolveAudioUrl(episode, (loaded, total) => {
        if (currentReq === loadRequestIdRef.current) {
          setStreamProgress(Math.round((loaded / total) * 100));
        }
      });

      if (currentReq !== loadRequestIdRef.current) return;

      if (url && isValidPlayableUrl(url)) {
        setResolvedUrl(url);
        setIsLoadingAudio(false);
        if (audioRef.current) {
          audioRef.current.src = url;
          try {
            await audioRef.current.play();
            setIsPlaying(true);
            audioManager.registerPlayingAudio(audioRef.current, () => {
              setIsPlaying(false);
            });
            onPlay?.();
          } catch (e) {
            console.warn('Play after resolve failed:', e);
            setIsPlaying(false);
          }
        }
      } else {
        setIsLoadingAudio(false);
      }
    } catch (err) {
      console.error('Audio resolve error in togglePlay:', err);
      if (currentReq === loadRequestIdRef.current) {
        setIsLoadingAudio(false);
      }
    }
  }, [episode, isPlaying, resolvedUrl, onPlay]);

  // Skip Backward / Forward 10s
  const skipTime = useCallback(
    (delta: number) => {
      if (!audioRef.current) return;
      const newTime = Math.max(0, Math.min(duration || 9999, audioRef.current.currentTime + delta));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration]
  );

  // Seek Bar Change
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  // Change Speed
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioRef.current.muted = nextMute;
  };

  // Mobile Lock Screen & Background Playback (MediaSession API)
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
        if (audioRef.current) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
        }
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

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={`studio-audio-player player-source-${sourceInfo.type}`}>
      {/* Native Audio Element: ALWAYS mounted in DOM */}
      <audio
        ref={audioRef}
        src={isValidPlayableUrl(resolvedUrl) ? resolvedUrl : undefined}
        preload="auto"
        onTimeUpdate={() => {
          if (!isSeekingRef.current && audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onDurationChange={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
            audioRef.current.playbackRate = playbackSpeed;
          }
        }}
        onCanPlay={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (audioRef.current) {
            audioManager.unregisterPlayingAudio(audioRef.current);
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          if (audioRef.current) {
            audioManager.registerPlayingAudio(audioRef.current, () => {
              setIsPlaying(false);
            });
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          if (audioRef.current) {
            audioManager.unregisterPlayingAudio(audioRef.current);
          }
        }}
      />

      {/* Top Header with Dynamic Source Differentiation */}
      <div className="studio-player-header">
        <div className={`studio-player-badge badge-${sourceInfo.type}`}>
          {sourceInfo.type === 'ai' ? (
            <Sparkles size={15} className="sparkle-gold" />
          ) : sourceInfo.type === 'url' ? (
            <Link2 size={15} className="badge-icon-url" />
          ) : (
            <UploadCloud size={15} className="badge-icon-upload" />
          )}

          <span className="badge-text">{sourceInfo.label}</span>

          <span className={`source-type-pill pill-${sourceInfo.type}`}>
            {sourceInfo.badgeText}
          </span>

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
          <span>جارٍ تجهيز وبث المقطع الصوتي {streamProgress > 0 ? `(${streamProgress}%)` : ''}...</span>
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
                className={`studio-btn-play ${isPlaying ? 'is-playing' : ''} btn-source-${sourceInfo.type}`}
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
                  max={duration > 0 ? duration : 100}
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
                    background: `linear-gradient(to left, ${
                      sourceInfo.type === 'upload'
                        ? '#38bdf8'
                        : sourceInfo.type === 'url'
                        ? '#a855f7'
                        : 'var(--gold)'
                    } ${progressPercent}%, rgba(255, 255, 255, 0.12) ${progressPercent}%)`,
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

              {isValidPlayableUrl(resolvedUrl) && (
                <a
                  href={resolvedUrl!}
                  download={`${episode.title || 'قصص_الأنبياء_وسيرة_الرسول'}.${
                    sourceInfo.type === 'ai' ? 'wav' : 'mp3'
                  }`}
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

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Gauge, RefreshCw } from 'lucide-react';
import { Episode } from '@/types';
import { resolveAudioUrl } from '@/lib/audioStorage';

interface AudioWidgetProps {
  episode: Episode;
  onPlay?: () => void;
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ episode, onPlay }) => {
  const [playbackSpeed, setPlaybackSpeed] = useState('1');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Resolve direct URL or chunked base64 from Firestore
  useEffect(() => {
    let isMounted = true;
    if (!episode.audioUrl) {
      setResolvedUrl(null);
      return;
    }

    if (episode.audioUrl !== '__CHUNKS__') {
      setResolvedUrl(episode.audioUrl);
      return;
    }

    setIsLoadingAudio(true);
    resolveAudioUrl(episode)
      .then((url) => {
        if (isMounted) {
          setResolvedUrl(url);
          setIsLoadingAudio(false);
        }
      })
      .catch((err) => {
        console.error('Error resolving chunked audio:', err);
        if (isMounted) setIsLoadingAudio(false);
      });

    return () => {
      isMounted = false;
    };
  }, [episode.docId, episode.audioUrl]);

  // Apply playback speed
  useEffect(() => {
    if (audioElRef.current) {
      audioElRef.current.playbackRate = parseFloat(playbackSpeed);
    }
  }, [playbackSpeed, resolvedUrl]);

  if (!episode.audioUrl) {
    return null;
  }

  return (
    <div className="audio-player-widget">
      <div className="audio-widget-header">
        <div className="audio-title-tag">
          <Volume2 size={16} />
          <span>استماع لتسجيل الحلقة المباركة</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Gauge size={14} />
            <span>السرعة:</span>
          </div>
          <select
            className="speed-select"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(e.target.value)}
            title="سرعة التشغيل"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1.0x (عادي)</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>
        </div>
      </div>

      <div className="audio-controls-row">
        {isLoadingAudio ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: 'var(--gold)', fontSize: '0.85rem' }}>
            <RefreshCw className="animate-spin" size={16} />
            <span>جارٍ تجهيز التسجيل الصوتي من السحابة...</span>
          </div>
        ) : (
          resolvedUrl && (
            <audio
              ref={audioElRef}
              controls
              src={resolvedUrl}
              preload="metadata"
              onPlay={onPlay}
            />
          )
        )}
      </div>
    </div>
  );
};

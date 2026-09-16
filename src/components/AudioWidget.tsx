'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Music, Gauge } from 'lucide-react';
import { Episode } from '@/types';

interface AudioWidgetProps {
  episode: Episode;
}

export const AudioWidget: React.FC<AudioWidgetProps> = ({ episode }) => {
  const [playbackSpeed, setPlaybackSpeed] = useState('1');
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Apply playback speed
  useEffect(() => {
    if (audioElRef.current) {
      audioElRef.current.playbackRate = parseFloat(playbackSpeed);
    }
  }, [playbackSpeed, episode.audioUrl]);

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
        <audio ref={audioElRef} controls src={episode.audioUrl} preload="metadata" />
      </div>
    </div>
  );
};


'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface VoiceOption {
  id: string;
  name: string;
  dialect: 'egyptian' | 'standard' | 'local';
  type: 'neural' | 'browser';
  nativeVoice?: SpeechSynthesisVoice;
}

export const PRESET_NEURAL_VOICES: VoiceOption[] = [
  { id: 'ar-EG-ShakirNeural', name: 'شاكر (مصري - وقور وهادئ 🇪🇬)', dialect: 'egyptian', type: 'neural' },
  { id: 'ar-EG-SalmaNeural', name: 'سلمى (مصرية - نبرة إذاعية 🇪🇬)', dialect: 'egyptian', type: 'neural' },
  { id: 'ar-SA-HamedNeural', name: 'حامد (فصيح - مهيب وجليل 🇸🇦)', dialect: 'standard', type: 'neural' },
  { id: 'ar-SA-ZariyahNeural', name: 'زارية (فصيحة - متقنة 🇸🇦)', dialect: 'standard', type: 'neural' },
];

export interface UseTextToSpeechOptions {
  onSentenceChange?: (index: number) => void;
  onEnd?: () => void;
}

/**
 * Splits plain Arabic text into natural, digestible sentences for TTS.
 */
export function splitArabicSentences(rawText: string): string[] {
  if (!rawText) return [];

  const cleaned = rawText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Split by major punctuation marks and verse brackets
  const rawChunks = cleaned.split(/(?<=[.!?؟\n﴾])\s+/);
  const sentences: string[] = [];

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed.length > 200) {
      const subParts = trimmed.split(/(?<=[،؛])\s+/);
      for (const part of subParts) {
        const pTrimmed = part.trim();
        if (pTrimmed) sentences.push(pTrimmed);
      }
    } else {
      sentences.push(trimmed);
    }
  }

  // Merge micro sentences (< 8 chars)
  const merged: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const current = sentences[i];
    if (current.length < 8 && i < sentences.length - 1) {
      sentences[i + 1] = `${current} ${sentences[i + 1]}`;
    } else {
      merged.push(current);
    }
  }

  return merged.length > 0 ? merged : [cleaned];
}

export function useTextToSpeech(options?: UseTextToSpeechOptions) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const [sentences, setSentences] = useState<string[]>([]);
  const [rate, setRate] = useState<number>(1.0);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('ar-EG-ShakirNeural');
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>(PRESET_NEURAL_VOICES);

  const sentencesRef = useRef<string[]>([]);
  const currentIndexRef = useRef<number>(-1);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const rateRef = useRef<number>(1.0);
  const selectedVoiceIdRef = useRef<string>('ar-EG-ShakirNeural');

  // Audio elements and caching for Neural TTS
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map()); // Key: `${voiceId}_${sentence}` -> URL

  // Sync refs
  useEffect(() => {
    currentIndexRef.current = currentSentenceIndex;
  }, [currentSentenceIndex]);

  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    rateRef.current = rate;
    if (audioElRef.current) {
      audioElRef.current.playbackRate = rate;
    }
  }, [rate]);

  useEffect(() => {
    selectedVoiceIdRef.current = selectedVoiceId;
  }, [selectedVoiceId]);

  // Initialize HTML5 Audio element
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'auto';
    audioElRef.current = audio;

    audio.onended = () => {
      if (!isPlayingRef.current || isPausedRef.current) return;
      const nextIdx = currentIndexRef.current + 1;
      speakIndex(nextIdx);
    };

    audio.onerror = (e) => {
      console.warn('Neural audio playback error, falling back to next or browser speech:', e);
      if (isPlayingRef.current && !isPausedRef.current) {
        const nextIdx = currentIndexRef.current + 1;
        speakIndex(nextIdx);
      }
    };

    // Load browser speech voices as local options
    const loadBrowserVoices = () => {
      if ('speechSynthesis' in window) {
        const localVoices = window.speechSynthesis.getVoices();
        const arabicLocal = localVoices.filter(
          (v) => v.lang.toLowerCase().startsWith('ar') || v.lang.toLowerCase().includes('arabic')
        );

        const localVoiceOptions: VoiceOption[] = (arabicLocal.length > 0 ? arabicLocal : localVoices)
          .slice(0, 4)
          .map((v) => ({
            id: `browser:${v.name}`,
            name: `📱 ${v.name} (جهازك)`,
            dialect: 'local',
            type: 'browser',
            nativeVoice: v,
          }));

        setAvailableVoices([...PRESET_NEURAL_VOICES, ...localVoiceOptions]);
      }
    };

    loadBrowserVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadBrowserVoices;
    }

    return () => {
      audio.pause();
      audio.src = '';
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Pre-fetch a sentence's Neural audio into memory
  const prefetchSentenceAudio = useCallback(async (text: string, voice: string): Promise<string | null> => {
    const cacheKey = `${voice}_${text.trim()}`;
    if (audioCacheRef.current.has(cacheKey)) {
      return audioCacheRef.current.get(cacheKey)!;
    }

    try {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text.trim())}&voice=${encodeURIComponent(voice)}`);
      if (!res.ok) return null;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      audioCacheRef.current.set(cacheKey, blobUrl);
      return blobUrl;
    } catch {
      return null;
    }
  }, []);

  // Fallback to browser SpeechSynthesis
  const speakWithBrowserSpeech = useCallback((text: string, onDone: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onDone();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = rateRef.current;

    const currentVoiceOption = availableVoices.find((v) => v.id === selectedVoiceIdRef.current);
    if (currentVoiceOption?.nativeVoice) {
      utterance.voice = currentVoiceOption.nativeVoice;
    } else {
      const voices = window.speechSynthesis.getVoices();
      const ar = voices.find((v) => v.lang.startsWith('ar'));
      if (ar) utterance.voice = ar;
    }

    utterance.onend = onDone;
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        onDone();
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [availableVoices]);

  // Core speak function for sentence at index
  const speakIndex = useCallback(
    async (index: number) => {
      const list = sentencesRef.current;
      if (index < 0 || index >= list.length) {
        // End of speech
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentSentenceIndex(-1);
        if (audioElRef.current) {
          audioElRef.current.pause();
          audioElRef.current.src = '';
        }
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        options?.onEnd?.();
        return;
      }

      setIsPlaying(true);
      setIsPaused(false);
      setCurrentSentenceIndex(index);
      options?.onSentenceChange?.(index);

      const sentenceText = list[index];
      const voiceId = selectedVoiceIdRef.current;
      const isNeuralVoice = !voiceId.startsWith('browser:');

      // Stop any browser speech before neural play
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      if (isNeuralVoice) {
        // 1. Try Neural Edge TTS with automatic fallback
        try {
          const audioUrl = await prefetchSentenceAudio(sentenceText, voiceId);

          if (audioUrl && audioElRef.current) {
            audioElRef.current.src = audioUrl;
            audioElRef.current.playbackRate = rateRef.current;
            await audioElRef.current.play();

            // 2. Pre-fetch next sentence in the background for 0ms transition!
            if (index + 1 < list.length) {
              prefetchSentenceAudio(list[index + 1], voiceId);
            }
            return;
          }
        } catch (err) {
          console.warn('Neural stream error, using browser speech fallback:', err);
        }
      }

      // Fallback: Browser Web Speech API
      speakWithBrowserSpeech(sentenceText, () => {
        if (!isPlayingRef.current || isPausedRef.current) return;
        speakIndex(index + 1);
      });
    },
    [prefetchSentenceAudio, speakWithBrowserSpeech, options]
  );

  // Load text into sentences
  const loadText = useCallback((rawText: string) => {
    const list = splitArabicSentences(rawText);
    setSentences(list);
    sentencesRef.current = list;
    setCurrentSentenceIndex(-1);
    setIsPlaying(false);
    setIsPaused(false);
    return list;
  }, []);

  // Play
  const play = useCallback(
    (rawText?: string, startIndex: number = 0) => {
      let list = sentencesRef.current;
      if (rawText) {
        list = splitArabicSentences(rawText);
        setSentences(list);
        sentencesRef.current = list;
      }

      if (list.length === 0) return;

      const targetIdx = startIndex >= 0 && startIndex < list.length ? startIndex : 0;
      speakIndex(targetIdx);
    },
    [speakIndex]
  );

  // Pause
  const pause = useCallback(() => {
    setIsPaused(true);
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  }, []);

  // Resume
  const resume = useCallback(() => {
    setIsPaused(false);
    setIsPlaying(true);
    if (audioElRef.current && audioElRef.current.src) {
      audioElRef.current.play();
    } else {
      const idx = currentIndexRef.current >= 0 ? currentIndexRef.current : 0;
      speakIndex(idx);
    }
  }, [speakIndex]);

  // Stop
  const stop = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Next / Prev sentence
  const nextSentence = useCallback(() => {
    const nextIdx = Math.min(currentIndexRef.current + 1, sentencesRef.current.length - 1);
    speakIndex(nextIdx);
  }, [speakIndex]);

  const prevSentence = useCallback(() => {
    const prevIdx = Math.max(0, currentIndexRef.current - 1);
    speakIndex(prevIdx);
  }, [speakIndex]);

  // Change voice
  const handleSelectVoice = useCallback(
    (voiceId: string) => {
      setSelectedVoiceId(voiceId);
      selectedVoiceIdRef.current = voiceId;
      // Re-play current sentence with new voice if playing
      if (isPlayingRef.current && !isPausedRef.current && currentIndexRef.current >= 0) {
        speakIndex(currentIndexRef.current);
      }
    },
    [speakIndex]
  );

  // Change rate
  const handleSetRate = useCallback(
    (newRate: number) => {
      setRate(newRate);
      rateRef.current = newRate;
      if (audioElRef.current) {
        audioElRef.current.playbackRate = newRate;
      }
    },
    []
  );

  return {
    isSupported: true,
    isPlaying,
    isPaused,
    currentSentenceIndex,
    totalSentences: sentences.length,
    sentences,
    rate,
    availableVoices,
    selectedVoiceId,
    loadText,
    play,
    pause,
    resume,
    stop,
    nextSentence,
    prevSentence,
    setRate: handleSetRate,
    setVoice: handleSelectVoice,
    speakIndex,
  };
}

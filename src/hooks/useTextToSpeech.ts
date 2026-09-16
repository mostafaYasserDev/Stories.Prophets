'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface TtsSentence {
  id: number;
  text: string;
}

export interface UseTextToSpeechOptions {
  onSentenceChange?: (index: number) => void;
  onEnd?: () => void;
}

/**
 * Splits plain Arabic text into natural, digestible sentences for SpeechSynthesis.
 * Avoids browser freezes (the 15-second cutoff bug) and powers sentence-level text tracking.
 */
export function splitArabicSentences(rawText: string): string[] {
  if (!rawText) return [];

  // Normalize spaces and clean up HTML tags if any slipped through
  const cleaned = rawText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Split by major Arabic punctuation marks and newlines
  // Matching: . ! ؟ ﴾ \n followed by whitespace or quotes
  const rawChunks = cleaned.split(/(?<=[.!?؟\n﴾])\s+/);

  const sentences: string[] = [];

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // If chunk is excessively long (over 200 chars), further split by comma or semicolon
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

  // Merge micro-sentences (less than 10 characters) into the following sentence if possible
  const merged: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const current = sentences[i];
    if (current.length < 10 && i < sentences.length - 1) {
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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(false);

  const currentIndexRef = useRef<number>(-1);
  const sentencesRef = useRef<string[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const rateRef = useRef<number>(1.0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

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
  }, [rate]);

  // Check browser support and load Arabic voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Filter Arabic voices or all if none found
      const arabicVoices = allVoices.filter(
        (v) => v.lang.toLowerCase().startsWith('ar') || v.lang.toLowerCase().includes('arabic')
      );

      setVoices(arabicVoices.length > 0 ? arabicVoices : allVoices);

      // Select first Arabic voice by default if not set
      if (arabicVoices.length > 0) {
        // Prefer natural / google / siri voices if available
        const preferredVoice =
          arabicVoices.find((v) => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Tarik') || v.name.includes('Maged')) ||
          arabicVoices[0];

        setSelectedVoiceUri(preferredVoice.voiceURI);
        voiceRef.current = preferredVoice;
      }
    };

    updateVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Update selected voice object when URI changes
  const handleSelectVoice = useCallback(
    (uri: string) => {
      setSelectedVoiceUri(uri);
      const voice = voices.find((v) => v.voiceURI === uri) || null;
      voiceRef.current = voice;
    },
    [voices]
  );

  // Core speak function for a specific sentence index
  const speakIndex = useCallback(
    (index: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      if (index < 0 || index >= sentencesRef.current.length) {
        // Reached end of text
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentSentenceIndex(-1);
        window.speechSynthesis.cancel();
        options?.onEnd?.();
        return;
      }

      window.speechSynthesis.cancel();

      const textToSpeak = sentencesRef.current[index];
      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      utterance.lang = 'ar-SA';
      utterance.rate = rateRef.current;

      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      }

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
        setCurrentSentenceIndex(index);
        options?.onSentenceChange?.(index);
      };

      utterance.onend = () => {
        if (!isPlayingRef.current || isPausedRef.current) return;
        // Proceed to next sentence automatically
        speakIndex(index + 1);
      };

      utterance.onerror = (e) => {
        // Some browsers trigger 'interrupted' when cancel() is called; ignore that
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        console.warn('SpeechSynthesis error:', e.error);
        if (isPlayingRef.current && !isPausedRef.current) {
          // Attempt recovery with next sentence
          speakIndex(index + 1);
        }
      };

      window.speechSynthesis.speak(utterance);
    },
    [options]
  );

  // Initialize sentences from text and optionally start speaking
  const loadText = useCallback((rawText: string) => {
    const list = splitArabicSentences(rawText);
    setSentences(list);
    sentencesRef.current = list;
    setCurrentSentenceIndex(-1);
    setIsPlaying(false);
    setIsPaused(false);
    return list;
  }, []);

  // Play from start or current index
  const play = useCallback(
    (rawText?: string, startIndex: number = 0) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      let list = sentencesRef.current;
      if (rawText) {
        list = splitArabicSentences(rawText);
        setSentences(list);
        sentencesRef.current = list;
      }

      if (list.length === 0) return;

      const targetIndex = startIndex >= 0 && startIndex < list.length ? startIndex : 0;
      setIsPlaying(true);
      setIsPaused(false);
      speakIndex(targetIndex);
    },
    [speakIndex]
  );

  // Pause
  const pause = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setIsPaused(true);
    window.speechSynthesis.cancel();
  }, []);

  // Resume
  const resume = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const resumeIndex = currentIndexRef.current >= 0 ? currentIndexRef.current : 0;
    setIsPaused(false);
    setIsPlaying(true);
    speakIndex(resumeIndex);
  }, [speakIndex]);

  // Stop completely
  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
    window.speechSynthesis.cancel();
  }, []);

  // Skip forward 1 sentence
  const nextSentence = useCallback(() => {
    const nextIdx = Math.min(currentIndexRef.current + 1, sentencesRef.current.length - 1);
    speakIndex(nextIdx);
  }, [speakIndex]);

  // Skip backward 1 sentence
  const prevSentence = useCallback(() => {
    const prevIdx = Math.max(0, currentIndexRef.current - 1);
    speakIndex(prevIdx);
  }, [speakIndex]);

  // Change speed rate
  const handleSetRate = useCallback(
    (newRate: number) => {
      setRate(newRate);
      rateRef.current = newRate;
      // If currently playing, re-speak current sentence with new rate
      if (isPlayingRef.current && !isPausedRef.current && currentIndexRef.current >= 0) {
        speakIndex(currentIndexRef.current);
      }
    },
    [speakIndex]
  );

  return {
    isSupported,
    isPlaying,
    isPaused,
    currentSentenceIndex,
    totalSentences: sentences.length,
    sentences,
    rate,
    voices,
    selectedVoiceUri,
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

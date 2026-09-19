/**
 * Global Audio Manager (Singleton)
 * Ensures that only ONE audio track plays at any time across the entire application.
 * Automatically coordinates between CustomAudioPlayer, AudioWidget, and Admin preview players.
 */

type StopCallback = () => void;

interface ActiveAudioEntry {
  element: HTMLAudioElement;
  onStop?: StopCallback;
}

class AudioManager {
  private current: ActiveAudioEntry | null = null;

  /**
   * Register an audio element as the currently playing audio.
   * If any other audio was playing, it is stopped immediately.
   */
  public registerPlayingAudio(element: HTMLAudioElement, onStop?: StopCallback): void {
    if (this.current && this.current.element !== element) {
      this.stopCurrent();
    }

    // Pause any other native <audio> tags in the DOM
    this.pauseDomAudiosExcept(element);

    this.current = { element, onStop };
  }

  /**
   * Unregister an audio element when it pauses or ends.
   */
  public unregisterPlayingAudio(element: HTMLAudioElement): void {
    if (this.current && this.current.element === element) {
      this.current = null;
    }
  }

  /**
   * Stop the currently playing audio and notify its callback.
   */
  public stopCurrent(): void {
    if (this.current) {
      const active = this.current;
      this.current = null;
      try {
        active.element.pause();
      } catch (e) {
        // ignore
      }
      if (active.onStop) {
        try {
          active.onStop();
        } catch (e) {
          // ignore
        }
      }
    }
  }

  /**
   * Stop all audio unconditionally across the entire app.
   */
  public stopAllAudio(): void {
    this.stopCurrent();
    this.pauseDomAudiosExcept(null);
  }

  private pauseDomAudiosExcept(except: HTMLAudioElement | null): void {
    if (typeof document === 'undefined') return;
    try {
      const audios = document.querySelectorAll('audio');
      audios.forEach((audio) => {
        if (audio !== except && !audio.paused) {
          try {
            audio.pause();
          } catch (e) {
            // ignore
          }
        }
      });
    } catch (e) {
      // ignore
    }
  }
}

export const audioManager = new AudioManager();

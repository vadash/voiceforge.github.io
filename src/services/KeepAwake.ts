// KeepAwake Service
// Prevents browser from throttling background tabs by playing inaudible audio

export interface IKeepAwake {
  start(): void;
  stop(): void;
  isActive(): boolean;
}

/**
 * KeepAwake uses AudioContext with near-silent oscillator
 * to trick browser into treating tab as "playing audio",
 * which prevents setTimeout/WebSocket throttling in background tabs.
 */
export class KeepAwake implements IKeepAwake {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private active = false;

  start(): void {
    if (this.active) return;

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // Create oscillator (generates tone)
      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.frequency.value = 1; // Very low frequency
      this.oscillator.type = 'sine';

      // Create gain node to make it inaudible
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.001; // Nearly silent

      // Connect: oscillator -> gain -> destination
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      // Start the oscillator
      this.oscillator.start();
      this.active = true;
    } catch {
      // AudioContext not supported, silently fail
      this.cleanup();
    }
  }

  stop(): void {
    if (!this.active) return;
    this.cleanup();
  }

  isActive(): boolean {
    return this.active;
  }

  private cleanup(): void {
    try {
      this.oscillator?.stop();
    } catch {
      // Already stopped
    }

    try {
      this.oscillator?.disconnect();
      this.gainNode?.disconnect();
    } catch {
      // Already disconnected
    }

    try {
      void this.audioContext?.close();
    } catch {
      // Already closed
    }

    this.oscillator = null;
    this.gainNode = null;
    this.audioContext = null;
    this.active = false;
  }
}

// Singleton instance
let keepAwakeInstance: KeepAwake | null = null;

export function getKeepAwake(): IKeepAwake {
  if (!keepAwakeInstance) {
    keepAwakeInstance = new KeepAwake();
  }
  return keepAwakeInstance;
}

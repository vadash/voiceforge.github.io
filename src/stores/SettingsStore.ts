// Settings Store
// Manages user preferences and application settings

import { signal, computed } from '@preact/signals';
import type { AppSettings } from '@/state/types';
import type { LogStore } from './LogStore';
import { StorageKeys } from '@/config/storage';

/**
 * Default settings values
 */
const defaultSettings: AppSettings = {
  voice: 'ru-RU, DmitryNeural',
  narratorVoice: 'ru-RU, DmitryNeural',
  voicePoolLocale: 'ru-RU',
  rate: 0,
  pitch: 0,
  maxThreads: 20,
  lexxRegister: true,
  showDopSettings: false,
  isLiteMode: true,
  statusAreaWidth: 450,
  outputFormat: 'opus',
  silenceRemovalEnabled: true,
  normalizationEnabled: false,
};

/**
 * Settings Store - manages user preferences
 */
export class SettingsStore {
  private readonly logStore: LogStore;

  // Voice settings
  readonly voice = signal<string>(defaultSettings.voice);
  readonly narratorVoice = signal<string>(defaultSettings.narratorVoice);
  readonly voicePoolLocale = signal<string>(defaultSettings.voicePoolLocale);

  // Speech settings
  readonly rate = signal<number>(defaultSettings.rate);
  readonly pitch = signal<number>(defaultSettings.pitch);

  // Processing settings
  readonly maxThreads = signal<number>(defaultSettings.maxThreads);
  readonly outputFormat = signal<'mp3' | 'opus'>(defaultSettings.outputFormat);
  readonly silenceRemovalEnabled = signal<boolean>(defaultSettings.silenceRemovalEnabled);
  readonly normalizationEnabled = signal<boolean>(defaultSettings.normalizationEnabled);

  // Text processing settings
  readonly lexxRegister = signal<boolean>(defaultSettings.lexxRegister);

  // UI settings
  readonly showDopSettings = signal<boolean>(defaultSettings.showDopSettings);
  readonly isLiteMode = signal<boolean>(defaultSettings.isLiteMode);
  readonly statusAreaWidth = signal<number>(defaultSettings.statusAreaWidth);

  constructor(logStore: LogStore) {
    this.logStore = logStore;
  }

  // Computed display values
  readonly rateDisplay = computed(() =>
    this.rate.value >= 0 ? `+${this.rate.value}%` : `${this.rate.value}%`
  );

  readonly pitchDisplay = computed(() =>
    this.pitch.value >= 0 ? `+${this.pitch.value}Hz` : `${this.pitch.value}Hz`
  );

  // ========== Voice Setters ==========

  setVoice(value: string): void {
    this.voice.value = value;
    this.save();
  }

  setNarratorVoice(value: string): void {
    this.narratorVoice.value = value;
    this.save();
  }

  setVoicePoolLocale(value: string): void {
    this.voicePoolLocale.value = value;
    this.save();
  }

  // ========== Speech Setters ==========

  setRate(value: number): void {
    this.rate.value = value;
    this.save();
  }

  setPitch(value: number): void {
    this.pitch.value = value;
    this.save();
  }

  // ========== Processing Setters ==========

  setMaxThreads(value: number): void {
    this.maxThreads.value = value;
    this.save();
  }

  setOutputFormat(value: 'mp3' | 'opus'): void {
    this.outputFormat.value = value;
    this.save();
  }

  toggleSilenceRemoval(): void {
    this.silenceRemovalEnabled.value = !this.silenceRemovalEnabled.value;
    this.save();
  }

  setSilenceRemovalEnabled(value: boolean): void {
    this.silenceRemovalEnabled.value = value;
    this.save();
  }

  toggleNormalization(): void {
    this.normalizationEnabled.value = !this.normalizationEnabled.value;
    this.save();
  }

  setNormalizationEnabled(value: boolean): void {
    this.normalizationEnabled.value = value;
    this.save();
  }

  // ========== Text Processing Setters ==========

  setLexxRegister(value: boolean): void {
    this.lexxRegister.value = value;
    this.save();
  }

  // ========== UI Setters ==========

  setShowDopSettings(value: boolean): void {
    this.showDopSettings.value = value;
    this.save();
  }

  toggleDopSettings(): void {
    this.showDopSettings.value = !this.showDopSettings.value;
    this.save();
  }

  setIsLiteMode(value: boolean): void {
    this.isLiteMode.value = value;
    this.save();
  }

  toggleLiteMode(): void {
    this.isLiteMode.value = !this.isLiteMode.value;
    this.save();
  }

  setStatusAreaWidth(value: number): void {
    this.statusAreaWidth.value = value;
    this.save();
  }

  // ========== Persistence ==========

  /**
   * Save settings to localStorage
   */
  save(): void {
    const settings: AppSettings = {
      voice: this.voice.value,
      narratorVoice: this.narratorVoice.value,
      voicePoolLocale: this.voicePoolLocale.value,
      rate: this.rate.value,
      pitch: this.pitch.value,
      maxThreads: this.maxThreads.value,
      lexxRegister: this.lexxRegister.value,
      showDopSettings: this.showDopSettings.value,
      isLiteMode: this.isLiteMode.value,
      statusAreaWidth: this.statusAreaWidth.value,
      outputFormat: this.outputFormat.value,
      silenceRemovalEnabled: this.silenceRemovalEnabled.value,
      normalizationEnabled: this.normalizationEnabled.value,
    };
    localStorage.setItem(StorageKeys.settings, JSON.stringify(settings));
  }

  /**
   * Load settings from localStorage
   */
  load(): void {
    try {
      const saved = localStorage.getItem(StorageKeys.settings);
      if (saved) {
        const settings: Partial<AppSettings> = JSON.parse(saved);

        this.voice.value = settings.voice ?? defaultSettings.voice;
        this.narratorVoice.value = settings.narratorVoice ?? defaultSettings.narratorVoice;
        this.voicePoolLocale.value = settings.voicePoolLocale ?? defaultSettings.voicePoolLocale;
        this.rate.value = settings.rate ?? defaultSettings.rate;
        this.pitch.value = settings.pitch ?? defaultSettings.pitch;
        this.maxThreads.value = settings.maxThreads ?? defaultSettings.maxThreads;
        this.lexxRegister.value = settings.lexxRegister ?? defaultSettings.lexxRegister;
        this.showDopSettings.value = settings.showDopSettings ?? defaultSettings.showDopSettings;
        this.isLiteMode.value = settings.isLiteMode ?? defaultSettings.isLiteMode;
        this.statusAreaWidth.value = settings.statusAreaWidth ?? defaultSettings.statusAreaWidth;
        this.outputFormat.value = settings.outputFormat ?? defaultSettings.outputFormat;
        this.silenceRemovalEnabled.value = settings.silenceRemovalEnabled ?? defaultSettings.silenceRemovalEnabled;
        this.normalizationEnabled.value = settings.normalizationEnabled ?? defaultSettings.normalizationEnabled;
      }
    } catch (e) {
      this.logStore.error(
        'Failed to load settings',
        e instanceof Error ? e : undefined,
        e instanceof Error ? undefined : { error: String(e) }
      );
    }
  }

  /**
   * Reset to default settings
   */
  reset(): void {
    this.voice.value = defaultSettings.voice;
    this.narratorVoice.value = defaultSettings.narratorVoice;
    this.voicePoolLocale.value = defaultSettings.voicePoolLocale;
    this.rate.value = defaultSettings.rate;
    this.pitch.value = defaultSettings.pitch;
    this.maxThreads.value = defaultSettings.maxThreads;
    this.lexxRegister.value = defaultSettings.lexxRegister;
    this.showDopSettings.value = defaultSettings.showDopSettings;
    this.isLiteMode.value = defaultSettings.isLiteMode;
    this.statusAreaWidth.value = defaultSettings.statusAreaWidth;
    this.outputFormat.value = defaultSettings.outputFormat;
    this.silenceRemovalEnabled.value = defaultSettings.silenceRemovalEnabled;
    this.normalizationEnabled.value = defaultSettings.normalizationEnabled;
    this.save();
  }

  /**
   * Get current settings as an object
   */
  toObject(): AppSettings {
    return {
      voice: this.voice.value,
      narratorVoice: this.narratorVoice.value,
      voicePoolLocale: this.voicePoolLocale.value,
      rate: this.rate.value,
      pitch: this.pitch.value,
      maxThreads: this.maxThreads.value,
      lexxRegister: this.lexxRegister.value,
      showDopSettings: this.showDopSettings.value,
      isLiteMode: this.isLiteMode.value,
      statusAreaWidth: this.statusAreaWidth.value,
      outputFormat: this.outputFormat.value,
      silenceRemovalEnabled: this.silenceRemovalEnabled.value,
      normalizationEnabled: this.normalizationEnabled.value,
    };
  }
}

/**
 * Create a new SettingsStore instance
 */
export function createSettingsStore(logStore: LogStore): SettingsStore {
  return new SettingsStore(logStore);
}

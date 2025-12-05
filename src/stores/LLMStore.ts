// LLM Store
// Manages LLM settings and character detection state

import { signal, computed } from '@preact/signals';
import type { LLMCharacter } from '@/state/types';
import { encryptValue, decryptValue } from '@/services/SecureStorage';
import type { LogStore } from './LogStore';
import { StorageKeys } from '@/config/storage';

/**
 * LLM processing status
 */
export type LLMProcessingStatus = 'idle' | 'extracting' | 'review' | 'assigning' | 'error';

/**
 * LLM settings for persistence
 */
interface LLMSettings {
  enabled: boolean;
  apiKey: string; // encrypted
  apiUrl: string;
  model: string;
}

/**
 * Default LLM settings
 */
const defaultLLMSettings = {
  enabled: true,
  apiKey: '',
  apiUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

/**
 * LLM Store - manages LLM settings and character data
 */
export class LLMStore {
  private readonly logStore: LogStore;

  // Settings (persisted)
  readonly enabled = signal<boolean>(defaultLLMSettings.enabled);
  readonly apiKey = signal<string>(defaultLLMSettings.apiKey);
  readonly apiUrl = signal<string>(defaultLLMSettings.apiUrl);
  readonly model = signal<string>(defaultLLMSettings.model);

  // Processing state
  readonly processingStatus = signal<LLMProcessingStatus>('idle');
  readonly currentBlock = signal<number>(0);
  readonly totalBlocks = signal<number>(0);
  readonly error = signal<string | null>(null);

  // Character data
  readonly detectedCharacters = signal<LLMCharacter[]>([]);
  readonly characterVoiceMap = signal<Map<string, string>>(new Map());

  constructor(logStore: LogStore) {
    this.logStore = logStore;
  }

  // ========== Computed Properties ==========

  /**
   * Check if LLM is configured (has API key)
   */
  readonly isConfigured = computed(() => this.apiKey.value.length > 0);

  /**
   * Check if currently processing
   */
  readonly isProcessing = computed(() => {
    const status = this.processingStatus.value;
    return status === 'extracting' || status === 'assigning';
  });

  /**
   * Get block progress
   */
  readonly blockProgress = computed(() => ({
    current: this.currentBlock.value,
    total: this.totalBlocks.value,
  }));

  /**
   * Get character names
   */
  readonly characterNames = computed(() =>
    this.detectedCharacters.value.map(c => c.canonicalName)
  );

  // ========== Settings Actions ==========

  setEnabled(value: boolean): void {
    this.enabled.value = value;
    this.saveSettings();
  }

  toggleEnabled(): void {
    this.enabled.value = !this.enabled.value;
    this.saveSettings();
  }

  setApiKey(value: string): void {
    this.apiKey.value = value;
    this.saveSettings();
  }

  setApiUrl(value: string): void {
    this.apiUrl.value = value;
    this.saveSettings();
  }

  setModel(value: string): void {
    this.model.value = value;
    this.saveSettings();
  }

  // ========== Processing State Actions ==========

  setProcessingStatus(status: LLMProcessingStatus): void {
    this.processingStatus.value = status;
  }

  setBlockProgress(current: number, total: number): void {
    this.currentBlock.value = current;
    this.totalBlocks.value = total;
  }

  setError(error: string | null): void {
    this.error.value = error;
    if (error) {
      this.processingStatus.value = 'error';
    }
  }

  // ========== Character Data Actions ==========

  setCharacters(characters: LLMCharacter[]): void {
    this.detectedCharacters.value = characters;
  }

  addCharacter(character: LLMCharacter): void {
    this.detectedCharacters.value = [...this.detectedCharacters.value, character];
  }

  updateCharacter(index: number, updates: Partial<LLMCharacter>): void {
    const characters = [...this.detectedCharacters.value];
    if (index >= 0 && index < characters.length) {
      characters[index] = { ...characters[index], ...updates };
      this.detectedCharacters.value = characters;
    }
  }

  removeCharacter(index: number): void {
    const characters = [...this.detectedCharacters.value];
    characters.splice(index, 1);
    this.detectedCharacters.value = characters;
  }

  setVoiceMap(map: Map<string, string>): void {
    this.characterVoiceMap.value = new Map(map);
  }

  updateVoiceMapping(characterName: string, voiceId: string): void {
    const map = new Map(this.characterVoiceMap.value);
    map.set(characterName, voiceId);
    this.characterVoiceMap.value = map;
  }

  removeVoiceMapping(characterName: string): void {
    const map = new Map(this.characterVoiceMap.value);
    map.delete(characterName);
    this.characterVoiceMap.value = map;
  }

  // ========== State Management ==========

  /**
   * Reset processing state (but keep settings)
   */
  resetProcessingState(): void {
    this.processingStatus.value = 'idle';
    this.currentBlock.value = 0;
    this.totalBlocks.value = 0;
    this.error.value = null;
    this.detectedCharacters.value = [];
    this.characterVoiceMap.value = new Map();
  }

  /**
   * Full reset including settings
   */
  reset(): void {
    this.resetProcessingState();
    this.enabled.value = defaultLLMSettings.enabled;
    this.apiKey.value = defaultLLMSettings.apiKey;
    this.apiUrl.value = defaultLLMSettings.apiUrl;
    this.model.value = defaultLLMSettings.model;
  }

  // ========== Persistence ==========

  /**
   * Save settings to localStorage (async for encryption)
   */
  async saveSettings(): Promise<void> {
    try {
      const encryptedKey = await encryptValue(this.apiKey.value);
      const settings: LLMSettings = {
        enabled: this.enabled.value,
        apiKey: encryptedKey,
        apiUrl: this.apiUrl.value,
        model: this.model.value,
      };
      localStorage.setItem(StorageKeys.llmSettings, JSON.stringify(settings));
    } catch (e) {
      this.logStore.error(
        'Failed to save LLM settings',
        e instanceof Error ? e : undefined,
        e instanceof Error ? undefined : { error: String(e) }
      );
    }
  }

  /**
   * Load settings from localStorage (async for decryption)
   */
  async loadSettings(): Promise<void> {
    try {
      const saved = localStorage.getItem(StorageKeys.llmSettings);
      if (saved) {
        const settings: LLMSettings = JSON.parse(saved);
        this.enabled.value = settings.enabled ?? defaultLLMSettings.enabled;
        this.apiKey.value = await decryptValue(settings.apiKey ?? '', this.logStore);
        this.apiUrl.value = settings.apiUrl ?? defaultLLMSettings.apiUrl;
        this.model.value = settings.model ?? defaultLLMSettings.model;
      }
    } catch (e) {
      this.logStore.error(
        'Failed to load LLM settings',
        e instanceof Error ? e : undefined,
        e instanceof Error ? undefined : { error: String(e) }
      );
    }
  }
}

/**
 * Create a new LLMStore instance
 */
export function createLLMStore(logStore: LogStore): LLMStore {
  return new LLMStore(logStore);
}

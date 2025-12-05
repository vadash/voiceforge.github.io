import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMStore, createLLMStore, type LLMProcessingStatus } from './LLMStore';
import { LogStore, createLogStore } from './LogStore';
import type { LLMCharacter } from '@/state/types';
import { StorageKeys } from '@/config/storage';

// Mock SecureStorage
vi.mock('@/services/SecureStorage', () => ({
  encryptValue: vi.fn((value: string) => Promise.resolve(`encrypted:${value}`)),
  decryptValue: vi.fn((value: string) => {
    if (value.startsWith('encrypted:')) {
      return Promise.resolve(value.replace('encrypted:', ''));
    }
    return Promise.resolve(value);
  }),
}));

describe('LLMStore', () => {
  let store: LLMStore;
  let logStore: LogStore;

  beforeEach(() => {
    localStorage.clear();
    logStore = createLogStore();
    store = createLLMStore(logStore);
  });

  describe('initial state', () => {
    it('starts with enabled true', () => {
      expect(store.enabled.value).toBe(true);
    });

    it('starts with empty API key', () => {
      expect(store.apiKey.value).toBe('');
    });

    it('starts with default API URL', () => {
      expect(store.apiUrl.value).toBe('https://api.openai.com/v1');
    });

    it('starts with default model', () => {
      expect(store.model.value).toBe('gpt-4o-mini');
    });

    it('starts with idle processing status', () => {
      expect(store.processingStatus.value).toBe('idle');
    });

    it('starts with zero block progress', () => {
      expect(store.currentBlock.value).toBe(0);
      expect(store.totalBlocks.value).toBe(0);
    });

    it('starts with no error', () => {
      expect(store.error.value).toBeNull();
    });

    it('starts with empty characters', () => {
      expect(store.detectedCharacters.value).toEqual([]);
    });

    it('starts with empty voice map', () => {
      expect(store.characterVoiceMap.value.size).toBe(0);
    });
  });

  describe('computed properties', () => {
    describe('isConfigured', () => {
      it('returns false when no API key', () => {
        expect(store.isConfigured.value).toBe(false);
      });

      it('returns true when API key is set', () => {
        store.setApiKey('sk-test-key');
        expect(store.isConfigured.value).toBe(true);
      });
    });

    describe('isProcessing', () => {
      it('returns false for idle', () => {
        store.setProcessingStatus('idle');
        expect(store.isProcessing.value).toBe(false);
      });

      it('returns true for extract', () => {
        store.setProcessingStatus('extracting');
        expect(store.isProcessing.value).toBe(true);
      });

      it('returns true for assign', () => {
        store.setProcessingStatus('assigning');
        expect(store.isProcessing.value).toBe(true);
      });

      it('returns false for review', () => {
        store.setProcessingStatus('review');
        expect(store.isProcessing.value).toBe(false);
      });

      it('returns false for error', () => {
        store.setProcessingStatus('error');
        expect(store.isProcessing.value).toBe(false);
      });
    });

    describe('blockProgress', () => {
      it('returns current and total blocks', () => {
        store.setBlockProgress(5, 10);
        expect(store.blockProgress.value).toEqual({ current: 5, total: 10 });
      });
    });

    describe('characterNames', () => {
      it('returns empty array when no characters', () => {
        expect(store.characterNames.value).toEqual([]);
      });

      it('returns character names', () => {
        const characters: LLMCharacter[] = [
          { code: 'A', canonicalName: 'Alice', gender: 'female', aliases: [] },
          { code: 'B', canonicalName: 'Bob', gender: 'male', aliases: [] },
        ];
        store.setCharacters(characters);
        expect(store.characterNames.value).toEqual(['Alice', 'Bob']);
      });
    });
  });

  describe('settings actions', () => {
    it('sets enabled', async () => {
      store.setEnabled(false);
      expect(store.enabled.value).toBe(false);
    });

    it('toggles enabled', async () => {
      store.toggleEnabled();
      expect(store.enabled.value).toBe(false);
      store.toggleEnabled();
      expect(store.enabled.value).toBe(true);
    });

    it('sets API key', async () => {
      store.setApiKey('sk-new-key');
      expect(store.apiKey.value).toBe('sk-new-key');
    });

    it('sets API URL', async () => {
      store.setApiUrl('https://custom.api.com');
      expect(store.apiUrl.value).toBe('https://custom.api.com');
    });

    it('sets model', async () => {
      store.setModel('gpt-4');
      expect(store.model.value).toBe('gpt-4');
    });
  });

  describe('processing state actions', () => {
    it('sets processing status', () => {
      store.setProcessingStatus('extracting');
      expect(store.processingStatus.value).toBe('extracting');
    });

    it('sets block progress', () => {
      store.setBlockProgress(3, 7);
      expect(store.currentBlock.value).toBe(3);
      expect(store.totalBlocks.value).toBe(7);
    });

    it('sets error and updates status', () => {
      store.setError('Something went wrong');
      expect(store.error.value).toBe('Something went wrong');
      expect(store.processingStatus.value).toBe('error');
    });

    it('clears error without changing status', () => {
      store.setProcessingStatus('extracting');
      store.setError(null);
      expect(store.error.value).toBeNull();
      expect(store.processingStatus.value).toBe('extracting');
    });
  });

  describe('character data actions', () => {
    const mockCharacter: LLMCharacter = {
      code: 'A',
      canonicalName: 'Alice',
      gender: 'female',
      aliases: ['Алиса'],
    };

    it('sets characters', () => {
      store.setCharacters([mockCharacter]);
      expect(store.detectedCharacters.value).toEqual([mockCharacter]);
    });

    it('adds character', () => {
      store.addCharacter(mockCharacter);
      expect(store.detectedCharacters.value).toContainEqual(mockCharacter);
    });

    it('updates character', () => {
      store.setCharacters([mockCharacter]);
      store.updateCharacter(0, { canonicalName: 'Alicia' });
      expect(store.detectedCharacters.value[0].canonicalName).toBe('Alicia');
    });

    it('does not update character at invalid index', () => {
      store.setCharacters([mockCharacter]);
      store.updateCharacter(5, { canonicalName: 'Changed' });
      expect(store.detectedCharacters.value[0].canonicalName).toBe('Alice');
    });

    it('removes character', () => {
      store.setCharacters([mockCharacter]);
      store.removeCharacter(0);
      expect(store.detectedCharacters.value).toEqual([]);
    });
  });

  describe('voice map actions', () => {
    it('sets voice map', () => {
      const map = new Map([['Alice', 'voice-1'], ['Bob', 'voice-2']]);
      store.setVoiceMap(map);
      expect(store.characterVoiceMap.value.get('Alice')).toBe('voice-1');
      expect(store.characterVoiceMap.value.get('Bob')).toBe('voice-2');
    });

    it('updates voice mapping', () => {
      store.updateVoiceMapping('Alice', 'voice-1');
      expect(store.characterVoiceMap.value.get('Alice')).toBe('voice-1');
    });

    it('removes voice mapping', () => {
      store.updateVoiceMapping('Alice', 'voice-1');
      store.removeVoiceMapping('Alice');
      expect(store.characterVoiceMap.value.has('Alice')).toBe(false);
    });
  });

  describe('state management', () => {
    it('resets processing state but keeps settings', () => {
      store.setApiKey('sk-key');
      store.setProcessingStatus('extracting');
      store.setBlockProgress(5, 10);
      store.setError('Error');
      store.setCharacters([{ code: 'A', canonicalName: 'Alice', gender: 'female', aliases: [] }]);
      store.updateVoiceMapping('Alice', 'voice-1');

      store.resetProcessingState();

      expect(store.processingStatus.value).toBe('idle');
      expect(store.currentBlock.value).toBe(0);
      expect(store.totalBlocks.value).toBe(0);
      expect(store.error.value).toBeNull();
      expect(store.detectedCharacters.value).toEqual([]);
      expect(store.characterVoiceMap.value.size).toBe(0);
      // Settings preserved
      expect(store.apiKey.value).toBe('sk-key');
    });

    it('full reset clears everything', () => {
      store.setApiKey('sk-key');
      store.setApiUrl('https://custom.api.com');
      store.setModel('gpt-4');
      store.setEnabled(false);
      store.setProcessingStatus('extracting');

      store.reset();

      expect(store.enabled.value).toBe(true);
      expect(store.apiKey.value).toBe('');
      expect(store.apiUrl.value).toBe('https://api.openai.com/v1');
      expect(store.model.value).toBe('gpt-4o-mini');
      expect(store.processingStatus.value).toBe('idle');
    });
  });

  describe('persistence', () => {
    it('saves settings to localStorage', async () => {
      store.setApiKey('sk-test');
      store.setApiUrl('https://custom.api.com');
      store.setModel('gpt-4');
      store.setEnabled(false);

      await store.saveSettings();

      const saved = localStorage.getItem(StorageKeys.llmSettings);
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(parsed.enabled).toBe(false);
      expect(parsed.apiKey).toBe('encrypted:sk-test');
      expect(parsed.apiUrl).toBe('https://custom.api.com');
      expect(parsed.model).toBe('gpt-4');
    });

    it('loads settings from localStorage', async () => {
      localStorage.setItem(StorageKeys.llmSettings, JSON.stringify({
        enabled: false,
        apiKey: 'encrypted:sk-loaded',
        apiUrl: 'https://loaded.api.com',
        model: 'gpt-3.5-turbo',
      }));

      await store.loadSettings();

      expect(store.enabled.value).toBe(false);
      expect(store.apiKey.value).toBe('sk-loaded');
      expect(store.apiUrl.value).toBe('https://loaded.api.com');
      expect(store.model.value).toBe('gpt-3.5-turbo');
    });

    it('uses defaults for missing settings', async () => {
      localStorage.setItem(StorageKeys.llmSettings, JSON.stringify({}));

      await store.loadSettings();

      expect(store.enabled.value).toBe(true);
      expect(store.apiKey.value).toBe('');
      expect(store.apiUrl.value).toBe('https://api.openai.com/v1');
      expect(store.model.value).toBe('gpt-4o-mini');
    });

    it('handles missing localStorage gracefully', async () => {
      await store.loadSettings();
      // Should not throw and keep defaults
      expect(store.enabled.value).toBe(true);
    });
  });
});

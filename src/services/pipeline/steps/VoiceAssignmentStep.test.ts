import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceAssignmentStep, createVoiceAssignmentStep } from './VoiceAssignmentStep';
import { createTestContext, createNeverAbortSignal, createTestAbortController, collectProgress, createContextWithCharacters } from '@/test/pipeline/helpers';
import type { IVoiceAssigner, LLMCharacter } from '@/services/interfaces';

describe('VoiceAssignmentStep', () => {
  let step: VoiceAssignmentStep;
  let mockVoiceAssigner: IVoiceAssigner;

  const createMockAssigner = (voiceMap: Map<string, string>): IVoiceAssigner => ({
    assignVoicesFromLLMCharacters: vi.fn(() => voiceMap),
    getNarratorVoice: vi.fn(() => 'narrator-voice'),
    reset: vi.fn(),
  });

  const testCharacters: LLMCharacter[] = [
    { code: 'A', canonicalName: 'Alice', gender: 'female', aliases: [] },
    { code: 'B', canonicalName: 'Bob', gender: 'male', aliases: [] },
  ];

  beforeEach(() => {
    const defaultVoiceMap = new Map([
      ['Alice', 'voice-female-1'],
      ['Bob', 'voice-male-1'],
    ]);
    mockVoiceAssigner = createMockAssigner(defaultVoiceMap);

    step = createVoiceAssignmentStep({
      narratorVoice: 'narrator-voice-id',
      detectedLanguage: 'en',
      createVoiceAssigner: () => mockVoiceAssigner,
    });
  });

  describe('name', () => {
    it('has correct step name', () => {
      expect(step.name).toBe('voice-assignment');
    });
  });

  describe('execute', () => {
    it('assigns voices to characters', async () => {
      const context = createContextWithCharacters(testCharacters);
      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.voiceMap).toBeDefined();
      expect(result.voiceMap!.size).toBe(2);
      expect(result.voiceMap!.get('Alice')).toBe('voice-female-1');
      expect(result.voiceMap!.get('Bob')).toBe('voice-male-1');
    });

    it('calls voice assigner with characters', async () => {
      const context = createContextWithCharacters(testCharacters);
      await step.execute(context, createNeverAbortSignal());

      expect(mockVoiceAssigner.assignVoicesFromLLMCharacters).toHaveBeenCalledWith(testCharacters);
    });

    it('preserves existing context properties', async () => {
      const context = createContextWithCharacters(testCharacters, {
        text: 'Original text.',
        fileNames: [['chapter1', 0]],
      });

      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.text).toBe('Original text.');
      expect(result.fileNames).toEqual([['chapter1', 0]]);
      expect(result.characters).toEqual(testCharacters);
    });

    it('uses detected language from context', async () => {
      let usedLocale: string | undefined;
      const stepWithLocaleCapture = createVoiceAssignmentStep({
        narratorVoice: 'narrator',
        detectedLanguage: 'en',
        createVoiceAssigner: (narrator, locale) => {
          usedLocale = locale;
          return mockVoiceAssigner;
        },
      });

      const context = createContextWithCharacters(testCharacters, { detectedLanguage: 'ru' });
      await stepWithLocaleCapture.execute(context, createNeverAbortSignal());

      expect(usedLocale).toBe('ru');
    });

    it('falls back to options language when context has no detected language', async () => {
      let usedLocale: string | undefined;
      const stepWithLocaleCapture = createVoiceAssignmentStep({
        narratorVoice: 'narrator',
        detectedLanguage: 'de',
        createVoiceAssigner: (narrator, locale) => {
          usedLocale = locale;
          return mockVoiceAssigner;
        },
      });

      // Explicitly set detectedLanguage to undefined to trigger fallback
      const context = createContextWithCharacters(testCharacters, { detectedLanguage: undefined as any });
      await stepWithLocaleCapture.execute(context, createNeverAbortSignal());

      expect(usedLocale).toBe('de');
    });
  });

  describe('empty characters', () => {
    it('returns empty voice map when no characters', async () => {
      const context = createContextWithCharacters([]);
      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.voiceMap).toBeDefined();
      expect(result.voiceMap!.size).toBe(0);
    });

    it('returns empty voice map when characters undefined', async () => {
      const context = createTestContext();
      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.voiceMap).toBeDefined();
      expect(result.voiceMap!.size).toBe(0);
    });
  });

  describe('progress reporting', () => {
    it('reports progress during assignment', async () => {
      const context = createContextWithCharacters(testCharacters);
      const { progress } = await collectProgress(step, context);

      expect(progress.length).toBeGreaterThan(0);
    });

    it('reports no characters message when empty', async () => {
      const context = createContextWithCharacters([]);
      const { progress } = await collectProgress(step, context);

      expect(progress.some(p => p.message.toLowerCase().includes('no character'))).toBe(true);
    });

    it('reports assigned voice count', async () => {
      const context = createContextWithCharacters(testCharacters);
      const { progress } = await collectProgress(step, context);

      const finalProgress = progress[progress.length - 1];
      expect(finalProgress.message).toContain('2 voice');
    });
  });

  describe('cancellation', () => {
    it('throws when aborted before execution', async () => {
      const controller = createTestAbortController();
      controller.abort();

      await expect(step.execute(createContextWithCharacters(testCharacters), controller.signal))
        .rejects.toThrow();
    });
  });
});

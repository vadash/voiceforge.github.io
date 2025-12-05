import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CharacterExtractionStep, createCharacterExtractionStep } from './CharacterExtractionStep';
import { createMockLLMService } from '@/test/mocks/MockLLMService';
import { createTestContext, createNeverAbortSignal, createTestAbortController, collectProgress } from '@/test/pipeline/helpers';
import type { ITextBlockSplitter, TextBlock, LLMCharacter } from '@/services/interfaces';

describe('CharacterExtractionStep', () => {
  let step: CharacterExtractionStep;
  let mockLLMService: ReturnType<typeof createMockLLMService>;
  let mockTextBlockSplitter: ITextBlockSplitter;

  const createMockSplitter = (blocks: TextBlock[]): ITextBlockSplitter => ({
    createExtractBlocks: vi.fn(() => blocks),
    createAssignBlocks: vi.fn(() => blocks),
    splitIntoSentences: vi.fn((text: string) => text.split('. ').filter(Boolean).map(s => s.endsWith('.') ? s : s + '.')),
  });

  beforeEach(() => {
    mockLLMService = createMockLLMService();
    mockTextBlockSplitter = createMockSplitter([
      { startIndex: 0, sentenceStartIndex: 0, text: 'Block 1 text.', sentences: ['Block 1 text.'] },
      { startIndex: 1, sentenceStartIndex: 1, text: 'Block 2 text.', sentences: ['Block 2 text.'] },
    ]);

    step = createCharacterExtractionStep({
      llmOptions: { apiKey: 'test-key', apiUrl: 'https://api.test.com', model: 'gpt-4' },
      createLLMService: () => mockLLMService,
      textBlockSplitter: mockTextBlockSplitter,
    });
  });

  describe('name', () => {
    it('has correct step name', () => {
      expect(step.name).toBe('character-extraction');
    });
  });

  describe('execute', () => {
    it('extracts characters from text', async () => {
      const context = createTestContext({ text: 'Alice said hello. Bob replied.' });
      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.characters).toBeDefined();
      expect(result.characters!.length).toBeGreaterThan(0);
    });

    it('calls LLM service with blocks', async () => {
      const context = createTestContext({ text: 'Test text.' });
      await step.execute(context, createNeverAbortSignal());

      expect(mockLLMService.extractCharacters).toHaveBeenCalled();
      const [blocks] = mockLLMService.extractCharacters.mock.calls[0];
      expect(blocks).toHaveLength(2);
    });

    it('preserves existing context properties', async () => {
      const context = createTestContext({
        text: 'Test.',
        fileNames: [['chapter1', 0]],
        dictionaryRules: [{ type: 'word', pattern: 'test', replacement: 'тест' }],
      });

      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.text).toBe('Test.');
      expect(result.fileNames).toEqual([['chapter1', 0]]);
      expect(result.dictionaryRules).toHaveLength(1);
    });

    it('uses text block splitter for extract blocks', async () => {
      const context = createTestContext({ text: 'Some text content.' });
      await step.execute(context, createNeverAbortSignal());

      expect(mockTextBlockSplitter.createExtractBlocks).toHaveBeenCalledWith('Some text content.');
    });
  });

  describe('progress reporting', () => {
    it('reports progress during extraction', async () => {
      const context = createTestContext({ text: 'Test text.' });
      const { progress } = await collectProgress(step, context);

      expect(progress.length).toBeGreaterThan(0);
      expect(progress.some(p => p.message.toLowerCase().includes('block'))).toBe(true);
    });

    it('reports final character count', async () => {
      mockLLMService.extractCharacters.mockResolvedValueOnce([
        { canonicalName: 'Alice', gender: 'female', aliases: [] },
        { canonicalName: 'Bob', gender: 'male', aliases: [] },
      ] as LLMCharacter[]);

      const context = createTestContext({ text: 'Test.' });
      const { progress } = await collectProgress(step, context);

      const finalProgress = progress[progress.length - 1];
      expect(finalProgress.message).toContain('2 character');
    });
  });

  describe('cancellation', () => {
    it('throws when aborted before execution', async () => {
      const controller = createTestAbortController();
      controller.abort();

      await expect(step.execute(createTestContext(), controller.signal))
        .rejects.toThrow();
    });

    it('cancels LLM service when aborted', async () => {
      const controller = createTestAbortController();

      // Make extraction never complete naturally
      mockLLMService.extractCharacters.mockImplementation(async () => {
        return new Promise((_, reject) => {
          // Reject when cancelled
          const checkCancelled = setInterval(() => {
            if (mockLLMService.cancel.mock.calls.length > 0) {
              clearInterval(checkCancelled);
              reject(new Error('Cancelled'));
            }
          }, 10);
        });
      });

      const context = createTestContext();
      const promise = step.execute(context, controller.signal);

      // Abort during execution
      await new Promise(resolve => setTimeout(resolve, 20));
      controller.abort();

      // The cancel method should be called
      await expect(promise).rejects.toThrow();
      expect(mockLLMService.cancel).toHaveBeenCalled();
    });
  });

  describe('empty results', () => {
    it('handles no characters found', async () => {
      mockLLMService.extractCharacters.mockResolvedValueOnce([]);

      const result = await step.execute(createTestContext(), createNeverAbortSignal());

      expect(result.characters).toEqual([]);
    });
  });
});

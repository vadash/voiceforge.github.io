import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveStep, createSaveStep } from './SaveStep';
import { createTestContext, createNeverAbortSignal, createTestAbortController, collectProgress, createMockDirectoryHandle } from '@/test/pipeline/helpers';
import type { IAudioMerger, MergerConfig, MergedFile } from '@/services/interfaces';

describe('SaveStep', () => {
  let step: SaveStep;
  let mockAudioMerger: IAudioMerger;

  const testMergedFiles: MergedFile[] = [
    { filename: 'output_001.mp3', blob: new Blob([new Uint8Array([1, 2, 3])]), fromIndex: 0, toIndex: 0 },
    { filename: 'output_002.mp3', blob: new Blob([new Uint8Array([4, 5, 6])]), fromIndex: 1, toIndex: 1 },
  ];

  const createMockMerger = (): IAudioMerger => ({
    calculateMergeGroups: vi.fn(async () => []),
    merge: vi.fn(async () => []),
    saveMergedFiles: vi.fn(async () => {}),
  });

  beforeEach(() => {
    mockAudioMerger = createMockMerger();

    step = createSaveStep({
      createAudioMerger: () => mockAudioMerger,
    });
  });

  describe('name', () => {
    it('has correct step name', () => {
      expect(step.name).toBe('save');
    });
  });

  describe('execute', () => {
    it('saves merged files', async () => {
      const context = createTestContext({
        mergedFiles: testMergedFiles,
      });

      await step.execute(context, createNeverAbortSignal());

      // directoryHandle is now provided by default in createTestContext
      expect(mockAudioMerger.saveMergedFiles).toHaveBeenCalledWith(testMergedFiles, expect.anything());
    });

    it('saves to directory handle when provided', async () => {
      const mockHandle = createMockDirectoryHandle();
      const context = createTestContext({
        mergedFiles: testMergedFiles,
        directoryHandle: mockHandle,
      });

      await step.execute(context, createNeverAbortSignal());

      expect(mockAudioMerger.saveMergedFiles).toHaveBeenCalledWith(testMergedFiles, mockHandle);
    });

    it('preserves existing context properties', async () => {
      const context = createTestContext({
        text: 'Original text.',
        mergedFiles: testMergedFiles,
        audioMap: new Map([[0, 'chunk_000000.bin']]),
      });

      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.text).toBe('Original text.');
      expect(result.mergedFiles).toEqual(testMergedFiles);
      expect(result.audioMap?.size).toBe(1);
    });

    it('returns context unchanged', async () => {
      const context = createTestContext({
        mergedFiles: testMergedFiles,
      });

      const result = await step.execute(context, createNeverAbortSignal());

      expect(result).toEqual(context);
    });
  });

  describe('empty files', () => {
    it('handles no files to save', async () => {
      const context = createTestContext({
        mergedFiles: [],
      });

      const result = await step.execute(context, createNeverAbortSignal());

      expect(mockAudioMerger.saveMergedFiles).not.toHaveBeenCalled();
      expect(result).toEqual(context);
    });

    it('handles undefined mergedFiles', async () => {
      const context = createTestContext();

      const result = await step.execute(context, createNeverAbortSignal());

      expect(mockAudioMerger.saveMergedFiles).not.toHaveBeenCalled();
      expect(result).toEqual(context);
    });
  });

  describe('progress reporting', () => {
    it('reports progress during save', async () => {
      const context = createTestContext({
        mergedFiles: testMergedFiles,
      });

      const { progress } = await collectProgress(step, context);

      expect(progress.length).toBeGreaterThan(0);
    });

    it('reports file count in initial message', async () => {
      const context = createTestContext({
        mergedFiles: testMergedFiles,
      });

      const { progress } = await collectProgress(step, context);

      expect(progress[0].message).toContain('2 file');
    });

    it('reports save complete', async () => {
      const context = createTestContext({
        mergedFiles: testMergedFiles,
      });

      const { progress } = await collectProgress(step, context);

      const finalProgress = progress[progress.length - 1];
      expect(finalProgress.message.toLowerCase()).toContain('complete');
    });

    it('reports no files message when empty', async () => {
      const context = createTestContext({
        mergedFiles: [],
      });

      const { progress } = await collectProgress(step, context);

      expect(progress.some(p => p.message.toLowerCase().includes('no file'))).toBe(true);
    });
  });

  describe('cancellation', () => {
    it('throws when aborted before execution', async () => {
      const controller = createTestAbortController();
      controller.abort();

      const context = createTestContext({
        mergedFiles: testMergedFiles,
      });

      await expect(step.execute(context, controller.signal))
        .rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('propagates save errors', async () => {
      mockAudioMerger.saveMergedFiles = vi.fn(async () => {
        throw new Error('Save failed');
      });

      const context = createTestContext({
        mergedFiles: testMergedFiles,
      });

      await expect(step.execute(context, createNeverAbortSignal()))
        .rejects.toThrow('Save failed');
    });
  });
});

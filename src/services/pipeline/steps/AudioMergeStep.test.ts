import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioMergeStep, createAudioMergeStep } from './AudioMergeStep';
import { createTestContext, createNeverAbortSignal, createTestAbortController, collectProgress, createContextWithAudio, createMockDirectoryHandle } from '@/test/pipeline/helpers';
import { createMockFFmpegService } from '@/test/mocks/MockFFmpegService';
import type { IAudioMerger, MergerConfig, MergedFile, IFFmpegService } from '@/services/interfaces';

describe('AudioMergeStep', () => {
  let step: AudioMergeStep;
  let mockFFmpegService: ReturnType<typeof createMockFFmpegService>;
  let mockAudioMerger: IAudioMerger;
  let capturedConfig: MergerConfig | undefined;

  // Disk-based audio map: index -> temp filename
  const testAudioMap = new Map<number, string>([
    [0, 'chunk_000000.bin'],
    [1, 'chunk_000001.bin'],
    [2, 'chunk_000002.bin'],
  ]);

  const testMergedFiles: MergedFile[] = [
    { filename: 'output_001.mp3', blob: new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])]), fromIndex: 0, toIndex: 2 },
  ];

  const createMockMerger = (files: MergedFile[]): IAudioMerger => ({
    calculateMergeGroups: vi.fn(async () => [{ fromIndex: 0, toIndex: 2, filename: 'test', mergeNumber: 1, durationMs: 1000 }]),
    merge: vi.fn(async () => files),
    saveMergedFiles: vi.fn(async () => {}),
  });

  beforeEach(() => {
    capturedConfig = undefined;
    mockFFmpegService = createMockFFmpegService();
    mockFFmpegService.load.mockResolvedValue(true);

    mockAudioMerger = createMockMerger(testMergedFiles);

    step = createAudioMergeStep({
      outputFormat: 'mp3',
      silenceRemoval: false,
      normalization: false,
      deEss: false,
      ffmpegService: mockFFmpegService,
      createAudioMerger: (config) => {
        capturedConfig = config;
        return mockAudioMerger;
      },
    });
  });

  describe('name', () => {
    it('has correct step name', () => {
      expect(step.name).toBe('audio-merge');
    });
  });

  describe('execute', () => {
    it('merges audio chunks', async () => {
      const context = createContextWithAudio(testAudioMap);
      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.mergedFiles).toBeDefined();
      expect(result.mergedFiles!.length).toBe(1);
    });

    it('calls audio merger with correct parameters', async () => {
      const context = createContextWithAudio(testAudioMap, {
        fileNames: [['chapter1', 0]],
        assignments: [
          { sentenceIndex: 0, text: 'A', speaker: 'N', voiceId: 'v1' },
          { sentenceIndex: 1, text: 'B', speaker: 'N', voiceId: 'v1' },
          { sentenceIndex: 2, text: 'C', speaker: 'N', voiceId: 'v1' },
        ],
      });

      await step.execute(context, createNeverAbortSignal());

      expect(mockAudioMerger.merge).toHaveBeenCalled();
      const [audioMap, totalChunks, fileNames, tempDirHandle] = (mockAudioMerger.merge as any).mock.calls[0];
      expect(audioMap.size).toBe(3);
      expect(totalChunks).toBe(3);
      expect(fileNames).toEqual([['chapter1', 0]]);
      expect(tempDirHandle).toBeDefined();
    });

    it('preserves existing context properties', async () => {
      const context = createContextWithAudio(testAudioMap, {
        text: 'Original text.',
        characters: [{ code: 'A', canonicalName: 'Alice', gender: 'female', aliases: [] }],
      });

      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.text).toBe('Original text.');
      expect(result.characters).toHaveLength(1);
      expect(result.audioMap).toBe(testAudioMap);
    });
  });

  describe('output format', () => {
    it('uses MP3 format by default', async () => {
      const context = createContextWithAudio(testAudioMap);
      await step.execute(context, createNeverAbortSignal());

      expect(capturedConfig?.outputFormat).toBe('mp3');
    });

    it('uses Opus format when specified and FFmpeg loads', async () => {
      step = createAudioMergeStep({
        outputFormat: 'opus',
        silenceRemoval: false,
        normalization: false,
        deEss: false,
        ffmpegService: mockFFmpegService,
        createAudioMerger: (config) => {
          capturedConfig = config;
          return mockAudioMerger;
        },
      });

      const context = createContextWithAudio(testAudioMap);
      await step.execute(context, createNeverAbortSignal());

      expect(mockFFmpegService.load).toHaveBeenCalled();
      expect(capturedConfig?.outputFormat).toBe('opus');
    });

    it('falls back to MP3 when FFmpeg fails to load', async () => {
      mockFFmpegService.load.mockResolvedValue(false);

      step = createAudioMergeStep({
        outputFormat: 'opus',
        silenceRemoval: false,
        normalization: false,
        deEss: false,
        ffmpegService: mockFFmpegService,
        createAudioMerger: (config) => {
          capturedConfig = config;
          return mockAudioMerger;
        },
      });

      const context = createContextWithAudio(testAudioMap);
      await step.execute(context, createNeverAbortSignal());

      expect(capturedConfig?.outputFormat).toBe('mp3');
    });

    it('does not load FFmpeg for MP3 format', async () => {
      const context = createContextWithAudio(testAudioMap);
      await step.execute(context, createNeverAbortSignal());

      expect(mockFFmpegService.load).not.toHaveBeenCalled();
    });
  });

  describe('audio processing options', () => {
    it('passes silence removal option', async () => {
      step = createAudioMergeStep({
        outputFormat: 'mp3',
        silenceRemoval: true,
        normalization: false,
        deEss: false,
        ffmpegService: mockFFmpegService,
        createAudioMerger: (config) => {
          capturedConfig = config;
          return mockAudioMerger;
        },
      });

      const context = createContextWithAudio(testAudioMap);
      await step.execute(context, createNeverAbortSignal());

      expect(capturedConfig?.silenceRemoval).toBe(true);
    });

    it('passes normalization option', async () => {
      step = createAudioMergeStep({
        outputFormat: 'mp3',
        silenceRemoval: false,
        normalization: true,
        deEss: false,
        ffmpegService: mockFFmpegService,
        createAudioMerger: (config) => {
          capturedConfig = config;
          return mockAudioMerger;
        },
      });

      const context = createContextWithAudio(testAudioMap);
      await step.execute(context, createNeverAbortSignal());

      expect(capturedConfig?.normalization).toBe(true);
    });
  });

  describe('empty audio', () => {
    it('returns empty merged files when no audio', async () => {
      const context = createContextWithAudio(new Map());
      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.mergedFiles).toEqual([]);
    });

    it('returns empty merged files when audioMap undefined', async () => {
      const context = createTestContext();
      const result = await step.execute(context, createNeverAbortSignal());

      expect(result.mergedFiles).toEqual([]);
    });
  });

  describe('progress reporting', () => {
    it('reports progress during merge', async () => {
      const context = createContextWithAudio(testAudioMap);
      const { progress } = await collectProgress(step, context);

      expect(progress.length).toBeGreaterThan(0);
    });

    it('reports FFmpeg loading for Opus', async () => {
      step = createAudioMergeStep({
        outputFormat: 'opus',
        silenceRemoval: false,
        normalization: false,
        deEss: false,
        ffmpegService: mockFFmpegService,
        createAudioMerger: () => mockAudioMerger,
      });

      const context = createContextWithAudio(testAudioMap);
      const { progress } = await collectProgress(step, context);

      expect(progress.some(p => p.message.toLowerCase().includes('ffmpeg'))).toBe(true);
    });

    it('reports merged file count', async () => {
      const context = createContextWithAudio(testAudioMap);
      const { progress } = await collectProgress(step, context);

      const finalProgress = progress[progress.length - 1];
      expect(finalProgress.message).toContain('1 merged');
    });
  });

  describe('cancellation', () => {
    it('throws when aborted before execution', async () => {
      const controller = createTestAbortController();
      controller.abort();

      const context = createContextWithAudio(testAudioMap);
      await expect(step.execute(context, controller.signal))
        .rejects.toThrow();
    });

    it('checks cancellation after FFmpeg loading', async () => {
      const controller = createTestAbortController();

      mockFFmpegService.load.mockImplementation(async () => {
        controller.abort();
        return true;
      });

      step = createAudioMergeStep({
        outputFormat: 'opus',
        silenceRemoval: false,
        normalization: false,
        deEss: false,
        ffmpegService: mockFFmpegService,
        createAudioMerger: () => mockAudioMerger,
      });

      const context = createContextWithAudio(testAudioMap);
      await expect(step.execute(context, controller.signal))
        .rejects.toThrow();
    });
  });
});

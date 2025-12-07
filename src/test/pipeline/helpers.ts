// Pipeline Test Helpers
// Utilities for testing pipeline steps

import type { PipelineContext, IPipelineStep, ProgressCallback } from '@/services/pipeline/types';
import type { LLMCharacter, SpeakerAssignment } from '@/state/types';
import type { MergedFile } from '@/services/interfaces';

/**
 * Create a mock FileSystemDirectoryHandle for testing
 */
export function createMockDirectoryHandle(): FileSystemDirectoryHandle {
  const files = new Map<string, Uint8Array>();

  const mockFileHandle = (name: string): FileSystemFileHandle => ({
    kind: 'file',
    name,
    isSameEntry: async () => false,
    getFile: async () => {
      const data = files.get(name) ?? new Uint8Array([]);
      return new File([data], name, { type: 'audio/mpeg' });
    },
    createWritable: async () => ({
      write: async (data: BufferSource | Blob | string) => {
        if (data instanceof ArrayBuffer) {
          files.set(name, new Uint8Array(data));
        } else if (data instanceof Blob) {
          const buffer = await data.arrayBuffer();
          files.set(name, new Uint8Array(buffer));
        }
      },
      close: async () => {},
      seek: async () => {},
      truncate: async () => {},
      abort: async () => {},
      locked: false,
      getWriter: () => ({ write: async () => {}, close: async () => {}, abort: async () => {}, closed: Promise.resolve(), desiredSize: 0, ready: Promise.resolve(), releaseLock: () => {} } as unknown as WritableStreamDefaultWriter<unknown>),
    } as unknown as FileSystemWritableFileStream),
    queryPermission: async () => 'granted' as PermissionState,
    requestPermission: async () => 'granted' as PermissionState,
  } as FileSystemFileHandle);

  const mockDirHandle: FileSystemDirectoryHandle = {
    kind: 'directory',
    name: 'test-dir',
    isSameEntry: async () => false,
    getDirectoryHandle: async (name: string, options?: { create?: boolean }) => {
      return createMockDirectoryHandle();
    },
    getFileHandle: async (name: string, options?: { create?: boolean }) => {
      return mockFileHandle(name);
    },
    removeEntry: async () => {},
    resolve: async () => null,
    keys: async function* () {},
    values: async function* () {},
    entries: async function* () {},
    [Symbol.asyncIterator]: async function* () {},
    queryPermission: async () => 'granted' as PermissionState,
    requestPermission: async () => 'granted' as PermissionState,
  } as FileSystemDirectoryHandle;

  return mockDirHandle;
}

/**
 * Create a test pipeline context with defaults
 */
export function createTestContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    text: 'Test text content.',
    fileNames: [['test_file', 0]],
    dictionaryRules: [],
    detectedLanguage: 'en',
    directoryHandle: createMockDirectoryHandle(),
    ...overrides,
  };
}

/**
 * Create a context with characters already extracted
 */
export function createContextWithCharacters(
  characters: LLMCharacter[],
  overrides: Partial<PipelineContext> = {}
): PipelineContext {
  return createTestContext({
    characters,
    ...overrides,
  });
}

/**
 * Create a context with voice map
 */
export function createContextWithVoiceMap(
  characters: LLMCharacter[],
  voiceMap: Map<string, string>,
  overrides: Partial<PipelineContext> = {}
): PipelineContext {
  return createTestContext({
    characters,
    voiceMap,
    ...overrides,
  });
}

/**
 * Create a context with assignments
 */
export function createContextWithAssignments(
  assignments: SpeakerAssignment[],
  overrides: Partial<PipelineContext> = {}
): PipelineContext {
  return createTestContext({
    assignments,
    ...overrides,
  });
}

/**
 * Create a context with audio map (disk-based: index -> filename)
 */
export function createContextWithAudio(
  audioMap: Map<number, string>,
  overrides: Partial<PipelineContext> = {}
): PipelineContext {
  return createTestContext({
    audioMap,
    tempDirHandle: createMockDirectoryHandle(),
    ...overrides,
  });
}

/**
 * Create a mock pipeline step for testing
 */
export function createMockStep(
  name: string,
  executeFn?: (context: PipelineContext, signal: AbortSignal) => Promise<PipelineContext>
): IPipelineStep {
  let progressCallback: ProgressCallback | undefined;

  return {
    name,
    async execute(context: PipelineContext, signal: AbortSignal): Promise<PipelineContext> {
      if (executeFn) {
        return executeFn(context, signal);
      }
      return context;
    },
    setProgressCallback(callback: ProgressCallback): void {
      progressCallback = callback;
    },
  };
}

/**
 * Create a mock step that adds characters to context
 */
export function createMockCharacterStep(characters: LLMCharacter[]): IPipelineStep {
  return createMockStep('mock-character', async (context) => ({
    ...context,
    characters,
  }));
}

/**
 * Create a mock step that adds voice map to context
 */
export function createMockVoiceMapStep(voiceMap: Map<string, string>): IPipelineStep {
  return createMockStep('mock-voicemap', async (context) => ({
    ...context,
    voiceMap,
  }));
}

/**
 * Create a mock step that adds assignments to context
 */
export function createMockAssignmentStep(assignments: SpeakerAssignment[]): IPipelineStep {
  return createMockStep('mock-assignment', async (context) => ({
    ...context,
    assignments,
  }));
}

/**
 * Create a mock step that adds audio to context (disk-based)
 */
export function createMockAudioStep(audioMap: Map<number, string>): IPipelineStep {
  return createMockStep('mock-audio', async (context) => ({
    ...context,
    audioMap,
    tempDirHandle: createMockDirectoryHandle(),
    failedTasks: new Set(),
  }));
}

/**
 * Create a mock step that adds merged files to context
 */
export function createMockMergeStep(mergedFiles: MergedFile[]): IPipelineStep {
  return createMockStep('mock-merge', async (context) => ({
    ...context,
    mergedFiles,
  }));
}

/**
 * Create an abort controller for testing cancellation
 */
export function createTestAbortController(): AbortController {
  return new AbortController();
}

/**
 * Create a never-aborting signal for simple tests
 */
export function createNeverAbortSignal(): AbortSignal {
  return new AbortController().signal;
}

/**
 * Collect progress updates during step execution
 */
export async function collectProgress(
  step: IPipelineStep,
  context: PipelineContext,
  signal: AbortSignal = createNeverAbortSignal()
): Promise<{ result: PipelineContext; progress: Array<{ current: number; total: number; message: string }> }> {
  const progress: Array<{ current: number; total: number; message: string }> = [];

  step.setProgressCallback((p) => {
    progress.push({
      current: p.current,
      total: p.total,
      message: p.message,
    });
  });

  const result = await step.execute(context, signal);

  return { result, progress };
}

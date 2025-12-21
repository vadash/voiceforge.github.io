import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TTSWorkerPool, type WorkerPoolOptions } from './TTSWorkerPool';
import type { PoolTask } from './interfaces';
import type { TTSConfig as VoiceConfig, StatusUpdate } from '@/state/types';
import { createMockDirectoryHandle } from '@/test/pipeline/helpers';

// Mock the ReusableEdgeTTSService
vi.mock('./ReusableEdgeTTSService', () => {
  return {
    ReusableEdgeTTSService: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      disconnect: vi.fn(),
      isReady: vi.fn().mockReturnValue(true),
      getState: vi.fn().mockReturnValue('READY'),
    })),
  };
});

// Get the mocked class for access in tests
import { ReusableEdgeTTSService } from './ReusableEdgeTTSService';
const MockedReusableEdgeTTSService = vi.mocked(ReusableEdgeTTSService);

describe('TTSWorkerPool', () => {
  let pool: TTSWorkerPool;
  let defaultOptions: WorkerPoolOptions;
  let defaultVoiceConfig: VoiceConfig;
  let mockSend: ReturnType<typeof vi.fn>;
  let mockConnect: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;
  let mockIsReady: ReturnType<typeof vi.fn>;
  let mockDirectoryHandle: FileSystemDirectoryHandle;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Create mock directory handle
    mockDirectoryHandle = createMockDirectoryHandle();

    // Get fresh mock functions for each test
    mockSend = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockConnect = vi.fn().mockResolvedValue(undefined);
    mockDisconnect = vi.fn();
    mockIsReady = vi.fn().mockReturnValue(true);

    MockedReusableEdgeTTSService.mockImplementation(() => ({
      connect: mockConnect,
      send: mockSend,
      disconnect: mockDisconnect,
      isReady: mockIsReady,
      getState: vi.fn().mockReturnValue('READY'),
    }));

    defaultVoiceConfig = {
      voice: 'Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)',
      rate: '+0%',
      pitch: '+0Hz',
    };

    defaultOptions = {
      maxWorkers: 3,
      config: defaultVoiceConfig,
      directoryHandle: mockDirectoryHandle,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createPool = (options: Partial<WorkerPoolOptions> = {}) => {
    return new TTSWorkerPool({ ...defaultOptions, ...options });
  };

  const createTask = (partIndex: number): PoolTask => ({
    partIndex,
    text: `Text for part ${partIndex}`,
    filename: 'test',
    filenum: String(partIndex + 1).padStart(4, '0'),
  });

  describe('addTask', () => {
    it('adds a single task to the queue', () => {
      pool = createPool();
      pool.addTask(createTask(0));

      expect(pool.getProgress().total).toBe(1);
    });

    it('processes task through worker', async () => {
      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(0);

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('addTasks', () => {
    it('adds multiple tasks', () => {
      pool = createPool();
      pool.addTasks([createTask(0), createTask(1), createTask(2)]);

      expect(pool.getProgress().total).toBe(3);
    });

    it('respects maxWorkers limit', async () => {
      // Create send that doesn't resolve immediately
      let resolvers: Array<(value: Uint8Array) => void> = [];
      mockSend = vi.fn().mockImplementation(() => {
        return new Promise<Uint8Array>((resolve) => {
          resolvers.push(resolve);
        });
      });

      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('READY'),
      }));

      pool = createPool({ maxWorkers: 2 });
      pool.addTasks([createTask(0), createTask(1), createTask(2), createTask(3)]);

      // Process the queue
      await vi.advanceTimersByTimeAsync(100);

      // Should only start 2 tasks (maxWorkers limit)
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('task completion', () => {
    it('stores completed audio as filename', async () => {
      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      const completedAudio = pool.getCompletedAudio();
      expect(completedAudio.size).toBe(1);
      // Now stores filename instead of Uint8Array
      expect(completedAudio.get(0)).toMatch(/^chunk_\d+\.bin$/);
    });

    it('calls onTaskComplete callback with filename', async () => {
      const onTaskComplete = vi.fn();
      pool = createPool({ onTaskComplete });
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      // Now receives filename instead of Uint8Array
      expect(onTaskComplete).toHaveBeenCalledWith(0, expect.stringMatching(/^chunk_\d+\.bin$/));
    });

    it('calls onAllComplete when all tasks done', async () => {
      const onAllComplete = vi.fn();
      pool = createPool({ onAllComplete });
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      expect(onAllComplete).toHaveBeenCalledTimes(1);
    });

    it('updates progress on completion', async () => {
      pool = createPool();
      pool.addTasks([createTask(0), createTask(1)]);

      expect(pool.getProgress().completed).toBe(0);

      await vi.advanceTimersByTimeAsync(200);

      expect(pool.getProgress().completed).toBe(2);
    });

    it('processes next task from queue after completion', async () => {
      let resolvers: Array<(value: Uint8Array) => void> = [];
      mockSend = vi.fn().mockImplementation(() => {
        return new Promise<Uint8Array>((resolve) => {
          resolvers.push(resolve);
        });
      });

      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('READY'),
      }));

      pool = createPool({ maxWorkers: 1 });
      pool.addTasks([createTask(0), createTask(1)]);

      await vi.advanceTimersByTimeAsync(50);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Complete first task
      resolvers[0](new Uint8Array([1]));
      await vi.advanceTimersByTimeAsync(50);

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('task errors and retries', () => {
    it('retries failed tasks with exponential backoff', async () => {
      let attemptCount = 0;
      const { RetriableError } = await import('@/errors');

      mockSend = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new RetriableError('Network error'));
        }
        return Promise.resolve(new Uint8Array([1]));
      });

      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('READY'),
      }));

      pool = createPool();
      pool.addTask(createTask(0));

      // Run through retries with exponential backoff
      // Base delay is 2000ms: 2000, 4000, ... so we need ~7000ms for 3 attempts with jitter
      await vi.advanceTimersByTimeAsync(10000);

      expect(attemptCount).toBe(3);
      expect(pool.getCompletedAudio().size).toBe(1);
    });

    it('calls onStatusUpdate on retry', async () => {
      const onStatusUpdate = vi.fn();
      const { RetriableError } = await import('@/errors');

      let attemptCount = 0;
      mockSend = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new RetriableError('Error'));
        }
        return Promise.resolve(new Uint8Array([1]));
      });

      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('READY'),
      }));

      pool = createPool({ onStatusUpdate });
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(5000);

      expect(onStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          partIndex: 0,
          message: expect.stringContaining('Retry'),
        })
      );
    });

    it('disconnects worker on retry to force reconnection', async () => {
      const { RetriableError } = await import('@/errors');

      let attemptCount = 0;
      mockSend = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new RetriableError('Error'));
        }
        return Promise.resolve(new Uint8Array([1]));
      });

      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('READY'),
      }));

      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(5000);

      // Disconnect should be called when retry happens
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('voice override', () => {
    it('uses task-specific voice when provided', async () => {
      pool = createPool();

      const taskWithVoice: PoolTask = {
        ...createTask(0),
        voice: 'ru-RU, DmitryNeural',
      };
      pool.addTask(taskWithVoice);

      await vi.advanceTimersByTimeAsync(0);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            voice: expect.stringContaining('ru-RU, DmitryNeural'),
          }),
        })
      );
    });

    it('uses default voice when task has no override', async () => {
      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(0);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            voice: defaultVoiceConfig.voice,
          }),
        })
      );
    });
  });

  describe('status updates', () => {
    it('sends status updates during processing', async () => {
      const statusUpdates: StatusUpdate[] = [];

      pool = createPool({
        onStatusUpdate: (update) => statusUpdates.push(update),
      });
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      expect(statusUpdates).toContainEqual(
        expect.objectContaining({
          partIndex: 0,
          message: expect.stringContaining('Processing'),
        })
      );
    });
  });

  describe('getProgress', () => {
    it('returns correct progress', async () => {
      pool = createPool({ maxWorkers: 1 });
      pool.addTasks([createTask(0), createTask(1), createTask(2)]);

      expect(pool.getProgress()).toEqual({
        completed: 0,
        total: 3,
        failed: 0,
      });

      await vi.advanceTimersByTimeAsync(200);

      expect(pool.getProgress().completed).toBeGreaterThan(0);
    });
  });

  describe('getCompletedAudio', () => {
    it('returns copy of completed audio map', async () => {
      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      const audio1 = pool.getCompletedAudio();
      const audio2 = pool.getCompletedAudio();

      expect(audio1).toEqual(audio2);
      expect(audio1).not.toBe(audio2);
    });
  });

  describe('getFailedTasks', () => {
    it('returns copy of failed tasks set', () => {
      pool = createPool();

      const failed1 = pool.getFailedTasks();
      const failed2 = pool.getFailedTasks();

      expect(failed1).not.toBe(failed2);
    });
  });

  describe('getTempDirHandle', () => {
    it('returns temp directory handle after initialization', async () => {
      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      expect(pool.getTempDirHandle()).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('removes temp directory', async () => {
      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      await pool.cleanup();

      expect(pool.getTempDirHandle()).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears all state and disconnects workers', async () => {
      pool = createPool();
      pool.addTasks([createTask(0), createTask(1)]);

      await vi.advanceTimersByTimeAsync(200);

      pool.clear();

      expect(mockDisconnect).toHaveBeenCalled();
      expect(pool.getProgress()).toEqual({
        completed: 0,
        total: 0,
        failed: 0,
      });
      expect(pool.getCompletedAudio().size).toBe(0);
      expect(pool.getFailedTasks().size).toBe(0);
    });
  });

  describe('warmup', () => {
    it('warms up all workers by connecting them', async () => {
      pool = createPool({ maxWorkers: 5 });
      await pool.warmup();

      // Each worker should have attempted to connect
      expect(mockConnect).toHaveBeenCalledTimes(5);
    });

    it('ignores connection errors during warmup', async () => {
      mockConnect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('DISCONNECTED'),
      }));

      pool = createPool({ maxWorkers: 3 });

      // Should not throw
      await expect(pool.warmup()).resolves.toBeUndefined();
    });
  });

  describe('getPoolStats', () => {
    it('returns worker statistics', () => {
      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('READY'),
      }));

      pool = createPool({ maxWorkers: 3 });

      const stats = pool.getPoolStats();

      expect(stats).toEqual({
        total: 3,
        ready: 3,
        busy: 0,
        disconnected: 0,
      });
    });
  });

  describe('connection handling', () => {
    it('connects worker if not ready before sending', async () => {
      mockIsReady = vi.fn().mockReturnValue(false);

      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('DISCONNECTED'),
      }));

      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      expect(mockConnect).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalled();
    });

    it('skips connect if worker already ready', async () => {
      mockIsReady = vi.fn().mockReturnValue(true);

      MockedReusableEdgeTTSService.mockImplementation(() => ({
        connect: mockConnect,
        send: mockSend,
        disconnect: mockDisconnect,
        isReady: mockIsReady,
        getState: vi.fn().mockReturnValue('READY'),
      }));

      pool = createPool();
      pool.addTask(createTask(0));

      await vi.advanceTimersByTimeAsync(100);

      // Connect should not be called if already ready
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalled();
    });
  });
});

// TTSWorkerPool - Worker pool using reusable WebSocket connections
// Uses TTSConnectionPool internally for connection management

import type { TTSConfig as VoiceConfig, StatusUpdate } from '../state/types';
import { defaultConfig, getRetryDelay, type TTSConfig } from '@/config';
import { TTSConnectionPool } from './TTSConnectionPool';
import { isRetriableError } from '@/errors';
import { generateConnectionId } from '@/utils/uuid';
import type { IWorkerPool, PoolTask, WorkerPoolProgress, ILogger } from './interfaces';

export interface WorkerPoolOptions {
  maxWorkers: number;
  config: VoiceConfig;
  ttsConfig?: TTSConfig;
  onStatusUpdate?: (update: StatusUpdate) => void;
  onTaskComplete?: (partIndex: number, audioData: Uint8Array) => void;
  onTaskError?: (partIndex: number, error: Error) => void;
  onAllComplete?: () => void;
  logger?: ILogger;
}

interface QueuedTask extends PoolTask {
  retryCount: number;
}

/**
 * TTSWorkerPool - Uses reusable WebSocket connections
 *
 * Features:
 * - Uses TTSConnectionPool for connection management
 * - Reuses WebSocket connections across multiple requests
 * - Reduces rate-limiting by avoiding frequent new connections
 */
export class TTSWorkerPool implements IWorkerPool {
  private connectionPool: TTSConnectionPool;
  private queue: QueuedTask[] = [];
  private activeTasks: Map<number, QueuedTask> = new Map();
  private completedAudio: Map<number, Uint8Array> = new Map();
  private failedTasks: Set<number> = new Set();
  private totalTasks = 0;
  private completedCount = 0;
  private isProcessingQueue = false;
  private lastErrorTime = 0;

  private maxWorkers: number;
  private voiceConfig: VoiceConfig;
  private ttsConfig: TTSConfig;
  private onStatusUpdate?: (update: StatusUpdate) => void;
  private onTaskComplete?: (partIndex: number, audioData: Uint8Array) => void;
  private onTaskError?: (partIndex: number, error: Error) => void;
  private onAllComplete?: () => void;
  private logger?: ILogger;

  constructor(options: WorkerPoolOptions) {
    this.maxWorkers = options.maxWorkers;
    this.voiceConfig = options.config;
    this.ttsConfig = options.ttsConfig ?? defaultConfig.tts;
    this.onStatusUpdate = options.onStatusUpdate;
    this.onTaskComplete = options.onTaskComplete;
    this.onTaskError = options.onTaskError;
    this.onAllComplete = options.onAllComplete;
    this.logger = options.logger;

    this.connectionPool = new TTSConnectionPool({
      maxConnections: this.maxWorkers,
      logger: this.logger,
    });
  }

  /**
   * Pre-warm connections before adding tasks
   */
  async warmup(): Promise<void> {
    await this.connectionPool.warmup(this.maxWorkers);
  }

  addTask(task: PoolTask): void {
    this.queue.push({ ...task, retryCount: 0 });
    this.totalTasks++;
    this.processQueue();
  }

  addTasks(tasks: PoolTask[]): void {
    for (const task of tasks) {
      this.queue.push({ ...task, retryCount: 0 });
      this.totalTasks++;
    }
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.activeTasks.size < this.maxWorkers && this.queue.length > 0) {
      // Check error cooldown
      const timeSinceError = Date.now() - this.lastErrorTime;
      if (this.lastErrorTime > 0 && timeSinceError < this.ttsConfig.errorCooldown) {
        const waitTime = this.ttsConfig.errorCooldown - timeSinceError;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      const task = this.queue.shift()!;
      this.processTask(task);
    }

    this.isProcessingQueue = false;
  }

  private async processTask(task: QueuedTask): Promise<void> {
    this.activeTasks.set(task.partIndex, task);

    this.onStatusUpdate?.({
      partIndex: task.partIndex,
      message: `Part ${String(task.partIndex + 1).padStart(4, '0')}: Processing...`,
      isComplete: false,
    });

    // Build config with task-specific voice
    const taskConfig: VoiceConfig = task.voice
      ? { ...this.voiceConfig, voice: `Microsoft Server Speech Text to Speech Voice (${task.voice})` }
      : this.voiceConfig;

    try {
      const audioData = await this.connectionPool.execute({
        text: task.text,
        config: taskConfig,
        requestId: generateConnectionId(),
      });

      this.handleTaskComplete(task.partIndex, audioData);
    } catch (error) {
      this.handleTaskError(task.partIndex, error as Error, task.retryCount);
    }
  }

  private handleTaskComplete(partIndex: number, audioData: Uint8Array): void {
    this.activeTasks.delete(partIndex);
    this.completedAudio.set(partIndex, audioData);
    this.completedCount++;

    this.onStatusUpdate?.({
      partIndex,
      message: `Part ${String(partIndex + 1).padStart(4, '0')}: Complete`,
      isComplete: true,
    });

    this.onTaskComplete?.(partIndex, audioData);
    this.checkCompletion();
    this.processQueue();
  }

  private handleTaskError(partIndex: number, error: Error, retryCount: number): void {
    this.lastErrorTime = Date.now();
    const task = this.activeTasks.get(partIndex);
    this.activeTasks.delete(partIndex);

    if (task) {
      // Retriable errors trigger automatic retry with exponential backoff
      if (isRetriableError(error)) {
        const delay = getRetryDelay(retryCount);
        const delaySec = Math.round(delay / 1000);

        this.onStatusUpdate?.({
          partIndex,
          message: `Part ${String(partIndex + 1).padStart(4, '0')}: Error, retrying in ${delaySec}s...`,
          isComplete: false,
        });

        setTimeout(() => {
          this.queue.push({ ...task, retryCount: retryCount + 1 });
          this.processQueue();
        }, delay);
      } else {
        // Non-retriable error - still retry but log warning
        const delay = getRetryDelay(retryCount);
        const delaySec = Math.round(delay / 1000);

        this.logger?.warn(`Task ${partIndex} failed with non-retriable error: ${error.message}`);

        this.onStatusUpdate?.({
          partIndex,
          message: `Part ${String(partIndex + 1).padStart(4, '0')}: Error, retrying in ${delaySec}s...`,
          isComplete: false,
        });

        setTimeout(() => {
          this.queue.push({ ...task, retryCount: retryCount + 1 });
          this.processQueue();
        }, delay);
      }
    }
  }

  private checkCompletion(): void {
    if (
      this.completedCount >= this.totalTasks &&
      this.queue.length === 0 &&
      this.activeTasks.size === 0
    ) {
      this.onAllComplete?.();
    }
  }

  getCompletedAudio(): Map<number, Uint8Array> {
    return new Map(this.completedAudio);
  }

  getFailedTasks(): Set<number> {
    return new Set(this.failedTasks);
  }

  getProgress(): WorkerPoolProgress {
    return {
      completed: this.completedCount,
      total: this.totalTasks,
      failed: this.failedTasks.size,
    };
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): { total: number; ready: number; busy: number; disconnected: number } {
    return this.connectionPool.getStats();
  }

  clear(): void {
    this.connectionPool.shutdown();
    this.queue = [];
    this.activeTasks.clear();
    this.completedAudio.clear();
    this.failedTasks.clear();
    this.totalTasks = 0;
    this.completedCount = 0;
  }
}

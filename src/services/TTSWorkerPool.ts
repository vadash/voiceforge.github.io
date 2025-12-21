// TTSWorkerPool - Worker pool using reusable WebSocket connections
// Uses fixed worker array with centralized retry logic

import type { TTSConfig as VoiceConfig, StatusUpdate } from '../state/types';
import { ReusableEdgeTTSService } from './ReusableEdgeTTSService';
import { withRetry } from '@/utils/asyncUtils';
import type { IWorkerPool, PoolTask, WorkerPoolProgress, ILogger } from './interfaces';

export interface WorkerPoolOptions {
  maxWorkers: number;
  config: VoiceConfig;
  directoryHandle?: FileSystemDirectoryHandle | null;
  onStatusUpdate?: (update: StatusUpdate) => void;
  onTaskComplete?: (partIndex: number, filename: string) => void;
  onTaskError?: (partIndex: number, error: Error) => void;
  onAllComplete?: () => void;
  logger?: ILogger;
}

interface WorkerSlot {
  id: number;
  service: ReusableEdgeTTSService;
  isBusy: boolean;
}

const TEMP_DIR_NAME = '_temp_work';

/**
 * TTSWorkerPool - Uses fixed worker array with reusable WebSocket connections
 *
 * Features:
 * - Fixed number of workers (configurable threads)
 * - Centralized retry logic with exponential backoff
 * - Handles sleep mode recovery via reconnection
 * - Writes audio chunks to disk immediately to prevent OOM
 */
export class TTSWorkerPool implements IWorkerPool {
  private workers: WorkerSlot[] = [];
  private taskQueue: PoolTask[] = [];
  private completedTasks = new Map<number, string>();
  private failedTasks = new Set<number>();
  private isProcessing = false;
  private tempDirHandle: FileSystemDirectoryHandle | null = null;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private initPromise: Promise<void> | null = null;

  // Statistics
  private totalTasks = 0;
  private processedCount = 0;

  private voiceConfig: VoiceConfig;
  private onStatusUpdate?: (update: StatusUpdate) => void;
  private onTaskComplete?: (partIndex: number, filename: string) => void;
  private onTaskError?: (partIndex: number, error: Error) => void;
  private onAllComplete?: () => void;
  private logger?: ILogger;

  constructor(options: WorkerPoolOptions) {
    this.voiceConfig = options.config;
    this.directoryHandle = options.directoryHandle ?? null;
    this.onStatusUpdate = options.onStatusUpdate;
    this.onTaskComplete = options.onTaskComplete;
    this.onTaskError = options.onTaskError;
    this.onAllComplete = options.onAllComplete;
    this.logger = options.logger;

    // Initialize fixed number of workers (configurable threads)
    for (let i = 0; i < options.maxWorkers; i++) {
      this.workers.push({
        id: i,
        service: new ReusableEdgeTTSService(this.logger),
        isBusy: false,
      });
    }

    // Initialize temp directory asynchronously
    this.initPromise = this.initTempDirectory();
  }

  /**
   * Initialize the temp directory for storing audio chunks
   */
  private async initTempDirectory(): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('Directory handle required for disk-based audio storage');
    }

    try {
      this.tempDirHandle = await this.directoryHandle.getDirectoryHandle(TEMP_DIR_NAME, {
        create: true,
      });
      this.logger?.debug(`Created temp directory: ${TEMP_DIR_NAME}`);
    } catch (err) {
      this.logger?.error(`Failed to create temp directory: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Write audio chunk to disk
   */
  private async writeChunkToDisk(partIndex: number, audioData: Uint8Array): Promise<string> {
    if (!this.tempDirHandle) {
      throw new Error('Temp directory not initialized');
    }

    const filename = `chunk_${String(partIndex).padStart(6, '0')}.bin`;
    const fileHandle = await this.tempDirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
    const buffer = new ArrayBuffer(audioData.byteLength);
    new Uint8Array(buffer).set(audioData);
    await writable.write(buffer);
    await writable.close();

    return filename;
  }

  /**
   * Pre-warm connections before adding tasks
   */
  async warmup(): Promise<void> {
    const promises = this.workers.map(async (worker) => {
      try {
        await worker.service.connect();
      } catch {
        // Ignore warmup errors - will retry on actual task
      }
    });
    await Promise.allSettled(promises);
    this.logger?.debug(`Warmed up ${this.workers.length} workers`);
  }

  addTask(task: PoolTask): void {
    this.taskQueue.push(task);
    this.totalTasks++;
    this.processQueue();
  }

  addTasks(tasks: PoolTask[]): void {
    this.taskQueue.push(...tasks);
    this.totalTasks += tasks.length;
    this.processQueue();
  }

  /**
   * Main loop: Finds idle workers and assigns tasks
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Wait for temp directory initialization
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }

    // While we have tasks and free workers
    while (this.taskQueue.length > 0) {
      const freeWorker = this.workers.find((w) => !w.isBusy);

      if (!freeWorker) {
        // No threads available. Stop loop.
        // The loop will restart when a worker finishes and calls processQueue()
        break;
      }

      const task = this.taskQueue.shift()!;
      this.executeTask(freeWorker, task);
    }

    this.isProcessing = false;
  }

  /**
   * Executes a single task on a specific worker with retry logic
   */
  private async executeTask(worker: WorkerSlot, task: PoolTask): Promise<void> {
    worker.isBusy = true;

    try {
      this.onStatusUpdate?.({
        partIndex: task.partIndex,
        message: `Part ${String(task.partIndex + 1).padStart(4, '0')}: Processing...`,
        isComplete: false,
      });

      // Build config with task-specific voice
      const taskConfig: VoiceConfig = task.voice
        ? { ...this.voiceConfig, voice: `Microsoft Server Speech Text to Speech Voice (${task.voice})` }
        : this.voiceConfig;

      // === CENTRALIZED RETRY LOGIC ===
      // This handles: Sleep mode disconnects, Rate limits, Network drops
      const audioData = await withRetry(
        async () => {
          // Ensure connected (Reusable service handles idempotency)
          // If PC slept, state is likely disconnected, this reconnects.
          if (!worker.service.isReady()) {
            await worker.service.connect();
          }

          // Send request
          return await worker.service.send({
            text: task.text,
            config: taskConfig,
          });
        },
        {
          maxRetries: 10, // Generous retries for "upstream blocking"
          baseDelay: 2000,
          maxDelay: 30000,
          onRetry: (attempt, err, delay) => {
            this.logger?.warn(
              `Worker ${worker.id} retrying task ${task.partIndex} (Attempt ${attempt}). Waiting ${Math.round(delay)}ms. Error: ${err}`
            );

            this.onStatusUpdate?.({
              partIndex: task.partIndex,
              message: `Part ${String(task.partIndex + 1).padStart(4, '0')}: Retry ${attempt}...`,
              isComplete: false,
            });

            // Force disconnect on error to ensure clean state for next attempt
            worker.service.disconnect();
          },
        }
      );

      // Save to disk
      const filename = await this.writeChunkToDisk(task.partIndex, audioData);

      this.completedTasks.set(task.partIndex, filename);
      this.processedCount++;

      this.onStatusUpdate?.({
        partIndex: task.partIndex,
        message: `Part ${String(task.partIndex + 1).padStart(4, '0')}: Complete`,
        isComplete: true,
      });

      this.onTaskComplete?.(task.partIndex, filename);
    } catch (error) {
      this.failedTasks.add(task.partIndex);
      this.processedCount++;
      this.onTaskError?.(task.partIndex, error instanceof Error ? error : new Error(String(error)));
      this.logger?.error(`Task ${task.partIndex} failed permanently`, error as Error);
    } finally {
      // Free the worker
      worker.isBusy = false;

      // Check for all complete
      if (this.taskQueue.length === 0 && this.workers.every((w) => !w.isBusy)) {
        this.onAllComplete?.();
      } else {
        // Trigger next task
        this.processQueue();
      }
    }
  }

  getCompletedAudio(): Map<number, string> {
    return new Map(this.completedTasks);
  }

  getFailedTasks(): Set<number> {
    return new Set(this.failedTasks);
  }

  getProgress(): WorkerPoolProgress {
    return {
      completed: this.processedCount,
      total: this.totalTasks,
      failed: this.failedTasks.size,
    };
  }

  getTempDirHandle(): FileSystemDirectoryHandle | null {
    return this.tempDirHandle;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): { total: number; ready: number; busy: number; disconnected: number } {
    let ready = 0;
    let busy = 0;
    let disconnected = 0;

    for (const worker of this.workers) {
      const state = worker.service.getState();
      if (state === 'READY' && !worker.isBusy) ready++;
      else if (state === 'BUSY' || worker.isBusy) busy++;
      else if (state === 'DISCONNECTED') disconnected++;
    }

    return { total: this.workers.length, ready, busy, disconnected };
  }

  /**
   * Cleanup temp directory and remove all temp files
   */
  async cleanup(): Promise<void> {
    if (this.directoryHandle && this.tempDirHandle) {
      try {
        await this.directoryHandle.removeEntry(TEMP_DIR_NAME, { recursive: true });
        this.logger?.debug(`Cleaned up temp directory: ${TEMP_DIR_NAME}`);
      } catch (err) {
        this.logger?.warn(`Failed to cleanup temp directory: ${(err as Error).message}`);
      }
      this.tempDirHandle = null;
    }
  }

  clear(): void {
    this.taskQueue = [];
    this.workers.forEach((w) => {
      w.isBusy = false;
      w.service.disconnect();
    });
    this.completedTasks.clear();
    this.failedTasks.clear();
    this.totalTasks = 0;
    this.processedCount = 0;
  }
}

// Retry Strategy
// Provides configurable retry logic with different strategies

import type { ILogger } from '@/services/interfaces';
import { AppError, isAppError } from '@/errors';

/**
 * Retry strategy interface
 */
export interface RetryStrategy {
  /** Maximum number of retry attempts */
  readonly maxAttempts: number;

  /**
   * Determine if error is retriable
   * @param error The error that occurred
   * @param attempt Current attempt number (0-based)
   */
  shouldRetry(error: Error, attempt: number): boolean;

  /**
   * Get delay before next retry in ms
   * @param attempt Current attempt number (0-based)
   */
  getDelay(attempt: number): number;
}

// ============================================================================
// Strategy Implementations
// ============================================================================

/**
 * Exponential backoff retry strategy
 * Delay grows exponentially: baseDelay * multiplier^attempt
 */
export class ExponentialBackoffStrategy implements RetryStrategy {
  constructor(
    public readonly maxAttempts: number,
    private readonly baseDelay: number,
    private readonly maxDelay: number,
    private readonly multiplier: number = 2
  ) {}

  shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.maxAttempts) return false;

    // Check if AppError and retriable
    if (isAppError(error)) {
      return error.isRetriable();
    }

    // Default: retry network/timeout errors
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('websocket')
    );
  }

  getDelay(attempt: number): number {
    const delay = this.baseDelay * Math.pow(this.multiplier, attempt);
    return Math.min(delay, this.maxDelay);
  }
}

/**
 * Fixed delays retry strategy
 * Uses predefined array of delays
 */
export class FixedDelaysStrategy implements RetryStrategy {
  constructor(private readonly delays: number[]) {}

  get maxAttempts(): number {
    return this.delays.length;
  }

  shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.delays.length) return false;

    if (isAppError(error)) {
      return error.isRetriable();
    }

    return true; // Fixed delays usually mean "always retry up to max"
  }

  getDelay(attempt: number): number {
    if (attempt >= this.delays.length) {
      return this.delays[this.delays.length - 1];
    }
    return this.delays[attempt];
  }
}

/**
 * Infinite retry strategy with exponential backoff
 * Never gives up, but respects cancellation
 */
export class InfiniteRetryStrategy implements RetryStrategy {
  readonly maxAttempts = Infinity;

  constructor(
    private readonly baseDelay: number,
    private readonly maxDelay: number,
    private readonly multiplier: number = 2
  ) {}

  shouldRetry(error: Error, _attempt: number): boolean {
    // Don't retry cancellation
    if (isAppError(error) && error.isCancellation()) {
      return false;
    }
    return true;
  }

  getDelay(attempt: number): number {
    const delay = this.baseDelay * Math.pow(this.multiplier, attempt);
    return Math.min(delay, this.maxDelay);
  }
}

/**
 * Linear backoff retry strategy
 * Delay grows linearly: baseDelay + (increment * attempt)
 */
export class LinearBackoffStrategy implements RetryStrategy {
  constructor(
    public readonly maxAttempts: number,
    private readonly baseDelay: number,
    private readonly increment: number,
    private readonly maxDelay: number
  ) {}

  shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.maxAttempts) return false;

    if (isAppError(error)) {
      return error.isRetriable();
    }

    return true;
  }

  getDelay(attempt: number): number {
    const delay = this.baseDelay + this.increment * attempt;
    return Math.min(delay, this.maxDelay);
  }
}

// ============================================================================
// Predefined Strategies
// ============================================================================

/**
 * Default TTS retry strategy
 * Matches existing TTSWorkerPool behavior: 10s, 30s, then 30s * 3^n up to 10min
 */
export function createTTSRetryStrategy(): RetryStrategy {
  return {
    maxAttempts: Infinity,

    shouldRetry(error: Error, _attempt: number): boolean {
      if (isAppError(error) && error.isCancellation()) {
        return false;
      }
      return true;
    },

    getDelay(attempt: number): number {
      const INITIAL_DELAY = 10000; // 10 seconds
      const SECOND_DELAY = 30000; // 30 seconds
      const MULTIPLIER = 3;
      const MAX_DELAY = 600000; // 10 minutes

      if (attempt === 0) return INITIAL_DELAY;
      if (attempt === 1) return SECOND_DELAY;

      const delay = SECOND_DELAY * Math.pow(MULTIPLIER, attempt - 1);
      return Math.min(delay, MAX_DELAY);
    },
  };
}

/**
 * Default LLM retry strategy
 * Matches existing LLMVoiceService behavior: [1s, 3s, 5s, 10s, 30s, 60s, 120s, 300s, 600s]
 */
export function createLLMRetryStrategy(): FixedDelaysStrategy {
  return new FixedDelaysStrategy([
    1000, 3000, 5000, 10000, 30000, 60000, 120000, 300000, 600000,
  ]);
}

/**
 * Quick retry strategy for fast operations
 * 3 attempts with short delays
 */
export function createQuickRetryStrategy(): ExponentialBackoffStrategy {
  return new ExponentialBackoffStrategy(3, 1000, 5000, 2);
}

// ============================================================================
// Retry Executor
// ============================================================================

/**
 * Options for withRetry
 */
export interface WithRetryOptions {
  /** Retry strategy to use */
  strategy: RetryStrategy;
  /** Logger for retry messages */
  logger?: ILogger;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Operation name for logging */
  operationName?: string;
  /** Callback before each retry */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions
): Promise<T> {
  const { strategy, logger, signal, operationName = 'operation', onRetry } = options;
  let attempt = 0;

  while (true) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new AppError('CONVERSION_CANCELLED', 'Operation cancelled');
    }

    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (!strategy.shouldRetry(err, attempt)) {
        throw err;
      }

      // Check max attempts
      if (attempt >= strategy.maxAttempts) {
        logger?.error(`${operationName} failed after ${attempt + 1} attempts`, err);
        throw err;
      }

      // Get delay and wait
      const delay = strategy.getDelay(attempt);
      const delaySec = Math.round(delay / 1000);

      logger?.warn(`${operationName} failed, retrying in ${delaySec}s...`, { attempt, error: err.message });
      onRetry?.(attempt, err, delay);

      // Wait before retry
      await sleep(delay, signal);

      attempt++;
    }
  }
}

/**
 * Sleep helper with cancellation support
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AppError('CONVERSION_CANCELLED', 'Operation cancelled'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new AppError('CONVERSION_CANCELLED', 'Operation cancelled'));
    });
  });
}

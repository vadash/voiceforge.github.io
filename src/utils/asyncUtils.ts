// Async utilities for retry logic with exponential backoff

import { isRetriableError } from '@/errors';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: unknown, nextDelay: number) => void;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Executes a function with exponential backoff retry logic.
 * Handles network jitters, sleep mode recovery, and rate limiting.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 2000,
    maxDelay = 60000,
    onRetry,
    shouldRetry = isRetriableError,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // If we've reached max retries, or the error explicitly says "don't retry"
      if (attempt === maxRetries || (shouldRetry && !shouldRetry(error))) {
        throw error;
      }

      // Exponential backoff: 2s, 4s, 8s...
      // Add jitter (randomness) to prevent "thundering herd" if all threads fail at once
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + jitter, maxDelay);

      if (onRetry) {
        onRetry(attempt + 1, error, delay);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

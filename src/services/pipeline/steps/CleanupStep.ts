// Cleanup Step
// Removes temporary files after pipeline completion

import { BasePipelineStep, PipelineContext } from '../types';
import type { ILogger } from '@/services/interfaces';

const TEMP_DIR_NAME = '_temp_work';

/**
 * Options for CleanupStep
 */
export interface CleanupStepOptions {
  logger?: ILogger;
}

/**
 * Cleans up temporary files created during pipeline execution
 */
export class CleanupStep extends BasePipelineStep {
  readonly name = 'cleanup';
  protected readonly requiredContextKeys: (keyof PipelineContext)[] = [];

  constructor(private options: CleanupStepOptions = {}) {
    super();
  }

  async execute(context: PipelineContext, signal: AbortSignal): Promise<PipelineContext> {
    this.checkCancelled(signal);

    const { directoryHandle } = context;

    if (!directoryHandle) {
      this.reportProgress(1, 1, 'No directory to clean up');
      return context;
    }

    this.reportProgress(0, 1, 'Cleaning up temporary files...');

    try {
      await directoryHandle.removeEntry(TEMP_DIR_NAME, { recursive: true });
      this.options.logger?.debug(`Cleaned up temp directory: ${TEMP_DIR_NAME}`);
    } catch (err) {
      // Ignore errors - temp dir may not exist or already be removed
      this.options.logger?.debug(`Cleanup skipped: ${(err as Error).message}`);
    }

    this.reportProgress(1, 1, 'Cleanup complete');

    return context;
  }
}

/**
 * Create a CleanupStep
 */
export function createCleanupStep(options: CleanupStepOptions = {}): CleanupStep {
  return new CleanupStep(options);
}

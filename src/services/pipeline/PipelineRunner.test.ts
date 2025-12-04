import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipelineRunner, createPipelineRunner } from './PipelineRunner';
import { createMockLogger } from '@/test/mocks/MockLogger';
import { createTestContext, createNeverAbortSignal, createMockStep, createTestAbortController } from '@/test/pipeline/helpers';
import type { PipelineContext, IPipelineStep, ProgressCallback } from './types';

describe('PipelineRunner', () => {
  let runner: PipelineRunner;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    runner = createPipelineRunner(mockLogger) as PipelineRunner;
  });

  describe('addStep', () => {
    it('adds a step to the pipeline', () => {
      const step = createMockStep('test-step');
      runner.addStep(step);
      expect(runner.getStepNames()).toEqual(['test-step']);
    });

    it('adds multiple steps in order', () => {
      runner.addStep(createMockStep('step-1'));
      runner.addStep(createMockStep('step-2'));
      runner.addStep(createMockStep('step-3'));
      expect(runner.getStepNames()).toEqual(['step-1', 'step-2', 'step-3']);
    });
  });

  describe('getStepNames', () => {
    it('returns empty array when no steps', () => {
      expect(runner.getStepNames()).toEqual([]);
    });

    it('returns step names in order', () => {
      runner.addStep(createMockStep('alpha'));
      runner.addStep(createMockStep('beta'));
      expect(runner.getStepNames()).toEqual(['alpha', 'beta']);
    });
  });

  describe('run', () => {
    it('runs steps in sequence', async () => {
      const executionOrder: string[] = [];

      runner.addStep(createMockStep('step-1', async (ctx) => {
        executionOrder.push('step-1');
        return ctx;
      }));
      runner.addStep(createMockStep('step-2', async (ctx) => {
        executionOrder.push('step-2');
        return ctx;
      }));
      runner.addStep(createMockStep('step-3', async (ctx) => {
        executionOrder.push('step-3');
        return ctx;
      }));

      const context = createTestContext();
      await runner.run(context, createNeverAbortSignal());

      expect(executionOrder).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('passes context through steps', async () => {
      runner.addStep(createMockStep('add-field', async (ctx) => ({
        ...ctx,
        characters: [{ code: 'A', canonicalName: 'Alice', gender: 'female', aliases: [] }],
      })));
      runner.addStep(createMockStep('check-field', async (ctx) => {
        expect(ctx.characters).toHaveLength(1);
        return ctx;
      }));

      const context = createTestContext();
      const result = await runner.run(context, createNeverAbortSignal());

      expect(result.characters).toHaveLength(1);
    });

    it('returns final context', async () => {
      runner.addStep(createMockStep('modify', async (ctx) => ({
        ...ctx,
        text: 'modified text',
      })));

      const context = createTestContext({ text: 'original' });
      const result = await runner.run(context, createNeverAbortSignal());

      expect(result.text).toBe('modified text');
    });

    it('returns original context when no steps', async () => {
      const context = createTestContext({ text: 'unchanged' });
      const result = await runner.run(context, createNeverAbortSignal());

      expect(result.text).toBe('unchanged');
    });

    it('logs step start and completion', async () => {
      runner.addStep(createMockStep('logged-step'));

      await runner.run(createTestContext(), createNeverAbortSignal());

      expect(mockLogger.info).toHaveBeenCalledWith('Starting step 1/1: logged-step');
      expect(mockLogger.info).toHaveBeenCalledWith('Completed step: logged-step');
    });
  });

  describe('progress callback', () => {
    it('forwards progress callback to steps', async () => {
      const progressUpdates: Array<{ current: number; total: number; message: string }> = [];
      const callback: ProgressCallback = (p) => {
        progressUpdates.push({ current: p.current, total: p.total, message: p.message });
      };

      let stepCallback: ProgressCallback | undefined;
      const step: IPipelineStep = {
        name: 'progress-step',
        execute: async (ctx) => {
          stepCallback?.({ current: 1, total: 2, message: 'halfway' });
          return ctx;
        },
        setProgressCallback: (cb) => {
          stepCallback = cb;
        },
      };

      runner.addStep(step);
      runner.setProgressCallback(callback);

      await runner.run(createTestContext(), createNeverAbortSignal());

      expect(progressUpdates).toContainEqual({ current: 1, total: 2, message: 'halfway' });
    });

    it('sets progress callback on all existing steps', async () => {
      const setCallbackSpy1 = vi.fn();
      const setCallbackSpy2 = vi.fn();

      const step1: IPipelineStep = {
        name: 'step-1',
        execute: async (ctx) => ctx,
        setProgressCallback: setCallbackSpy1,
      };
      const step2: IPipelineStep = {
        name: 'step-2',
        execute: async (ctx) => ctx,
        setProgressCallback: setCallbackSpy2,
      };

      runner.addStep(step1);
      runner.addStep(step2);

      const callback: ProgressCallback = () => {};
      runner.setProgressCallback(callback);

      expect(setCallbackSpy1).toHaveBeenCalledWith(callback);
      expect(setCallbackSpy2).toHaveBeenCalledWith(callback);
    });
  });

  describe('cancellation', () => {
    it('throws when signal is aborted before running', async () => {
      runner.addStep(createMockStep('never-runs'));

      const controller = createTestAbortController();
      controller.abort();

      await expect(runner.run(createTestContext(), controller.signal))
        .rejects.toThrow('Pipeline cancelled');
    });

    it('throws when signal is aborted between steps', async () => {
      const controller = createTestAbortController();

      runner.addStep(createMockStep('step-1', async (ctx) => {
        controller.abort();
        return ctx;
      }));
      runner.addStep(createMockStep('step-2', async () => {
        throw new Error('Should not reach step-2');
      }));

      await expect(runner.run(createTestContext(), controller.signal))
        .rejects.toThrow('Pipeline cancelled');
    });

    it('re-throws cancellation errors from steps', async () => {
      runner.addStep(createMockStep('cancelling-step', async () => {
        throw new Error('Pipeline cancelled');
      }));

      await expect(runner.run(createTestContext(), createNeverAbortSignal()))
        .rejects.toThrow('Pipeline cancelled');
    });
  });

  describe('error handling', () => {
    it('propagates errors from steps', async () => {
      runner.addStep(createMockStep('failing-step', async () => {
        throw new Error('Step failed');
      }));

      await expect(runner.run(createTestContext(), createNeverAbortSignal()))
        .rejects.toThrow('Step failed');
    });

    it('logs errors from failing steps', async () => {
      const error = new Error('Step error');
      runner.addStep(createMockStep('failing-step', async () => {
        throw error;
      }));

      try {
        await runner.run(createTestContext(), createNeverAbortSignal());
      } catch {
        // Expected
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Step failed: failing-step', error);
    });

    it('stops execution on first error', async () => {
      const step2Executed = vi.fn();

      runner.addStep(createMockStep('failing-step', async () => {
        throw new Error('First step failed');
      }));
      runner.addStep(createMockStep('step-2', async (ctx) => {
        step2Executed();
        return ctx;
      }));

      try {
        await runner.run(createTestContext(), createNeverAbortSignal());
      } catch {
        // Expected
      }

      expect(step2Executed).not.toHaveBeenCalled();
    });

    it('does not log cancellation errors', async () => {
      const controller = createTestAbortController();
      controller.abort();

      runner.addStep(createMockStep('step'));

      try {
        await runner.run(createTestContext(), controller.signal);
      } catch {
        // Expected
      }

      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});

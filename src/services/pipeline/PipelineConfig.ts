// Pipeline Configuration
// Declarative pipeline definition with step configurations

import type { IPipelineStep, IPipelineRunner, ProgressCallback } from './types';
import type { StepRegistry } from './StepRegistry';

/**
 * Configuration for a single pipeline step
 */
export interface StepConfig<T = unknown> {
  /** Step name (must match a registered step) */
  name: string;
  /** Options to pass to the step factory */
  options: T;
  /** Whether this step is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Full pipeline configuration
 */
export interface PipelineConfig {
  /** Ordered list of steps to execute */
  steps: StepConfig[];
}

/**
 * Build a pipeline from configuration
 *
 * @param config Pipeline configuration
 * @param registry Step registry with registered factories
 * @param runner Pipeline runner to add steps to
 * @returns The configured pipeline runner
 */
export function buildPipelineFromConfig(
  config: PipelineConfig,
  registry: StepRegistry,
  runner: IPipelineRunner
): IPipelineRunner {
  for (const stepConfig of config.steps) {
    // Skip disabled steps
    if (stepConfig.enabled === false) {
      continue;
    }

    const step = registry.create(stepConfig.name, stepConfig.options);
    runner.addStep(step);
  }

  return runner;
}

/**
 * Create a pipeline config builder for fluent API
 */
export class PipelineConfigBuilder {
  private steps: StepConfig[] = [];

  /**
   * Add a step to the pipeline
   */
  addStep<T>(name: string, options: T, enabled = true): this {
    this.steps.push({ name, options, enabled });
    return this;
  }

  /**
   * Add a step only if condition is true
   */
  addStepIf<T>(condition: boolean, name: string, options: T): this {
    if (condition) {
      this.steps.push({ name, options, enabled: true });
    }
    return this;
  }

  /**
   * Build the final configuration
   */
  build(): PipelineConfig {
    return { steps: [...this.steps] };
  }
}

/**
 * Create a new pipeline config builder
 */
export function pipelineConfig(): PipelineConfigBuilder {
  return new PipelineConfigBuilder();
}

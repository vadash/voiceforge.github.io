// Step Registry
// Plugin-like step registration system for pipeline extensibility

import type { IPipelineStep } from './types';

/**
 * Factory function type for creating pipeline steps
 */
export type StepFactory<T = unknown> = (options: T) => IPipelineStep;

/**
 * Registry entry containing factory and metadata
 */
interface RegistryEntry {
  factory: StepFactory<unknown>;
  description?: string;
}

/**
 * Step Registry - enables plugin-like registration of pipeline steps
 *
 * Usage:
 *   // Register a step factory
 *   registry.register('character-extraction', (opts) => new CharacterExtractionStep(opts));
 *
 *   // Create a step instance
 *   const step = registry.create('character-extraction', { apiKey: '...' });
 */
export class StepRegistry {
  private entries = new Map<string, RegistryEntry>();

  /**
   * Register a step factory
   * @param name Unique step name
   * @param factory Factory function that creates the step
   * @param description Optional description for documentation
   */
  register<T>(name: string, factory: StepFactory<T>, description?: string): void {
    if (this.entries.has(name)) {
      throw new Error(`Step "${name}" is already registered`);
    }
    this.entries.set(name, { factory: factory as StepFactory<unknown>, description });
  }

  /**
   * Create a step instance
   * @param name Step name
   * @param options Options to pass to the factory
   */
  create<T>(name: string, options: T): IPipelineStep {
    const entry = this.entries.get(name);
    if (!entry) {
      throw new Error(`Step "${name}" is not registered. Available: ${this.getNames().join(', ')}`);
    }
    return entry.factory(options);
  }

  /**
   * Check if a step is registered
   */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * Get all registered step names
   */
  getNames(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get step description
   */
  getDescription(name: string): string | undefined {
    return this.entries.get(name)?.description;
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.entries.clear();
  }
}

/**
 * Create a new step registry
 */
export function createStepRegistry(): StepRegistry {
  return new StepRegistry();
}

Here is a detailed, 3-phase execution plan designed to be fed directly into an AI coding assistant (like Claude Code) without it needing to perform file exploration.

### Phase 1: Externalize LLM Prompts (Configuration & Support)

**Goal**: Move hardcoded prompt strings out of `PromptBuilders.ts` into a configuration file. This allows non-developers to tune prompts and makes A/B testing easier.

**Step 1: Create the prompt configuration file**
*   **Command**: `touch src/config/prompts.ts`
*   **Content**: Create an object structure that mirrors the strings currently in `src/services/llm/PromptBuilders.ts`.

```typescript
// src/config/prompts.ts
export const LLM_PROMPTS = {
  extract: {
    system: `# Character Extractor for Audiobook Production...`, // [Copy text from buildExtractPrompt]
    userTemplate: `<text>\n{{text}}\n</text>`
  },
  merge: {
    system: `# Character Deduplication...`, // [Copy text from buildMergePrompt]
    userTemplate: `<characters>\n{{characters}}\n</characters>`
  },
  assign: {
    system: `# Dialogue Speaker Tagger...`, // [Copy text from buildAssignPrompt]
    userTemplate: `<sentences>\n{{sentences}}\n</sentences>`
  }
};
```

**Step 2: Refactor PromptBuilders to use configuration**
*   **Read**: `src/services/llm/PromptBuilders.ts`
*   **Action**:
    1.  Import `LLM_PROMPTS` from `../../config/prompts`.
    2.  Replace the hardcoded strings with usage of the config object.
    3.  Implement a simple string replacement for the `{{text}}` placeholders.

**Instructions for AI**:
> "Read `src/services/llm/PromptBuilders.ts`. Create `src/config/prompts.ts` and move the large system prompt strings there. Then refactor `PromptBuilders.ts` to import these prompts and replace placeholders like `{{text}}` with the actual variables."

---

### Phase 2: Enforce Pipeline Contracts (Robustness)

**Goal**: Remove manual context checking (e.g., `if (!assignments) throw...`) from every step by enforcing it in the base class.

**Step 1: Update BasePipelineStep**
*   **Read**: `src/services/pipeline/types.ts`
*   **Action**: Modify the `BasePipelineStep` abstract class.
    1.  Add `protected abstract readonly requiredContextKeys: (keyof PipelineContext)[];`
    2.  Add a `validateContext(context: PipelineContext)` method that loops through `requiredContextKeys`, checks if they exist in `context`, and throws an error if missing.
    3.  Update the `execute` method signature (if necessary) or create a `process` abstract method to separate validation from execution.

**Step 2: Update Step Implementations**
*   **Read**:
    *   `src/services/pipeline/steps/TTSConversionStep.ts`
    *   `src/services/pipeline/steps/AudioMergeStep.ts`
    *   `src/services/pipeline/steps/SpeakerAssignmentStep.ts`
*   **Action**: For each file:
    1.  Define the `requiredContextKeys` array (e.g., `['assignments', 'fileNames']` for TTS).
    2.  Call `this.validateContext(context)` at the start of `execute`.
    3.  Remove the manual `if (...) throw Error` checks at the top of the methods.

**Instructions for AI**:
> "Read `src/services/pipeline/types.ts`. Update `BasePipelineStep` to include a `validateContext` method and an abstract `requiredContextKeys` property. Then, read `src/services/pipeline/steps/TTSConversionStep.ts` and `src/services/pipeline/steps/AudioMergeStep.ts`. Update them to define their required keys and remove manual null checks."

---

### Phase 3: Decouple Orchestrator (Extension)

**Goal**: Refactor the "God Class" `ConversionOrchestrator` by extracting the pipeline construction logic into a Builder pattern.

**Step 1: Create the PipelineBuilder Service**
*   **Command**: `touch src/services/pipeline/PipelineBuilder.ts`
*   **Content**: Create a class `PipelineBuilder`.
    *   It should accept the `ServiceContainer` and `StepRegistry`.
    *   It should have a method `build(settings: AppSettings, data: DataStore): IPipelineRunner`.
    *   Move the declarative `pipelineConfig().addStep(...)` logic from `ConversionOrchestrator.ts` into this class.

**Step 2: Register the Builder**
*   **Read**: `src/di/ServiceContainer.ts` and `src/di/ServiceContext.tsx`
*   **Action**:
    1.  Add `PipelineBuilder: Symbol.for('PipelineBuilder')` to `ServiceTypes`.
    2.  Register the service in `createProductionContainer`.

**Step 3: Refactor ConversionOrchestrator**
*   **Read**: `src/services/ConversionOrchestrator.ts`
*   **Action**:
    1.  Inject `PipelineBuilder`.
    2.  Delete the massive `buildPipeline()` private method.
    3.  In the `run()` method, call `this.pipelineBuilder.build(this.stores.settings, this.stores.data)` instead.

**Instructions for AI**:
> "Read `src/services/ConversionOrchestrator.ts` to understand how the pipeline is currently built. Create `src/services/pipeline/PipelineBuilder.ts` and move the `buildPipeline` logic there. Register the new service in `src/di/ServiceContainer.ts`. Finally, refactor `ConversionOrchestrator.ts` to use this new builder."
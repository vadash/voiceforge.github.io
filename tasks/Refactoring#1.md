# EdgeTTS Refactoring Execution Plan

Based on `tasks/Refactoring#1.md` with user preferences:
- All 6 phases sequentially
- Clean break migration (delete old state files)
- InversifyJS-lite DI container
- Add language switcher UI

---

## Phase 1: Core Architecture

### 1.1 Service Layer Interfaces

**Create `src/services/interfaces.ts`**
```typescript
export interface ITTSService {
  start(): void;
  clear(): void;
}

export interface IWorkerPool {
  addTask(task: PoolTask): void;
  addTasks(tasks: PoolTask[]): void;
  getCompletedAudio(): Map<number, Uint8Array>;
  getProgress(): { current: number; total: number };
}

export interface IAudioMerger {
  calculateMergeGroups(audioMap: Map<number, Uint8Array>, indexToFilename: Map<number, string>): MergeGroup[];
  merge(audioMap: Map<number, Uint8Array>, config: MergeConfig): Promise<MergedFile[]>;
  saveMergedFiles(files: MergedFile[], handle: FileSystemDirectoryHandle | null): Promise<void>;
}

export interface ILLMService {
  extractCharacters(blocks: TextBlock[]): Promise<LLMCharacter[]>;
  assignSpeakers(blocks: TextBlock[], characterMap: Map<string, string>): Promise<SpeakerAssignment[]>;
  cancel(): void;
}

export interface IFFmpegService {
  load(onProgress?: (progress: number) => void): Promise<boolean>;
  processAudio(chunks: Uint8Array[], options: ProcessOptions): Promise<Uint8Array>;
  isAvailable(): boolean;
  terminate(): void;
}

export interface ILogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error): void;
  debug(message: string, data?: Record<string, unknown>): void;
}

export interface ISecureStorage {
  saveApiKey(key: string): Promise<void>;
  loadApiKey(): Promise<string>;
  clearApiKey(): Promise<void>;
}
```

### 1.2 DI Container (InversifyJS-lite pattern)

**Create `src/di/ServiceContainer.ts`**
```typescript
export const ServiceTypes = {
  TTSService: Symbol('ITTSService'),
  WorkerPool: Symbol('IWorkerPool'),
  AudioMerger: Symbol('IAudioMerger'),
  LLMService: Symbol('ILLMService'),
  FFmpegService: Symbol('IFFmpegService'),
  Logger: Symbol('ILogger'),
  SecureStorage: Symbol('ISecureStorage'),
  Config: Symbol('AppConfig'),
} as const;

export class ServiceContainer {
  private services = new Map<symbol, unknown>();
  private factories = new Map<symbol, () => unknown>();

  // Register singleton instance
  register<T>(token: symbol, instance: T): void;

  // Register factory for transient instances
  registerFactory<T>(token: symbol, factory: () => T): void;

  // Get service (singleton or from factory)
  get<T>(token: symbol): T;

  // Check if registered
  has(token: symbol): boolean;
}
```

**Create `src/di/ServiceContext.tsx`**
```typescript
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

const ServiceContext = createContext<ServiceContainer | null>(null);

export function ServiceProvider({ container, children }: Props);
export function useService<T>(token: symbol): T;
export function useServices(): ServiceContainer;

// Factory for production services
export function createProductionContainer(config: AppConfig): ServiceContainer;

// Factory for test services (accepts mock overrides)
export function createTestContainer(overrides?: Partial<ServiceMap>): ServiceContainer;
```

### 1.3 Configuration Extraction

**Create `src/config/index.ts`**
```typescript
export interface AppConfig {
  tts: {
    maxWorkers: number;              // 30
    retryDelays: number[];           // [10000, 30000, ...]
    errorCooldown: number;           // 10000
    rateLimit: number;               // 75 per minute
    websocketTimeout: number;        // 30000
  };
  audio: {
    targetMergeDurationMs: number;   // 30 * 60 * 1000
    tolerancePercent: number;        // 10
    bytesPerMs: number;              // 12
    opusBitrate: number;             // 96
    sampleRate: number;              // 24000
  };
  llm: {
    pass1BlockTokens: number;        // 16000
    pass2BlockTokens: number;        // 8000
    maxConcurrentRequests: number;   // 20
    retryDelays: number[];           // [1000, 3000, 5000, ...]
    maxTokens: number;               // 4000
    temperature: number;             // 0.1
  };
  ffmpeg: {
    cdnUrls: string[];               // jsdelivr, unpkg, cdnjs
    silenceThreshold: string;        // '-40dB'
    silenceMinDuration: number;      // 0.5
    loudnessTarget: number;          // -18
    loudnessRange: number;           // 7
    truePeak: number;                // -1.5
  };
}

export const defaultConfig: AppConfig = { /* values from constants */ };
export function loadConfig(): AppConfig;  // Override from localStorage if needed
```

**Files to modify:**
- `src/services/TTSWorkerPool.ts` - import delays from config
- `src/services/LLMVoiceService.ts` - import LLM config
- `src/services/AudioMerger.ts` - import audio config
- `src/services/FFmpegService.ts` - import FFmpeg config
- Delete hardcoded values in `src/utils/constants.ts` (move to config)

---

## Phase 2: State Management Redesign

### 2.1 Domain Stores

**Create `src/stores/SettingsStore.ts`**
```typescript
export class SettingsStore {
  private state = signal<SettingsState>({
    voice: 'en-US-AvaNeural',
    rate: 0,
    pitch: 0,
    maxThreads: 20,
    outputFormat: 'opus',
    silenceRemoval: false,
    normalization: false,
    // LLM settings
    llmEnabled: false,
    llmApiUrl: '',
    llmModel: '',
  });

  // Computed
  get rateDisplay(): string;
  get pitchDisplay(): string;

  // Actions
  setVoice(voice: string): void;
  setRate(rate: number): void;
  setPitch(pitch: number): void;
  setMaxThreads(threads: number): void;
  setOutputFormat(format: 'mp3' | 'opus'): void;
  toggleSilenceRemoval(): void;
  toggleNormalization(): void;

  // Persistence
  save(): void;
  load(): void;
  reset(): void;
}
```

**Create `src/stores/ConversionStore.ts`**
```typescript
export type ConversionStatus =
  | 'idle'
  | 'llm-pass1'
  | 'llm-pass2'
  | 'converting'
  | 'merging'
  | 'complete'
  | 'error';

export class ConversionStore {
  private state = signal<ConversionState>({
    status: 'idle',
    progress: { current: 0, total: 0 },
    startTime: null,
    error: null,
  });

  // Getters
  get status(): ConversionStatus;
  get progress(): Progress;
  get elapsedTime(): string;
  get isProcessing(): boolean;

  // Actions
  startConversion(): void;
  updateProgress(current: number, total: number): void;
  setStatus(status: ConversionStatus): void;
  setError(error: AppError): void;
  reset(): void;
}
```

**Create `src/stores/LLMStore.ts`**
```typescript
export class LLMStore {
  private state = signal<LLMState>({
    characters: [],
    voiceMap: new Map(),
    currentBlock: 0,
    totalBlocks: 0,
  });

  // Getters
  get characters(): LLMCharacter[];
  get voiceMap(): Map<string, string>;
  get blockProgress(): { current: number; total: number };

  // Actions
  setCharacters(chars: LLMCharacter[]): void;
  updateVoiceMap(name: string, voice: string): void;
  setBlockProgress(current: number, total: number): void;
  reset(): void;
}
```

**Create `src/stores/LogStore.ts`**
```typescript
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: Date;
  elapsed: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

export class LogStore {
  private entries = signal<LogEntry[]>([]);
  private maxEntries = 500;
  private startTime: Date | null = null;

  // Getters
  get all(): LogEntry[];
  get errors(): LogEntry[];
  get warnings(): LogEntry[];

  // Actions
  startTimer(): void;
  add(level: LogLevel, message: string, data?: object): void;
  clear(): void;

  // Export
  toText(): string;
  toJSON(): string;
}
```

**Create `src/stores/DataStore.ts`**
```typescript
export class DataStore {
  private state = signal<DataState>({
    textContent: '',
    book: null,
    dictionary: [],
    directoryHandle: null,
  });

  // Getters
  get textContent(): string;
  get book(): ProcessedBook | null;
  get dictionary(): DictionaryEntry[];
  get directoryHandle(): FileSystemDirectoryHandle | null;

  // Actions
  setTextContent(text: string): void;
  setBook(book: ProcessedBook | null): void;
  setDictionary(entries: DictionaryEntry[]): void;
  setDirectoryHandle(handle: FileSystemDirectoryHandle | null): void;
  clear(): void;
}
```

### 2.2 Store Provider

**Create `src/stores/StoreContext.tsx`**
```typescript
export interface Stores {
  settings: SettingsStore;
  conversion: ConversionStore;
  llm: LLMStore;
  logs: LogStore;
  data: DataStore;
}

const StoreContext = createContext<Stores | null>(null);

export function StoreProvider({ children }: Props);
export function useStores(): Stores;
export function useStore<K extends keyof Stores>(key: K): Stores[K];

// Factory for tests
export function createTestStores(initialState?: Partial<StoresState>): Stores;
```

### 2.3 Migration

**Delete files:**
- `src/state/appState.ts`
- `src/state/llmState.ts`

**Keep and extend:**
- `src/state/types.ts` - add new type definitions

**Update all consumers:**
- Components: Use `useStore()` hook
- Services: Accept stores via constructor injection

---

## Phase 3: Pipeline Refactoring

### 3.1 Conversion Orchestrator

**Create `src/services/ConversionOrchestrator.ts`**
```typescript
export class ConversionOrchestrator {
  private abortController: AbortController | null = null;

  constructor(
    private container: ServiceContainer,
    private stores: Stores
  ) {}

  async run(): Promise<void> {
    this.abortController = new AbortController();
    const logger = this.container.get<ILogger>(ServiceTypes.Logger);

    try {
      // Step 1: LLM Pass 1 (if enabled)
      if (this.stores.settings.llmEnabled) {
        this.stores.conversion.setStatus('llm-pass1');
        await this.runLLMPass1();
      }

      // Step 2: LLM Pass 2 (if enabled)
      if (this.stores.settings.llmEnabled) {
        this.stores.conversion.setStatus('llm-pass2');
        await this.runLLMPass2();
      }

      // Step 3: TTS Conversion
      this.stores.conversion.setStatus('converting');
      const audioMap = await this.runTTSConversion();

      // Step 4: Audio Merge
      this.stores.conversion.setStatus('merging');
      await this.mergeAndSave(audioMap);

      this.stores.conversion.setStatus('complete');
    } catch (error) {
      if (error instanceof AppError) {
        this.stores.conversion.setError(error);
      }
      throw error;
    }
  }

  cancel(): void {
    this.abortController?.abort();
    // Cleanup resources
  }

  private async runLLMPass1(): Promise<void>;
  private async runLLMPass2(): Promise<void>;
  private async runTTSConversion(): Promise<Map<number, Uint8Array>>;
  private async mergeAndSave(audioMap: Map<number, Uint8Array>): Promise<void>;
}
```

### 3.2 Simplified Hook

**Refactor `src/hooks/useTTSConversion.ts`**
```typescript
export function useTTSConversion() {
  const container = useServices();
  const stores = useStores();
  const orchestratorRef = useRef<ConversionOrchestrator | null>(null);

  const start = useCallback(async () => {
    orchestratorRef.current = new ConversionOrchestrator(container, stores);
    stores.conversion.startConversion();
    stores.logs.startTimer();

    try {
      await orchestratorRef.current.run();
    } catch (error) {
      stores.logs.add('error', error.message);
    }
  }, [container, stores]);

  const cancel = useCallback(() => {
    orchestratorRef.current?.cancel();
    stores.conversion.reset();
  }, [stores]);

  return { start, cancel };
}
```

---

## Phase 4: Error Handling & Logging

### 4.1 Structured Errors

**Create `src/errors/index.ts`**
```typescript
export type ErrorCode =
  | 'TTS_WEBSOCKET_FAILED'
  | 'TTS_TIMEOUT'
  | 'TTS_EMPTY_RESPONSE'
  | 'LLM_API_ERROR'
  | 'LLM_VALIDATION_ERROR'
  | 'LLM_TIMEOUT'
  | 'FFMPEG_LOAD_FAILED'
  | 'FFMPEG_PROCESS_ERROR'
  | 'FILE_SYSTEM_ERROR'
  | 'FILE_PARSE_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: Error,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  static fromCode(code: ErrorCode, cause?: Error): AppError;

  toJSON(): object;
}

// Error messages (i18n keys)
export const errorMessages: Record<ErrorCode, string> = {
  TTS_WEBSOCKET_FAILED: 'errors.tts.websocket',
  // ...
};
```

### 4.2 Retry Strategy

**Create `src/utils/RetryStrategy.ts`**
```typescript
export interface RetryStrategy {
  shouldRetry(error: Error, attempt: number): boolean;
  getDelay(attempt: number): number;
  maxAttempts: number;
}

export class ExponentialBackoffStrategy implements RetryStrategy {
  constructor(
    public maxAttempts: number,
    private baseDelay: number,
    private maxDelay: number,
    private multiplier: number = 2
  ) {}

  shouldRetry(error: Error, attempt: number): boolean;
  getDelay(attempt: number): number;
}

export class FixedDelaysStrategy implements RetryStrategy {
  constructor(private delays: number[]) {}

  get maxAttempts(): number { return this.delays.length; }
  shouldRetry(error: Error, attempt: number): boolean;
  getDelay(attempt: number): number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  strategy: RetryStrategy,
  logger?: ILogger,
  signal?: AbortSignal
): Promise<T>;
```

### 4.3 Logger Service

**Create `src/services/LoggerService.ts`**
```typescript
export class LoggerService implements ILogger {
  constructor(private store: LogStore) {}

  info(message: string, data?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, data);
    this.store.add('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, data);
    this.store.add('warn', message, data);
  }

  error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`, error);
    this.store.add('error', message, { error: error?.message, stack: error?.stack });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data);
      this.store.add('debug', message, data);
    }
  }
}
```

---

## Phase 5: UI Improvements

### 5.1 StatusArea Enhancement

**Refactor `src/components/StatusArea.tsx`**
- Auto-scroll to bottom on new entries
- Color-coded log levels (CSS classes: `.log-info`, `.log-warn`, `.log-error`)
- Progress bar with percentage and ETA calculation
- Filter buttons (All / Errors / Warnings)
- Clear logs button
- Copy logs button (clipboard API)
- Export logs button (download as .txt)

### 5.2 Extract Inline Styles

**Create `src/styles/components.css`**
- Move inline styles from `LLMSettingsPanel.tsx`
- Move inline styles from `SettingsPanel.tsx`
- Move inline styles from `PointsSelector.tsx`
- Use CSS custom properties for all colors
- Add semantic classes: `.input-field`, `.success-message`, `.error-message`

### 5.3 Language Switcher

**Modify `src/index.tsx`**
- Dynamic language loading based on `languageStore`
- Load appropriate JSON on startup

**Create `src/stores/LanguageStore.ts`**
```typescript
export class LanguageStore {
  private locale = signal<'en' | 'ru'>('en');

  get current(): 'en' | 'ru';
  setLocale(locale: 'en' | 'ru'): void;
  save(): void;
  load(): void;
}
```

**Create `src/components/Settings/LanguageSelector.tsx`**
- Dropdown with language options
- Saves preference to localStorage
- Triggers app re-render with new locale

**Update i18n files:**
- `src/i18n/en.json` - add new keys for UI enhancements
- `src/i18n/ru.json` - add matching translations

### 5.4 Component Cleanup

- Add TypeScript props interfaces to all components
- Ensure all user-visible strings use `<Text>` component
- Add aria-labels for accessibility

---

## Phase 6: Test Infrastructure

### 6.1 Vitest Setup

**Create `vitest.config.ts`**
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

**Create `src/test/setup.ts`**
- Preact testing library setup
- Mock browser APIs (localStorage, IndexedDB, WebSocket)
- Global test utilities

### 6.2 Mock Implementations

**Create `src/test/mocks/`**
- `MockTTSService.ts`
- `MockWorkerPool.ts`
- `MockLLMService.ts`
- `MockFFmpegService.ts`
- `MockLogger.ts`
- `MockSecureStorage.ts`

### 6.3 Test Utilities

**Create `src/test/TestServiceContainer.ts`**
```typescript
export function createTestContainer(overrides?: Partial<ServiceMap>): ServiceContainer;
export function createTestStores(initialState?: Partial<StoresState>): Stores;
export function renderWithProviders(ui: VNode, options?: RenderOptions): RenderResult;
```

---

## Implementation Order

| Step | Phase | Task | Est. Time |
|------|-------|------|-----------|
| 1 | 1.3 | Create `src/config/index.ts` with all extracted constants | 1h |
| 2 | 1.1 | Create `src/services/interfaces.ts` | 1h |
| 3 | 1.2 | Create DI container (`ServiceContainer.ts`, `ServiceContext.tsx`) | 2h |
| 4 | 2.1 | Create all stores (Settings, Conversion, LLM, Log, Data) | 3h |
| 5 | 2.2 | Create `StoreContext.tsx` and `LanguageStore.ts` | 1h |
| 6 | 2.3 | Delete old state files, update all component imports | 2h |
| 7 | 4.1 | Create `src/errors/index.ts` | 1h |
| 8 | 4.2 | Create `src/utils/RetryStrategy.ts` | 1h |
| 9 | 4.3 | Create `LoggerService.ts` | 30m |
| 10 | 3.1 | Create `ConversionOrchestrator.ts` | 3h |
| 11 | 3.2 | Refactor `useTTSConversion.ts` | 1h |
| 12 | 1.x | Update existing services to implement interfaces | 2h |
| 13 | 5.2 | Create `src/styles/components.css`, extract inline styles | 2h |
| 14 | 5.1 | Enhance `StatusArea.tsx` | 2h |
| 15 | 5.3 | Add language switcher UI | 1h |
| 16 | 5.4 | Component cleanup (props interfaces, i18n, a11y) | 2h |
| 17 | 6.1 | Vitest setup | 1h |
| 18 | 6.2 | Create mock implementations | 2h |
| 19 | 6.3 | Create test utilities | 1h |

**Total estimated: ~28 hours**

---

## Critical Files to Read Before Implementation

1. `src/hooks/useTTSConversion.ts` (428 lines) - main orchestration to refactor
2. `src/state/appState.ts` (151 lines) - signals to migrate
3. `src/state/llmState.ts` - LLM signals to migrate
4. `src/services/TTSWorkerPool.ts` (201 lines) - retry logic reference
5. `src/services/LLMVoiceService.ts` (641 lines) - LLM integration
6. `src/components/StatusArea.tsx` - current logging UI
7. `src/components/Settings/LLMSettingsPanel.tsx` - inline styles to extract
8. `src/utils/constants.ts` - values to move to config

---

## Breaking Changes

1. All component imports from `@/state/appState` → `@/stores/...`
2. All component imports from `@/state/llmState` → `@/stores/...`
3. Service instantiation moves from hooks to DI container
4. Status messages now use LogStore instead of `addStatusLine()`

## Rollback Strategy

Git branches per phase:
- `refactor/phase-1-core-arch`
- `refactor/phase-2-state`
- `refactor/phase-3-pipeline`
- `refactor/phase-4-errors`
- `refactor/phase-5-ui`
- `refactor/phase-6-tests`

Merge to `master` only after each phase is complete and tested.

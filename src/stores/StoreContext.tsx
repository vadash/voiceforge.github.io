// Store Context for Preact
// Provides React-like context for state management

import { createContext, ComponentChildren } from 'preact';
import { useContext, useMemo } from 'preact/hooks';

import { SettingsStore, createSettingsStore } from './SettingsStore';
import { ConversionStore, createConversionStore } from './ConversionStore';
import { LLMStore, createLLMStore } from './LLMStore';
import { LogStore, createLogStore } from './LogStore';
import { DataStore, createDataStore } from './DataStore';
import { LanguageStore, createLanguageStore } from './LanguageStore';

// ============================================================================
// Store Types
// ============================================================================

/**
 * All stores combined
 */
export interface Stores {
  settings: SettingsStore;
  conversion: ConversionStore;
  llm: LLMStore;
  logs: LogStore;
  data: DataStore;
  language: LanguageStore;
}

// ============================================================================
// Context Definition
// ============================================================================

const StoreContext = createContext<Stores | null>(null);

interface StoreProviderProps {
  stores: Stores;
  children: ComponentChildren;
}

/**
 * Provider component that makes stores available to all children
 */
export function StoreProvider({ stores, children }: StoreProviderProps) {
  return (
    <StoreContext.Provider value={stores}>
      {children}
    </StoreContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get all stores
 * @throws Error if used outside StoreProvider
 */
export function useStores(): Stores {
  const stores = useContext(StoreContext);
  if (!stores) {
    throw new Error('useStores must be used within a StoreProvider');
  }
  return stores;
}

/**
 * Hook to get a specific store
 */
export function useStore<K extends keyof Stores>(key: K): Stores[K] {
  const stores = useStores();
  return stores[key];
}

/**
 * Hook to get settings store
 */
export function useSettings(): SettingsStore {
  return useStore('settings');
}

/**
 * Hook to get conversion store
 */
export function useConversion(): ConversionStore {
  return useStore('conversion');
}

/**
 * Hook to get LLM store
 */
export function useLLM(): LLMStore {
  return useStore('llm');
}

/**
 * Hook to get log store
 */
export function useLogs(): LogStore {
  return useStore('logs');
}

/**
 * Hook to get data store
 */
export function useData(): DataStore {
  return useStore('data');
}

/**
 * Hook to get language store
 */
export function useLanguage(): LanguageStore {
  return useStore('language');
}

// ============================================================================
// Store Factory
// ============================================================================

/**
 * Create all stores with default configuration
 */
export function createStores(): Stores {
  const logs = createLogStore();
  const settings = createSettingsStore();
  const llm = createLLMStore();

  // Connect logger to stores that need it
  settings.setLogStore(logs);
  llm.setLogStore(logs);

  return {
    settings,
    conversion: createConversionStore(),
    llm,
    logs,
    data: createDataStore(),
    language: createLanguageStore(),
  };
}

/**
 * Initial state for test stores
 */
export interface TestStoresState {
  settings?: Partial<ReturnType<SettingsStore['toObject']>>;
  // Add more as needed
}

/**
 * Create stores for testing with optional initial state
 */
export function createTestStores(initialState?: TestStoresState): Stores {
  const stores = createStores();

  // Apply initial state if provided
  if (initialState?.settings) {
    const s = stores.settings;
    const init = initialState.settings;

    if (init.voice !== undefined) s.voice.value = init.voice;
    if (init.narratorVoice !== undefined) s.narratorVoice.value = init.narratorVoice;
    if (init.rate !== undefined) s.rate.value = init.rate;
    if (init.pitch !== undefined) s.pitch.value = init.pitch;
    if (init.maxThreads !== undefined) s.maxThreads.value = init.maxThreads;
    if (init.outputFormat !== undefined) s.outputFormat.value = init.outputFormat;
  }

  return stores;
}

/**
 * Initialize stores (load persisted state)
 */
export async function initializeStores(stores: Stores): Promise<void> {
  // Load settings from localStorage
  stores.settings.load();

  // Load LLM settings (async for encrypted API key)
  await stores.llm.loadSettings();

  // Load language preference
  stores.language.load();
}

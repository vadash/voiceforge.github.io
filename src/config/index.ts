// Application Configuration
// Centralized configuration extracted from magic numbers across services

export interface TTSConfig {
  /** Maximum concurrent WebSocket workers */
  maxWorkers: number;
  /** Initial retry delay in ms */
  initialRetryDelay: number;
  /** Second retry delay in ms */
  secondRetryDelay: number;
  /** Multiplier for exponential backoff after second retry */
  retryMultiplier: number;
  /** Maximum retry delay in ms */
  maxRetryDelay: number;
  /** Rate limit: workers per minute */
  workersPerMinute: number;
  /** Cooldown after error before spawning new workers (ms) */
  errorCooldown: number;
}

export interface AudioConfig {
  /** Target merge duration in minutes */
  targetDurationMinutes: number;
  /** Tolerance percent for merge duration */
  tolerancePercent: number;
  /** Edge TTS output: 96kbps = 12 bytes/ms */
  bytesPerMs: number;
  /** Opus encoding bitrate (kbps) */
  opusBitrate: number;
  /** Opus compression level (1-10) */
  opusCompression: number;
  /** Sample rate (Hz) */
  sampleRate: number;
  /** Normalization LUFS target */
  normLufs: number;
  /** Normalization LRA */
  normLra: number;
  /** Normalization true peak (dB) */
  normTruePeak: number;
  /** Silence removal threshold (dB) */
  silenceThreshold: number;
  /** Silence start periods */
  silenceStartPeriods: number;
  /** Silence start duration (seconds) */
  silenceStartDuration: number;
  /** Silence stop periods (-1 = no limit) */
  silenceStopPeriods: number;
  /** Silence stop duration (seconds) */
  silenceStopDuration: number;
}

export interface LLMConfig {
  /** Token limit for Pass 1 blocks */
  pass1BlockTokens: number;
  /** Token limit for Pass 2 blocks */
  pass2BlockTokens: number;
  /** Maximum concurrent API requests */
  maxConcurrentRequests: number;
  /** Retry delays in ms (array for sequential delays) */
  retryDelays: number[];
  /** Maximum tokens for API response */
  maxTokens: number;
  /** Temperature for deterministic output */
  temperature: number;
}

export interface FFmpegConfig {
  /** FFmpeg WASM version */
  version: string;
  /** CDN mirror URLs for loading FFmpeg */
  cdnMirrors: string[];
}

export interface EdgeTTSApiConfig {
  /** WebSocket base URL */
  baseUrl: string;
  /** Trusted client token */
  trustedClientToken: string;
  /** Security version header */
  secMsGecVersion: string;
  /** Audio format */
  audioFormat: string;
}

export interface TextProcessingConfig {
  /** Maximum chunk size for initial text processing (characters). Used by TextProcessor to control sentence grouping before TTS conversion. Smaller chunks reduce memory usage and improve processing responsiveness. */
  firstStringsLength: number;
  /** Maximum chunk size for final text segments (characters). Used in TextProcessor.splitIntoSections() to split text when encountering punctuation at segment boundaries. Larger than firstStringsLength to ensure complete sentences and avoid mid-sentence cuts. */
  lastStringsLength: number;
  /** Default number of parallel TTS conversion threads. Used as fallback value in SettingsStore when user hasn't configured custom maxThreads. Controls concurrent WebSocket connections to Edge TTS API. */
  defaultThreads: number;
  /** Default number of audio segments to merge. This value appears to be a legacy parameter from earlier merge logic; current AudioMerger uses duration-based merging (30-minute chunks) rather than count-based merging. */
  defaultMerge: number;
}

export interface AppConfig {
  tts: TTSConfig;
  audio: AudioConfig;
  llm: LLMConfig;
  ffmpeg: FFmpegConfig;
  edgeTtsApi: EdgeTTSApiConfig;
  textProcessing: TextProcessingConfig;
}

/**
 * Default application configuration
 */
export const defaultConfig: AppConfig = {
  tts: {
    maxWorkers: 30,
    initialRetryDelay: 10000, // 10 seconds
    secondRetryDelay: 30000, // 30 seconds
    retryMultiplier: 3,
    maxRetryDelay: 600000, // 10 minutes
    workersPerMinute: 75,
    errorCooldown: 10000, // 10 seconds
  },

  audio: {
    targetDurationMinutes: 30,
    tolerancePercent: 10,
    bytesPerMs: 12, // 96kbps = 12 bytes/ms
    opusBitrate: 48,
    opusCompression: 10,
    sampleRate: 24000,
    normLufs: -18,
    normLra: 7,
    normTruePeak: -1.5,
    silenceThreshold: -40,
    silenceStartPeriods: 1,
    silenceStartDuration: 0.5,
    silenceStopPeriods: -1,
    silenceStopDuration: 0.25,
  },

  llm: {
    pass1BlockTokens: 16000,
    pass2BlockTokens: 8000,
    maxConcurrentRequests: 20,
    retryDelays: [5000, 10000, 20000, 60000, 180000, 600000, 1200000, 2400000, 4800000],
    maxTokens: 4000,
    temperature: 0.1,
  },

  ffmpeg: {
    version: '0.12.10',
    cdnMirrors: [
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd',
      'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd',
      'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.12.10/umd',
    ],
  },

  edgeTtsApi: {
    baseUrl: 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1',
    trustedClientToken: '6A5AA1D4EAFF4E9FB37E23D68491D6F4',
    secMsGecVersion: '1-130.0.2849.68',
    audioFormat: 'audio-24khz-96kbitrate-mono-mp3',
  },

  textProcessing: {
    firstStringsLength: 800,
    lastStringsLength: 4200,
    defaultThreads: 20,
    defaultMerge: 10,
  },
};

// Windows epoch for Sec-MS-GEC generation
export const WIN_EPOCH = 11644473600;
export const S_TO_NS = 1e9;

/**
 * Load configuration with localStorage overrides (if needed in future)
 */
export function loadConfig(): AppConfig {
  // For now, return default config
  // In future, could merge with localStorage overrides
  return { ...defaultConfig };
}

/**
 * Get retry delay based on attempt number for TTS
 */
export function getTTSRetryDelay(retryCount: number, config: TTSConfig = defaultConfig.tts): number {
  if (retryCount === 0) return config.initialRetryDelay;
  if (retryCount === 1) return config.secondRetryDelay;
  // For retry 2+: secondDelay * multiplier^(retryCount-1), capped at maxDelay
  const delay = config.secondRetryDelay * Math.pow(config.retryMultiplier, retryCount - 1);
  return Math.min(delay, config.maxRetryDelay);
}

/**
 * Get start delay between worker spawns
 */
export function getWorkerStartDelay(config: TTSConfig = defaultConfig.tts): number {
  return 60000 / config.workersPerMinute;
}

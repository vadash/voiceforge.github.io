// API constants and configuration

export const EDGE_TTS_API = {
  BASE_URL: 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1',
  TRUSTED_CLIENT_TOKEN: '6A5AA1D4EAFF4E9FB37E23D68491D6F4',
  SEC_MS_GEC_VERSION: '1-130.0.2849.68',
  AUDIO_FORMAT: 'audio-24khz-96kbitrate-mono-mp3',
};

export const TEXT_PROCESSING = {
  FIRST_STRINGS_LENGTH: 800,
  LAST_STRINGS_LENGTH: 4200,
  DEFAULT_THREADS: 20,
  DEFAULT_MERGE: 10,
};

// Windows epoch for Sec-MS-GEC generation
export const WIN_EPOCH = 11644473600;
export const S_TO_NS = 1e9;

// FFmpeg WASM Configuration
export const FFMPEG_CONFIG = {
  VERSION: '0.12.10',
  CDN_MIRRORS: [
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd',
    'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd',
    'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.12.10/umd',
  ],
};

// Audio Processing Settings
export const AUDIO_PROCESSING = {
  // Duration-based merge (replaces count-based)
  TARGET_DURATION_MINUTES: 30,
  TOLERANCE_PERCENT: 10,
  // Edge TTS output: 96kbps = 12 bytes/ms
  BYTES_PER_MS: 12,

  // Opus encoding
  OPUS_BITRATE: 96,
  OPUS_COMPRESSION: 10,
  SAMPLE_RATE: 24000,

  // Normalization (EBU R128 modified)
  NORM_LUFS: -18,
  NORM_LRA: 7,
  NORM_TP: -1.5,

  // Silence removal
  SILENCE_THRESHOLD: -40,
  SILENCE_START_PERIODS: 1,
  SILENCE_START_DURATION: 0.5,
  SILENCE_STOP_PERIODS: -1,
  SILENCE_STOP_DURATION: 0.25,
};

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

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run type-check   # TypeScript type checking
npm run test         # Run all mock tests
npm run test:real    # Run tests with real API key
```

## Architecture

A Preact + TypeScript web app that converts text files to MP3 audio using Microsoft Edge's TTS WebSocket API.

### Core Flow

1. **File Input** → `FileConverter` parses TXT/FB2/EPUB/ZIP files
2. **Pipeline** → `ConversionOrchestrator` runs 10 discrete pipeline steps:
   - Extract (LLM character detection)
   - Merge (LLM character deduplication)
   - Voice Assignment
   - Voice Remapping
   - Assign (LLM speaker assignment)
   - Text Sanitization
   - Dictionary Processing
   - TTS Conversion (parallel WebSocket connections)
   - Audio Merge
   - Save
3. **Audio Output** → `AudioMerger` combines MP3 chunks and saves/downloads

### Pipeline Architecture (`src/services/pipeline/`)

- **PipelineRunner**: Executes steps in sequence with progress tracking and cancellation
- **PipelineContext**: Immutable context passed between steps
- **BasePipelineStep**: Abstract base with progress reporting and cancellation helpers

### Key Services (`src/services/`)

- **EdgeTTSService**: WebSocket client for Edge TTS API
- **TTSWorkerPool**: Queue-based worker pool with retry logic (3 retries, exponential backoff)
- **FileConverter**: Converts FB2/EPUB/ZIP to plain text
- **AudioMerger**: Merges audio by ~30min duration, supports Opus via FFmpeg
- **FFmpegService**: Singleton for FFmpeg WASM (CDN fallback chain)
- **SecureStorage**: Encrypts API keys using Web Crypto API with non-extractable AES-256 key

### LLM Voice Assignment System (`src/services/llm/`)

Optional multi-voice audiobooks using LLM-based character detection:

- **Three-pass system**: Extract → Merge → Assign
- **3-Way Voting** (optional): Calls LLM 3x with different temps for Assign step, uses majority vote (tiebreaker: 0.0). Debug logs disagreements to console.
- Uses sparse output format with character codes (A-Z, 0-9, a-z) for token reduction
- Infinite retry with exponential backoff
- Logs to: `logs/extract_*.json`, `logs/merge_*.json`, `logs/assign_*.json`

### State Management (`src/stores/`)

Preact Signals with typed stores:
- **SettingsStore**: Voice, rate, pitch, threads, output format, audio processing
- **ConversionStore**: Progress, status lines, save path
- **DataStore**: Dictionary, text content, book metadata
- **LLMStore**: API settings, characters, voice mappings, useVoting toggle
- **LogStore**: info/warn/error logs (debug → console only)

Settings persist to localStorage.

### UI Architecture

- **Styling**: Tailwind CSS v3 with custom dark theme (`tailwind.config.js`)
- **Routing**: Hash-based (`#/`, `#/settings`, `#/logs`) for GitHub Pages
- **Layout**: Desktop (header nav) / Mobile (<768px, bottom tabs)
- **Components**: `src/components/` - common/, layout/, convert/, settings/tabs/, status/

## Testing

Vitest + jsdom with mocked browser APIs (localStorage, IndexedDB, WebSocket, Audio, File APIs).

## Key File Structure

```
src/
├── config/          # Centralized configuration
├── di/              # Dependency injection
├── services/        # Business logic
│   ├── llm/         # LLM voice assignment
│   └── pipeline/    # Pipeline steps
├── stores/          # Preact Signals state
├── components/      # UI components
├── hooks/           # React hooks
├── i18n/            # en.json, ru.json
└── test/            # Test utilities
```

## Dictionary Format (.lexx files)

## CRITICAL

1. USE bash commands for Windows!
2. NO FALLBACKS! If you want to add one ask user first.

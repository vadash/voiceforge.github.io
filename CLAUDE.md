## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build to dist/
npm run type-check   # TypeScript type checking
npm run preview      # Serve production build locally
npm run test         # Run all tests once (Vitest)
```

## Architecture

A Preact + TypeScript web app that converts text files to MP3 audio using Microsoft Edge's TTS WebSocket API.

### Core Flow

1. **File Input** → `FileConverter` parses TXT/FB2/EPUB/ZIP files
2. **Pipeline** → `ConversionOrchestrator` runs 7 discrete pipeline steps:
   - Character Extraction (LLM Pass 1)
   - Voice Assignment
   - Speaker Assignment (LLM Pass 2)
   - Dictionary Processing
   - TTS Conversion (parallel WebSocket connections)
   - Audio Merge
   - Save
3. **Audio Output** → `AudioMerger` combines MP3 chunks and saves/downloads

### Pipeline Architecture (`src/services/pipeline/`)

The conversion pipeline uses composable steps:
- **PipelineRunner**: Executes steps in sequence with progress tracking and cancellation
- **PipelineContext**: Immutable context passed between steps (text, characters, voiceMap, audioMap, etc.)
- **BasePipelineStep**: Abstract base with progress reporting and cancellation helpers
- Each step is independently testable via factory injection

### Key Services (`src/services/`)

- **ConversionOrchestrator**: Builds and runs the pipeline, handles progress updates to stores
- **EdgeTTSService**: WebSocket client for Edge TTS API. Sends SSML via WebSocket, receives binary audio chunks, handles reconnection on failure.
- **TTSWorkerPool**: Queue-based worker pool with retry logic (3 retries, exponential backoff). Manages concurrent TTS requests.
- **TextProcessor**: Applies .lexx dictionary rules (regex and word-based), handles punctuation replacement, splits text into chunks.
- **FileConverter**: Converts FB2 (XML parser), EPUB (JSZip + NCX navigation), ZIP archives to plain text.
- **AudioMerger**: Merges audio by ~30min duration, supports Opus encoding via FFmpeg.
- **FFmpegService**: Singleton for FFmpeg WASM loading from CDN (jsdelivr/unpkg/cdnjs fallback). Handles Opus encoding, silence removal, and normalization.
- **SecureStorage**: Encrypts sensitive data (API keys) using Web Crypto API. Uses non-extractable AES-256 key stored in IndexedDB, making exported data useless on other machines/browsers.

### LLM Voice Assignment System

Optional feature for multi-voice audiobooks using LLM-based character detection:

- **TextBlockSplitter**: Splits text into sentences and blocks for LLM processing. Uses 16k token blocks for Pass 1, 8k for Pass 2.
- **LLMVoiceService**: Two-pass LLM system using OpenAI-compatible API:
  - Pass 1: Extracts characters from text (sequential processing, detects gender/name variations)
  - Pass 2: Assigns speakers to sentences (parallel)
  - Uses sparse output format with character codes (A-Z, 0-9, a-z) for token reduction
  - Infinite retry with exponential backoff
- **VoiceAssigner**: Assigns unique voices to characters based on detected gender, avoiding duplicates.
- **VoicePoolBuilder**: Builds voice pools filtered by locale/gender (ru-*, en-*, multilingual voices).

### State Management (`src/stores/`)

Modern state management using Zustand with typed stores:

- **SettingsStore**: Voice settings (voice, rate, pitch, maxThreads), output format (MP3/Opus), audio processing toggles (silence removal, normalization)
- **ConversionStore**: Conversion progress (isProcessing, processedCount, totalCount), status lines, save path handle
- **DataStore**: Dictionary, text content, book metadata
- **LLMStore**: LLM settings (enabled, API key, URL, model), processing status, detected characters, voice mappings
- **LogStore**: Centralized logging service
- **LanguageStore**: UI language preferences

Settings persist to localStorage via Zustand persistence middleware.

### Components Structure

- `VoiceSelector`: many voices across locales (hardcoded in `voices.ts`)
- `SettingsPanel`: Rate/pitch sliders, output format (MP3/Opus), silence/normalization toggles
- `FileHandlers`: File upload and .lexx dictionary upload
- `ConvertButton`: Triggers conversion via `useTTSConversion` hook

### useTTSConversion Hook

Main hook in `src/hooks/useTTSConversion.ts`:
- Creates `ConversionOrchestrator` instance per conversion
- Provides startConversion, cancel, and selectDirectory methods
- Exposes isProcessing and progress state

### Configuration (`src/config/`)

Centralized configuration system with type-safe defaults:
- **TTS Config**: Worker limits, retry strategies, rate limits
- **Audio Config**: Processing parameters, FFmpeg settings, silence removal thresholds
- **LLM Config**: Token limits, concurrency settings, retry delays
- **FFmpeg Config**: WASM version, CDN mirrors
- **EdgeTTS API Config**: WebSocket URLs, authentication tokens
- **Text Processing Config**: Chunk sizes, default thread counts

### Dependency Injection (`src/di/`)

Lightweight DI container for service management:
- **ServiceContainer**: Registers and resolves service dependencies
- **ServiceContext**: React context provider for accessing services in components
- **ServiceLifecycle**: Manages singleton services (FFmpeg, logging)

### Audio Processing (FFmpeg)

- **Format**: Opus or MP3 fallback
- **Merge**: Duration-based, respects file boundaries
- **Silence removal**
- **Normalization**
- **CDN loading**

## Testing

The project uses **Vitest** as the test runner with **jsdom** environment for DOM testing.

### Test Setup (`src/test/setup.ts`)

Comprehensive test environment with mocked browser APIs:
- **localStorage/IndexedDB**: Full mock implementation for storage testing
- **WebSocket**: Mocked WebSocket class for TTS service testing
- **Audio API**: Mocked Audio class and audio-related APIs
- **Browser APIs**: Mocked ResizeObserver, IntersectionObserver, clipboard APIs
- **File APIs**: Mocked URL.createObjectURL/revokeObjectURL for blob handling

### Test Configuration (`vitest.config.ts`)

- **Environment**: jsdom with Preact aliases (react/preact → preact/compat)
- **Path Resolution**: `@/` alias maps to `src/`
- **Coverage**: V8 provider with text, HTML, and LCOV reporters
- **Test Files**: `src/**/*.test.ts` and `src/**/*.test.tsx`
- **Exclusions**: Test files, setup files, and entry point excluded from coverage

### Testing Dependencies

- **@testing-library/preact**: Preact testing utilities
- **jsdom**: DOM environment for testing
- **@vitest/coverage-v8**: Coverage reporting

## TypeScript Configuration

- **Target**: ES2020 with ESNext modules
- **JSX**: React JSX with Preact as import source
- **Strict Mode**: Enabled with all strict type checking options
- **Path Aliases**: `@/*` maps to `src/*`
- **Output**: Declarations and source maps to `dist/`
- **Module Resolution**: Node with ES2021 lib support

## Build Configuration

- Webpack with ts-loader
- Production builds output to `/EdgeTTS/` path (for GitHub Pages)
- Path alias: `@/` maps to `src/`
- React/ReactDOM aliased to Preact

## Dictionary Format (.lexx files)

```
word=replacement           # Word boundary match
"exact"="replacement"      # Exact string match
regex"pattern"="replace"   # Regex pattern
```

## Key File Structure

```
src/
├── config/          # Centralized configuration
├── di/              # Dependency injection system
├── services/        # Business logic and API clients
│   └── pipeline/    # Pipeline runner and steps
├── stores/          # Zustand state management
├── hooks/           # React hooks
├── components/      # Preact UI components
├── state/types.ts   # Shared TypeScript types
├── utils/           # Utility functions
├── errors/          # Error handling
└── test/            # Test utilities and factories
```

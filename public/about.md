# Edge TTS - Text to Speech Converter

A web application that converts text files to MP3/Opus audio using Microsoft Edge's TTS WebSocket API.

## Features

### Core Functionality
- **Multiple Input Formats**: TXT, FB2, EPUB, ZIP archives
- **High-Quality Audio**: MP3 or Opus output with configurable bitrate
- **Parallel Processing**: Multi-threaded conversion for faster results
- **Audio Processing**: Silence removal, normalization via FFmpeg

### LLM-Powered Voice Assignment
- **Character Detection**: AI automatically identifies characters in your text
- **Multi-Voice Audiobooks**: Each character gets a unique voice
- **Gender-Aware**: Assigns male/female voices based on detected gender
- **Free LLM Options**: Works with Google Gemini, OpenRouter, and many free providers

### User Experience
- **Drag & Drop**: Simple file upload interface
- **Progress Tracking**: Real-time conversion status and ETA
- **Dictionary Support**: Custom pronunciation rules (.lexx files)
- **Settings Export/Import**: Backup and share your configuration

## How to Use

1. **Upload** - Drop a text file (TXT, FB2, EPUB) or paste text directly
2. **Configure** - Select voice, speed, pitch in Settings
3. **Optional: Enable LLM** - For multi-voice books, configure LLM API in Settings → LLM tab
4. **Convert** - Click "Save to MP3" and select output folder

## LLM Setup (Optional)

For multi-voice audiobooks:
1. Go to Settings → LLM tab
2. Enable "LLM Voice Assignment"
3. Enter API URL and API Key
4. Recommended: Google AI Studio (free 1000 requests/day)

See the "?" button in LLM settings for detailed free provider options.

## Technology

- Built with Preact + TypeScript
- Uses Microsoft Edge TTS WebSocket API
- FFmpeg WASM for audio processing
- OpenAI-compatible API for character detection

# Edge TTS Web

A web-based Text-to-Speech converter using Microsoft Edge's TTS service. Converts text files (TXT, FB2, EPUB, ZIP) to MP3 audio files.

## Features

- **340+ voices** across 80+ languages
- **Multiple file formats**: TXT, FB2, EPUB, ZIP archives
- **Batch processing**: Convert multiple files at once
- **Custom dictionary**: Apply pronunciation rules via .lexx files
- **Parallel processing**: Up to 30 concurrent TTS requests
- **MP3 merging**: Combine multiple audio files
- **Mobile-friendly**: Responsive design for desktop and mobile

## Tech Stack

- **Preact** + **TypeScript**
- **Webpack** build
- **Preact Signals** for state management
- **preact-i18n** for internationalization

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

## Deployment

The app automatically deploys to GitHub Pages on push to `master` branch via GitHub Actions.

### Manual Deployment

1. Build: `npm run build`
2. Deploy `dist/` folder to your static hosting

## Project Structure

```
src/
├── components/          # UI components
│   ├── VoiceSelector/   # Voice dropdown
│   ├── Settings/        # Settings panel, sliders
│   └── FileHandlers/    # File upload components
├── services/            # Business logic
│   ├── EdgeTTSService   # WebSocket TTS client
│   ├── TextProcessor    # Text chunking/dictionary
│   └── FileConverter    # FB2/EPUB/ZIP converters
├── state/               # App state (Preact signals)
├── styles/              # CSS (theme, global, responsive)
├── i18n/                # Translations (ru, en)
└── utils/               # Utilities (sha256, uuid)
```

## License

MIT

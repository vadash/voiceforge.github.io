# LLM-Based Voice Assignment System - Implementation Plan

## Overview

Replace heuristic-based `GenderInference.ts` and `DialogueParser.ts` with LLM-powered two-pass speaker detection.

## Clarified Requirements

- **No LLM configured**: Block conversion, show error requiring LLM setup
- **Character review UI**: Inline panel in main UI after Pass 1
- **Retry logic**: Infinite retries with exponential backoff (1s→3s→5s, max 10min between)
- **Voice pool filter**: `ru-*`, `en-*`, and voices with explicit "multilingual" tag
- **Voice assignment**: LLM extracts characters+gender, VoiceAssigner picks actual voice IDs
- **After review**: Auto-continue to Pass 2 + TTS (single "Continue" click)
- **Cancel behavior**: Staged - cancel during Pass 1 discards all; cancel during Pass 2/TTS keeps character data
- **Progress signals**: New LLM-specific signals (`llmCurrentBlock`, `llmTotalBlocks`, etc.)
- **Settings UI**: Separate `LLMSettingsPanel` component mounted in `SettingsPanel`

## Architecture

```
Pass 1 (Sequential):
  Text → Blocks (~16k tokens) → LLM extracts characters → Merge variations → VoiceAssigner assigns voices

[User Review Step - Inline Panel]

Pass 2 (Parallel, 20 concurrent):
  Blocks (~8k tokens) + CharacterMap → LLM assigns speaker per sentence → Validation → JSONL

TTS:
  JSONL → TTSWorkerPool → AudioMerger → Save
```

## Implementation Phases

### Phase 1: State & Types

**File: `src/state/llmState.ts`** (NEW)
```typescript
// Settings (persisted to localStorage)
llmApiKey: signal<string>
llmApiUrl: signal<string>  // default: 'https://api.openai.com/v1'
llmModel: signal<string>   // default: 'gpt-4o-mini'
llmEnabled: signal<boolean>

// Processing status
llmProcessingStatus: signal<'idle' | 'pass1' | 'review' | 'pass2' | 'error'>
llmCurrentBlock: signal<number>
llmTotalBlocks: signal<number>
llmError: signal<string | null>

// Character data (persisted between Pass 1 and Pass 2)
detectedCharacters: signal<Character[]>
characterVoiceMap: signal<Map<string, string>>

// Functions
saveLLMSettings(), loadLLMSettings(), resetLLMState()
```

**File: `src/state/types.ts`** (MODIFY)
```typescript
// Add interfaces
interface Character {
  canonicalName: string;
  variations: string[];
  gender: 'male' | 'female' | 'unknown';
  voiceId?: string;
}

interface TextBlock {
  blockIndex: number;
  sentences: string[];
  sentenceStartIndex: number;
}

interface Pass1Response {
  characters: Character[];
}

interface Pass2Response {
  sentences: { index: number; speaker: string }[];
}

interface SpeakerAssignment {
  sentenceIndex: number;
  text: string;
  speaker: string;
  voiceId: string;
}
```

### Phase 2: Core Services

**File: `src/services/TextBlockSplitter.ts`** (NEW)
```typescript
class TextBlockSplitter {
  splitIntoSentences(text: string): string[];
  splitIntoBlocks(sentences: string[], maxTokens: number): TextBlock[];
  estimateTokens(text: string): number;  // chars / 4
}
```

**File: `src/services/LLMVoiceService.ts`** (NEW)
```typescript
class LLMVoiceService {
  constructor(options: { apiKey, apiUrl, model, narratorVoice })

  // Pass 1: Sequential character extraction
  async extractCharacters(blocks: TextBlock[], onProgress: (current, total) => void): Promise<Character[]>

  // Pass 2: Parallel speaker assignment (20 concurrent)
  async assignSpeakers(blocks: TextBlock[], characterMap: Map<string, string>, onProgress): Promise<SpeakerAssignment[]>

  // Internal
  private async *streamCompletion(messages): AsyncGenerator<string>
  private validatePass1Response(response): ValidationResult
  private validatePass2Response(response, block, characterMap): ValidationResult
  private mergeCharacters(blockResults: Pass1Response[]): Character[]
  private buildPrompt(type: 'pass1' | 'pass2', context): { system: string, user: string }
}
```

**File: `src/services/VoicePoolBuilder.ts`** (MODIFY)
- Add `buildFilteredPool()` that returns only `ru-*`, `en-*`, and `*multilingual*` voices

**File: `src/services/VoiceAssigner.ts`** (MODIFY)
- Add `assignVoicesFromLLMCharacters(characters: Character[]): Map<string, string>`
- Keep existing logic for gender-based voice selection

### Phase 3: UI Components

**File: `src/components/Settings/LLMSettingsPanel.tsx`** (NEW)
- Toggle: Enable LLM mode
- Input: API Key (password field, masked)
- Input: API URL (with default)
- Input: Model name
- Button: Test Connection
- Status indicator

**File: `src/components/CharacterReviewPanel.tsx`** (NEW)
- Shown inline when `llmProcessingStatus === 'review'`
- Table of detected characters:
  - Character name (editable text input)
  - Variations (editable comma-separated or tags)
  - Gender (dropdown: male/female/unknown)
  - Assigned voice (dropdown from filtered voice pool)
- Actions:
  - Merge: Select two characters → combine into one
  - Delete: Remove character (sentences reassigned to narrator)
  - Add: Manually add a character
- "Continue to TTS" button → triggers Pass 2 + TTS

**File: `src/components/Settings/SettingsPanel.tsx`** (MODIFY)
- Import and render `<LLMSettingsPanel />` in a collapsible section

### Phase 4: Integration

**File: `src/services/TextProcessor.ts`** (MODIFY)
- Add `async processWithLLM(llmService: LLMVoiceService): Promise<ProcessedBookWithVoices>`
- This replaces `processWithVoices()` flow when LLM enabled
- Returns after Pass 1 with characters for review

**File: `src/hooks/useTTSConversion.ts`** (MODIFY)
- Check `llmEnabled` signal at start
- If enabled but no API key: show error, block conversion
- New flow:
  1. Create `LLMVoiceService` instance
  2. Run Pass 1 (character extraction)
  3. Set `llmProcessingStatus = 'review'`, wait for user
  4. User edits characters in `CharacterReviewPanel`, clicks Continue
  5. Run Pass 2 (speaker assignment)
  6. Convert to TTS tasks with voice-per-sentence
  7. Run TTSWorkerPool as before

**File: `src/state/appState.ts`** (MODIFY)
- Import and re-export from `llmState.ts`
- Add LLM settings to persistence

### Phase 5: Cleanup

**Delete files:**
- `src/services/GenderInference.ts`
- `src/services/DialogueParser.ts`

**Remove references in:**
- `src/services/TextProcessor.ts`
- Any imports of deleted files

## Prompt Templates

### Pass 1: Character Extraction

```markdown
<role>
You are a character extractor for audiobook production.
</role>

<task>
Extract all speaking characters from the provided text block.
</task>

<rules>
1. Identify every character who speaks dialogue (quoted or indicated by speech marks)
2. Group name variations together (e.g., "Lily", "Lil", "Miss Thompson" = same person)
3. Detect gender: "male", "female", or "unknown"
4. Ignore the narrator - they are not a character
5. Attribution phrases like "said John" indicate John is speaking the preceding dialogue
</rules>

<output_format>
Respond with ONLY valid JSON:
{
  "characters": [
    {
      "canonicalName": "Lily",
      "variations": ["Lily", "Lil", "Miss Thompson"],
      "gender": "female"
    }
  ]
}
</output_format>

<text>
${textBlock}
</text>
```

### Pass 2: Speaker Assignment

```markdown
<role>
You are a dialogue tagger for text-to-speech production.
</role>

<task>
For each numbered sentence, identify who is speaking.
</task>

<rules>
1. Use "narrator" for: descriptions, narrative prose, attribution tags ("she said", "he replied")
2. Use the character's canonical name for: actual spoken dialogue only
3. Every sentence must have exactly one speaker
4. When in doubt, use "narrator"
</rules>

<characters>
${characterList with canonical names}
</characters>

<output_format>
Respond with ONLY valid JSON:
{
  "sentences": [
    {"index": 0, "speaker": "narrator"},
    {"index": 1, "speaker": "Lily"},
    ...
  ]
}
</output_format>

<sentences>
${numberedSentences}
</sentences>
```

## Validation Rules

**Pass 1:**
1. JSON parses correctly
2. Has `characters` array
3. Each character has `canonicalName`, `variations` (array), `gender`
4. `gender` is one of: "male", "female", "unknown"

**Pass 2:**
1. JSON parses correctly
2. `sentences.length === block.sentences.length`
3. All speakers are either "narrator" or exist in character map
4. Indices are sequential starting from block's `sentenceStartIndex`

## Error Handling

- **Validation failure**: Retry with error details in prompt
- **API error**: Exponential backoff (1s, 3s, 5s, ... max 10min), infinite retries
- **User cancel during Pass 1**: Discard all, reset state
- **User cancel during Pass 2/TTS**: Keep character data in state

## Files Summary

| Action | File |
|--------|------|
| CREATE | `src/state/llmState.ts` |
| CREATE | `src/services/TextBlockSplitter.ts` |
| CREATE | `src/services/LLMVoiceService.ts` |
| CREATE | `src/components/Settings/LLMSettingsPanel.tsx` |
| CREATE | `src/components/CharacterReviewPanel.tsx` |
| MODIFY | `src/state/types.ts` |
| MODIFY | `src/state/appState.ts` |
| MODIFY | `src/services/VoicePoolBuilder.ts` |
| MODIFY | `src/services/VoiceAssigner.ts` |
| MODIFY | `src/services/TextProcessor.ts` |
| MODIFY | `src/hooks/useTTSConversion.ts` |
| MODIFY | `src/components/Settings/SettingsPanel.tsx` |
| DELETE | `src/services/GenderInference.ts` |
| DELETE | `src/services/DialogueParser.ts` |

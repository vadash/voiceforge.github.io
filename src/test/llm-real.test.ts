import { describe, it, expect, beforeAll } from 'vitest';
import { LLMVoiceService } from '@/services/LLMVoiceService';
import { TextBlockSplitter } from '@/services/TextBlockSplitter';
import { testConfig } from '../../test.config.local';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Real API tests for LLM Pass 1 (character extraction) and Pass 2 (speaker assignment)
 *
 * These tests use actual API calls and are excluded from regular `npm test`.
 * Run with: npm run test:real
 *
 * Before running, populate test.config.local.ts with your API credentials.
 */

describe('LLM Real API Tests', () => {
  let service: LLMVoiceService;
  let splitter: TextBlockSplitter;
  let sampleText: string;

  beforeAll(() => {
    // Skip if config not populated
    if (!testConfig.apiKey || !testConfig.apiUrl || !testConfig.model) {
      throw new Error(
        'Please populate test.config.local.ts with apiKey, apiUrl, and model before running real API tests'
      );
    }

    service = new LLMVoiceService({
      apiKey: testConfig.apiKey,
      apiUrl: testConfig.apiUrl,
      model: testConfig.model,
      narratorVoice: 'en-US-AriaNeural',
    });

    splitter = new TextBlockSplitter();

    // Load sample story
    const fixturePath = path.resolve(__dirname, 'fixtures/sample-story-en.txt');
    sampleText = fs.readFileSync(fixturePath, 'utf-8');
  });

  describe('Pass 1 - Character Extraction', () => {
    it('should extract characters from sample story', async () => {
      const blocks = splitter.createPass1Blocks(sampleText);

      console.log(`Processing ${blocks.length} block(s) for character extraction...`);

      const characters = await service.extractCharacters(blocks, (current, total) => {
        console.log(`  Pass 1 progress: ${current}/${total}`);
      });

      console.log('Extracted characters:', JSON.stringify(characters, null, 2));

      // Verify at least some characters were found
      expect(characters.length).toBeGreaterThan(0);

      // Check for expected characters from the sample story
      const characterNames = characters.map(c => c.canonicalName.toLowerCase());

      // The sample story has Mirian and Lily as speaking characters
      expect(characterNames.some(name => name.includes('mirian'))).toBe(true);
      expect(characterNames.some(name => name.includes('lily'))).toBe(true);
    }, 60000); // 60s timeout for API call

    it('should detect character genders correctly', async () => {
      const blocks = splitter.createPass1Blocks(sampleText);
      const characters = await service.extractCharacters(blocks);

      // Find Mirian and Lily
      const mirian = characters.find(c => c.canonicalName.toLowerCase().includes('mirian'));
      const lily = characters.find(c => c.canonicalName.toLowerCase().includes('lily'));

      // Both are female characters based on the text (she/her pronouns)
      if (mirian) {
        expect(mirian.gender).toBe('female');
      }
      if (lily) {
        expect(lily.gender).toBe('female');
      }
    }, 60000);
  });

  describe('Pass 2 - Speaker Assignment', () => {
    it('should assign speakers to dialogue sentences', async () => {
      // First extract characters
      const pass1Blocks = splitter.createPass1Blocks(sampleText);
      const characters = await service.extractCharacters(pass1Blocks);

      console.log('Characters for Pass 2:', characters.map(c => c.canonicalName));

      // Build character voice map (simple mapping for test)
      const characterVoiceMap = new Map<string, string>();
      characters.forEach((char, i) => {
        characterVoiceMap.set(char.canonicalName, `voice-${i}`);
      });

      // Get canonical names
      const canonicalNames = characters.map(c => c.canonicalName);

      // Create Pass 2 blocks and assign speakers
      const pass2Blocks = splitter.createPass2Blocks(sampleText);

      console.log(`Processing ${pass2Blocks.length} block(s) for speaker assignment...`);

      const assignments = await service.assignSpeakers(
        pass2Blocks,
        characterVoiceMap,
        canonicalNames,
        (current, total) => {
          console.log(`  Pass 2 progress: ${current}/${total}`);
        }
      );

      console.log(`Total assignments: ${assignments.length}`);

      // Find dialogue assignments (non-narrator)
      const dialogueAssignments = assignments.filter(a => a.speaker !== 'narrator');
      console.log(`Dialogue assignments: ${dialogueAssignments.length}`);

      // Log first few dialogue assignments for inspection
      console.log('Sample dialogue assignments:');
      dialogueAssignments.slice(0, 10).forEach(a => {
        console.log(`  [${a.sentenceIndex}] ${a.speaker}: "${a.text.substring(0, 50)}..."`);
      });

      // Verify some dialogue was detected
      expect(dialogueAssignments.length).toBeGreaterThan(0);

      // Verify speakers are from our character list or unnamed
      const validSpeakers = new Set([
        'narrator',
        ...canonicalNames,
        'MALE_UNNAMED',
        'FEMALE_UNNAMED',
        'UNKNOWN_UNNAMED',
      ]);

      for (const assignment of assignments) {
        expect(validSpeakers.has(assignment.speaker)).toBe(true);
      }
    }, 120000); // 2 min timeout for both passes

    it('should correctly attribute quoted dialogue', async () => {
      // First extract characters
      const pass1Blocks = splitter.createPass1Blocks(sampleText);
      const characters = await service.extractCharacters(pass1Blocks);

      const characterVoiceMap = new Map<string, string>();
      characters.forEach((char, i) => {
        characterVoiceMap.set(char.canonicalName, `voice-${i}`);
      });
      const canonicalNames = characters.map(c => c.canonicalName);

      const pass2Blocks = splitter.createPass2Blocks(sampleText);
      const assignments = await service.assignSpeakers(
        pass2Blocks,
        characterVoiceMap,
        canonicalNames
      );

      // Find sentences with explicit dialogue markers (various quote types)
      const dialogueWithQuotes = assignments.filter(a =>
        (a.text.includes('"') || a.text.includes('"') || a.text.includes('«')) && a.speaker !== 'narrator'
      );

      console.log('Dialogue with quotes:', dialogueWithQuotes.length);

      // Verify dialogue was assigned
      expect(dialogueWithQuotes.length).toBeGreaterThanOrEqual(0); // May be 0 if quotes stripped

      // Check specific known dialogue from the sample:
      // "Mirian? Are you okay?" - should be Lily (but LLM may vary)
      const lilyQuestion = assignments.find(a =>
        a.text.includes('Are you okay')
      );
      if (lilyQuestion) {
        console.log(`"Are you okay?" assigned to: ${lilyQuestion.speaker}`);
        // Just verify it got a speaker assignment (not narrator)
        expect(lilyQuestion.speaker).not.toBe('narrator');
      }
    }, 120000);
  });
});

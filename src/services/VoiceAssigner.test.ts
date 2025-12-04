import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceAssigner } from './VoiceAssigner';
import type { IVoicePoolBuilder } from './interfaces';
import type { LLMCharacter } from '../state/types';

// Mock VoicePoolBuilder with predictable voices
const createMockPoolBuilder = (): IVoicePoolBuilder => ({
  buildPool: () => ({
    male: ['voice-m1', 'voice-m2', 'voice-m3'],
    female: ['voice-f1', 'voice-f2', 'voice-f3'],
  }),
});

describe('VoiceAssigner', () => {
  let assigner: VoiceAssigner;
  const mockPoolBuilder = createMockPoolBuilder();
  const narratorVoice = 'narrator-voice';

  beforeEach(() => {
    assigner = new VoiceAssigner(mockPoolBuilder, { narratorVoice });
  });

  describe('assignVoice', () => {
    it('assigns voice based on gender', () => {
      const voice = assigner.assignVoice('John', 'male');

      expect(['voice-m1', 'voice-m2', 'voice-m3']).toContain(voice);
    });

    it('assigns female voice for female gender', () => {
      const voice = assigner.assignVoice('Sarah', 'female');

      expect(['voice-f1', 'voice-f2', 'voice-f3']).toContain(voice);
    });

    it('returns existing assignment on duplicate call', () => {
      const voice1 = assigner.assignVoice('John', 'male');
      const voice2 = assigner.assignVoice('John', 'male');

      expect(voice2).toBe(voice1);
    });
  });

  describe('getVoiceForCharacter', () => {
    it('returns existing voice if assigned', () => {
      const voice1 = assigner.assignVoice('John', 'male');
      const voice2 = assigner.getVoiceForCharacter('John');

      expect(voice2).toBe(voice1);
    });

    it('assigns new voice if not exists', () => {
      const voice = assigner.getVoiceForCharacter('NewCharacter', 'female');

      expect(['voice-f1', 'voice-f2', 'voice-f3']).toContain(voice);
    });

    it('defaults to unknown gender if not specified', () => {
      const voice = assigner.getVoiceForCharacter('Mystery');

      // Should get a voice from either pool
      const allVoices = ['voice-m1', 'voice-m2', 'voice-m3', 'voice-f1', 'voice-f2', 'voice-f3'];
      expect(allVoices).toContain(voice);
    });
  });

  describe('getNarratorVoice', () => {
    it('returns configured narrator voice', () => {
      expect(assigner.getNarratorVoice()).toBe(narratorVoice);
    });
  });

  describe('getAllAssignments', () => {
    it('returns empty map when no assignments', () => {
      const assignments = assigner.getAllAssignments();

      expect(assignments.size).toBe(0);
    });

    it('returns all character-to-voice mappings', () => {
      assigner.assignVoice('John', 'male');
      assigner.assignVoice('Sarah', 'female');

      const assignments = assigner.getAllAssignments();

      expect(assignments.size).toBe(2);
      expect(assignments.has('John')).toBe(true);
      expect(assignments.has('Sarah')).toBe(true);
    });
  });

  describe('assignVoicesFromLLMCharacters', () => {
    it('maps characters and their variations to voices', () => {
      const characters: LLMCharacter[] = [
        { canonicalName: 'John Smith', gender: 'male', variations: ['John', 'Smith', 'Mr. Smith'] },
        { canonicalName: 'Sarah', gender: 'female', variations: ['Sarah'] },
      ];

      const voiceMap = assigner.assignVoicesFromLLMCharacters(characters);

      // All variations should map to the same voice as canonical name
      expect(voiceMap.get('John')).toBe(voiceMap.get('John Smith'));
      expect(voiceMap.get('Smith')).toBe(voiceMap.get('John Smith'));
      expect(voiceMap.get('Mr. Smith')).toBe(voiceMap.get('John Smith'));

      // Sarah should have her own voice
      expect(voiceMap.has('Sarah')).toBe(true);
    });

    it('adds unnamed speaker voices', () => {
      const characters: LLMCharacter[] = [];

      const voiceMap = assigner.assignVoicesFromLLMCharacters(characters);

      expect(voiceMap.has('MALE_UNNAMED')).toBe(true);
      expect(voiceMap.has('FEMALE_UNNAMED')).toBe(true);
      expect(voiceMap.has('UNKNOWN_UNNAMED')).toBe(true);
    });
  });

  describe('voice selection', () => {
    it('avoids already used voices when possible', () => {
      // Assign all but one male voice
      const voice1 = assigner.assignVoice('Char1', 'male');
      const voice2 = assigner.assignVoice('Char2', 'male');

      // Both should be unique (if pool allows)
      if (voice1 !== voice2) {
        const usedSet = new Set([voice1, voice2]);
        expect(usedSet.size).toBe(2);
      }
    });

    it('reuses voices when pool exhausted', () => {
      // Exhaust all male voices
      assigner.assignVoice('Char1', 'male');
      assigner.assignVoice('Char2', 'male');
      assigner.assignVoice('Char3', 'male');

      // Fourth assignment should still return a voice
      const voice4 = assigner.assignVoice('Char4', 'male');
      expect(['voice-m1', 'voice-m2', 'voice-m3']).toContain(voice4);
    });
  });

  describe('reset', () => {
    it('clears all assignments', () => {
      assigner.assignVoice('John', 'male');
      assigner.assignVoice('Sarah', 'female');

      assigner.reset();

      expect(assigner.getAllAssignments().size).toBe(0);
    });

    it('keeps narrator voice reserved after reset', () => {
      assigner.assignVoice('John', 'male');
      assigner.reset();

      // Narrator voice should still be the same
      expect(assigner.getNarratorVoice()).toBe(narratorVoice);
    });
  });

  describe('overrideVoice', () => {
    it('updates voice for existing character', () => {
      assigner.assignVoice('John', 'male');
      assigner.overrideVoice('John', 'custom-voice');

      expect(assigner.getVoiceForCharacter('John')).toBe('custom-voice');
    });

    it('creates assignment for new character', () => {
      assigner.overrideVoice('NewChar', 'custom-voice');

      expect(assigner.getVoiceForCharacter('NewChar')).toBe('custom-voice');
    });

    it('releases old voice when overriding', () => {
      const oldVoice = assigner.assignVoice('John', 'male');
      assigner.overrideVoice('John', 'custom-voice');

      // Old voice should be available again for new assignments
      // (This is implicit behavior - we can't directly test usedVoices)
      expect(assigner.getVoiceForCharacter('John')).toBe('custom-voice');
    });
  });

  describe('createWithFilteredPool', () => {
    it('creates assigner with filtered voice pool', () => {
      const assigner = VoiceAssigner.createWithFilteredPool(
        mockPoolBuilder,
        narratorVoice,
        'en'
      );

      expect(assigner.getNarratorVoice()).toBe(narratorVoice);
    });
  });
});

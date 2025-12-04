import { describe, it, expect } from 'vitest';
import {
  VoicePoolBuilder,
  buildVoicePool,
  buildFilteredPool,
  getFilteredVoices,
  getMaleVoices,
  getFemaleVoices,
  getRandomVoice,
} from './VoicePoolBuilder';

describe('VoicePoolBuilder', () => {
  describe('VoicePoolBuilder class', () => {
    it('builds pool for locale with multilingual voices', () => {
      const builder = new VoicePoolBuilder();
      const pool = builder.buildPool('en');

      expect(pool.male.length).toBeGreaterThan(0);
      expect(pool.female.length).toBeGreaterThan(0);
      // Should include English voices or multilingual voices
      const hasEnglishOrMultilingual = pool.male.some(
        v => v.startsWith('en') || v.includes('Multilingual')
      );
      expect(hasEnglishOrMultilingual).toBe(true);
    });
  });

  describe('buildVoicePool', () => {
    it('filters by locale prefix', () => {
      const pool = buildVoicePool('en');

      expect(pool.male.length).toBeGreaterThan(0);
      expect(pool.female.length).toBeGreaterThan(0);
      pool.male.forEach(v => expect(v.startsWith('en')).toBe(true));
      pool.female.forEach(v => expect(v.startsWith('en')).toBe(true));
    });

    it('separates male and female voices', () => {
      const pool = buildVoicePool('en');

      // All voices in male pool should be unique
      const uniqueMale = new Set(pool.male);
      expect(uniqueMale.size).toBe(pool.male.length);

      // All voices in female pool should be unique
      const uniqueFemale = new Set(pool.female);
      expect(uniqueFemale.size).toBe(pool.female.length);

      // No overlap between male and female
      const maleSet = new Set(pool.male);
      pool.female.forEach(v => expect(maleSet.has(v)).toBe(false));
    });

    it('returns all voices when no locale specified', () => {
      const pool = buildVoicePool();
      const totalVoices = pool.male.length + pool.female.length;

      expect(totalVoices).toBeGreaterThan(0);
    });

    it('returns empty pools for non-existent locale', () => {
      const pool = buildVoicePool('xx');

      expect(pool.male).toHaveLength(0);
      expect(pool.female).toHaveLength(0);
    });
  });

  describe('buildFilteredPool', () => {
    it('includes multilingual voices', () => {
      const pool = buildFilteredPool('ru');

      // Should include Russian voices
      const hasRussian = [...pool.male, ...pool.female].some(v => v.startsWith('ru'));
      expect(hasRussian).toBe(true);

      // Should also include multilingual voices
      const hasMultilingual = [...pool.male, ...pool.female].some(v =>
        v.includes('Multilingual')
      );
      expect(hasMultilingual).toBe(true);
    });

    it('defaults to English when no language specified', () => {
      const pool = buildFilteredPool();

      const hasEnglish = [...pool.male, ...pool.female].some(v => v.startsWith('en'));
      expect(hasEnglish).toBe(true);
    });
  });

  describe('getFilteredVoices', () => {
    it('returns combined male and female voices', () => {
      const voices = getFilteredVoices('en');
      const pool = buildFilteredPool('en');

      expect(voices.length).toBe(pool.male.length + pool.female.length);
    });
  });

  describe('getMaleVoices', () => {
    it('returns only male voices', () => {
      const voices = getMaleVoices('en');

      expect(voices.length).toBeGreaterThan(0);
      voices.forEach(v => expect(v.startsWith('en')).toBe(true));
    });
  });

  describe('getFemaleVoices', () => {
    it('returns only female voices', () => {
      const voices = getFemaleVoices('en');

      expect(voices.length).toBeGreaterThan(0);
      voices.forEach(v => expect(v.startsWith('en')).toBe(true));
    });
  });

  describe('getRandomVoice', () => {
    it('returns male voice for male gender', () => {
      const voice = getRandomVoice('male', 'en');
      const maleVoices = getMaleVoices('en');

      expect(maleVoices).toContain(voice);
    });

    it('returns female voice for female gender', () => {
      const voice = getRandomVoice('female', 'en');
      const femaleVoices = getFemaleVoices('en');

      expect(femaleVoices).toContain(voice);
    });

    it('returns any voice for unknown gender', () => {
      const voice = getRandomVoice('unknown', 'en');
      const allVoices = [...getMaleVoices('en'), ...getFemaleVoices('en')];

      expect(allVoices).toContain(voice);
    });

    it('respects exclusion set', () => {
      const maleVoices = getMaleVoices('en');
      const excluded = new Set(maleVoices.slice(0, maleVoices.length - 1));

      const voice = getRandomVoice('male', 'en', excluded);

      expect(excluded.has(voice)).toBe(false);
    });

    it('falls back to full pool when all voices excluded', () => {
      const maleVoices = getMaleVoices('en');
      const excluded = new Set(maleVoices);

      // Should still return a voice from the pool
      const voice = getRandomVoice('male', 'en', excluded);
      expect(maleVoices).toContain(voice);
    });
  });
});

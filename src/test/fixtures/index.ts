import type { LLMCharacter } from "@/state/types";

/**
 * Test fixture definitions for LLM prompt tuning
 */

export interface ExpectedCharacter {
  name: string; // partial match (case-insensitive)
  gender: "male" | "female" | "unknown";
}

export interface ExpectedDialogue {
  textContains: string; // sentence must contain this text
  speaker: string; // expected speaker name - matches canonicalName or any variation (case-insensitive)
  strict?: boolean; // if true, fail test on mismatch; if false, just log warning
}

export interface TestFixture {
  name: string;
  file: string; // relative to fixtures/ directory
  expectedCharacters: ExpectedCharacter[];
  expectedDialogueLines: ExpectedDialogue[];
}

/**
 * Test fixtures - add new test cases here
 */
export const fixtures: TestFixture[] = [
  {
    name: "English Dorm Scene",
    file: "sample-story-en.txt",
    expectedCharacters: [
      { name: "Mirian", gender: "female" },
      { name: "Lily", gender: "female" },
    ],
    expectedDialogueLines: [
      { textContains: "Are you okay?", speaker: "Lily", strict: true },
      {
        textContains: "nightmare or something",
        speaker: "Mirian",
        strict: true,
      },
      {
        textContains: "Lily said, eyes actually open",
        speaker: "Lily",
        strict: true,
      }, // "What's up?" line
      { textContains: "Mirian said", speaker: "Mirian", strict: true }, // "There's a hole" line
      { textContains: "Oh, great", speaker: "Lily", strict: true },
      { textContains: "No idea", speaker: "Mirian", strict: true },
      { textContains: "enchantments exam", speaker: "Lily", strict: true },
      {
        textContains: "put her head in her hands",
        speaker: "narrator",
        strict: true,
      },
    ],
  },
  {
    name: "Russian Brothers Dialogue",
    file: "sample-story-ru.txt",
    expectedCharacters: [
      { name: "Мартин", gender: "male" },
      { name: "Женька", gender: "male" }, // proper name preferred over "брат"
    ],
    expectedDialogueLines: [
      {
        textContains: "чем ты сейчас занимаешься",
        speaker: "Женька",
        strict: true,
      },
      { textContains: "Всякой фигней", speaker: "Мартин", strict: true },
      {
        textContains: "Ты ведешь какое-то серьезное",
        speaker: "Женька",
        strict: true,
      },
      { textContains: "Заканчиваю", speaker: "Мартин", strict: true },
      { textContains: "А что осталось", speaker: "Женька", strict: true },
      { textContains: "Девочка кое-что", speaker: "Мартин", strict: true },
      { textContains: "Меня расспрашивали", speaker: "Женька", strict: true },
      { textContains: "Мент?", speaker: "Мартин", strict: true },
      { textContains: "Госбезопасность", speaker: "Женька", strict: true },
      {
        textContains: "Да что им от меня надо",
        speaker: "Мартин",
        strict: true,
      },
      { textContains: "Вот уж не знаю", speaker: "Женька", strict: true },
    ],
  },
  {
    name: "English Ship Dialog",
    file: "sample-dialog-en.txt",
    expectedCharacters: [
      { name: "Fielding", gender: "male" },
      { name: "Tennyson", gender: "male" },
      { name: "Conrad", gender: "male" },
    ],
    expectedDialogueLines: [
      { textContains: "I'm so sorry", speaker: "Tennyson", strict: true },
      { textContains: "I'll get them", speaker: "Fielding", strict: true },
      {
        textContains: "Leave it to the authorities",
        speaker: "Tennyson",
        strict: true,
      },
      {
        textContains: "no bloody authorities",
        speaker: "Fielding",
        strict: true,
      },
      { textContains: "private estate", speaker: "Tennyson", strict: true },
      { textContains: "On the coast", speaker: "Fielding", strict: true },
      { textContains: "gone back in time", speaker: "Fielding", strict: true },
      {
        textContains: "Can you email that to me",
        speaker: "narrator",
        strict: true,
      },
      { textContains: "Sure", speaker: "Conrad", strict: true },
      { textContains: "I'm going, Dave", speaker: "Fielding", strict: true },
      {
        textContains: "I can't condone murder",
        speaker: "Tennyson",
        strict: true,
      },
    ],
  },
];

/**
 * Helper to find a character by name (case-insensitive partial match)
 * Checks both canonicalName and all variations
 */
export function findCharacter(
  characters: LLMCharacter[],
  name: string
): LLMCharacter | undefined {
  const lowerName = name.toLowerCase();
  return characters.find(
    (c) =>
      c.canonicalName.toLowerCase().includes(lowerName) ||
      c.variations.some((v) => v.toLowerCase().includes(lowerName))
  );
}

/**
 * Helper to check if a character exists in the list
 */
export function hasCharacter(
  characters: LLMCharacter[],
  name: string
): boolean {
  return findCharacter(characters, name) !== undefined;
}

/**
 * Check if a speaker name matches a character (by canonicalName or any variation)
 * Returns true if the speaker matches the expected name considering all aliases
 */
export function speakerMatchesCharacter(
  speaker: string,
  expectedName: string,
  characters: LLMCharacter[]
): boolean {
  const speakerLower = speaker.toLowerCase();
  const expectedLower = expectedName.toLowerCase();

  // Direct match (narrator or simple case)
  if (
    speakerLower === expectedLower ||
    speakerLower.includes(expectedLower) ||
    expectedLower.includes(speakerLower)
  ) {
    return true;
  }

  // Find the character that expectedName refers to
  const expectedChar = findCharacter(characters, expectedName);
  if (!expectedChar) {
    return false;
  }

  // Check if speaker matches any of the character's names
  const allNames = [expectedChar.canonicalName, ...expectedChar.variations];
  return allNames.some((name) => {
    const nameLower = name.toLowerCase();
    return (
      speakerLower === nameLower ||
      speakerLower.includes(nameLower) ||
      nameLower.includes(speakerLower)
    );
  });
}

/**
 * Find which character a speaker refers to (resolves aliases to canonical character)
 */
export function resolveCharacterFromSpeaker(
  speaker: string,
  characters: LLMCharacter[]
): LLMCharacter | undefined {
  const speakerLower = speaker.toLowerCase();

  return characters.find((c) => {
    const allNames = [c.canonicalName, ...c.variations];
    return allNames.some((name) => {
      const nameLower = name.toLowerCase();
      return (
        speakerLower === nameLower ||
        speakerLower.includes(nameLower) ||
        nameLower.includes(speakerLower)
      );
    });
  });
}

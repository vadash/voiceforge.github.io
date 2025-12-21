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
    name: "sample_1_en_simple",
    file: "sample_1_en_simple.txt",
    expectedCharacters: [
      { name: "Mirian", gender: "female" },
      { name: "Lily", gender: "female" },
    ],
    expectedDialogueLines: [
      { textContains: "Mirian? Are you okay", speaker: "Lily", strict: false },
      { textContains: "nightmare or something", speaker: "Mirian", strict: false },
      { textContains: "What’s up", speaker: "Lily", strict: false },
      { textContains: "There’s a hole", speaker: "Mirian", strict: false },
      { textContains: "Oh, great", speaker: "Lily", strict: false },
      { textContains: "No idea", speaker: "Mirian", strict: false },
      { textContains: "Don’t you have an enchantments exam", speaker: "Lily", strict: false },
      { textContains: "Yes", speaker: "Mirian", strict: false },
    ],
  },
  {
    name: 'sample_2_ru_hard',
    file: 'sample_2_ru_hard.txt',
    expectedCharacters: [
      { name: 'Звягин', gender: 'male' },
      { name: 'Епишко', gender: 'male' },
    ],
    expectedDialogueLines: [
      // Scene 13: Lottery & New Job
      { textContains: 'Чего рожа кислая?', speaker: 'Звягин', strict: false },
      { textContains: 'Проверял… это старый', speaker: 'Епишко', strict: true },
      { textContains: 'Впервые в жизни', speaker: 'Епишко', strict: true },
      { textContains: 'Ты никогда ничего не теряешь', speaker: 'Жена', strict: false },
      { textContains: 'Я его постирал', speaker: 'Епишко', strict: true },
      { textContains: 'Откуда деньги-то?', speaker: 'Епишко', strict: true },
      { textContains: 'А почему не заработаешь?', speaker: 'Звягин', strict: true },
      { textContains: 'Прирабатываю', speaker: 'Епишко', strict: true },

      // Scene 14: The Forest
      { textContains: 'Нож? Спички? Компас? Пошли…', speaker: 'Звягин', strict: true },
      { textContains: 'Э-ге-геээ!', speaker: 'Епишко', strict: true },
      { textContains: 'Умница, мальчик', speaker: 'Епишко', strict: true },
      { textContains: 'Я зде-еесь!', speaker: 'Епишко', strict: true },
      { textContains: 'Ты где был-то? Я уж тут и сам почти заблудился', speaker: 'Звягин', strict: true },
      { textContains: 'Сучком поцарапал', speaker: 'Епишко', strict: true },
      { textContains: 'Смеяться не надо', speaker: 'Епишко', strict: true },
      { textContains: 'У вас легкая рука', speaker: 'Епишко', strict: true },

      // Scene 15: Final Outcome
      { textContains: 'Хочу лично посоветоваться', speaker: 'Епишко', strict: true },
      { textContains: 'Да я уж начал подыскивать', speaker: 'Епишко', strict: true },
      { textContains: 'Оденешься как следует', speaker: 'Звягин', strict: true },
      { textContains: 'Зачем ты ему проиграл?', speaker: 'Дочь', strict: false },
      { textContains: 'Кто я?', speaker: 'Звягин', strict: true },
      { textContains: 'Врач', speaker: 'Дочь', strict: false },
      { textContains: 'Стоит ли вкалывать', speaker: 'Звягин', strict: true },
      { textContains: 'Ты у меня ужасный хвастун', speaker: 'Дочь', strict: false },
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

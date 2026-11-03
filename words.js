import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Default english word list (200 most common words):
// https://github.com/monkeytypegame/monkeytype/blob/master/frontend/static/languages/english.json
export const WORDS = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'words/english.json'), 'utf8')
).words;

const WORD_REGEN_LIMIT = 100;

export function pickRandomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

// Mirror getNextWord filters for standard english word mode:
// - don't repeat the previous two words
// - skip capital "I" when punctuation is off
// - skip words containing punctuation/numbers
export function shouldRegenerateWord(word, previousWord, previousWord2) {
  const normalized = word.toLowerCase();
  return (
    previousWord === normalized ||
    previousWord2 === normalized ||
    word === 'I' ||
    /[-=_+[\]{};'\\:"|,./<>?]/i.test(word) ||
    /[0-9]/.test(word)
  );
}

export function nextEligibleWord(previousWords = []) {
  const previousWord = previousWords[previousWords.length - 1]?.toLowerCase();
  const previousWord2 = previousWords[previousWords.length - 2]?.toLowerCase();
  let word = pickRandomWord();
  let regenerationCount = 0;

  while (
    regenerationCount < WORD_REGEN_LIMIT &&
    shouldRegenerateWord(word, previousWord, previousWord2)
  ) {
    regenerationCount++;
    word = pickRandomWord();
  }

  return word;
}

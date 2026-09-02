import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { stdin, stdout } from 'process';

// Default english word list (200 most common words):
// https://github.com/monkeytypegame/monkeytype/blob/master/frontend/static/languages/english.json
const WORDS = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'words/english.json'), 'utf8')
).words;

const WORD_MODE_LENGTH = 14; // number of words per round
const WORD_REGEN_LIMIT = 100; // infinite-loop guard

// Visible character for space so mistakes on spaces are visible
const SPACE_MARKER = '_';

const TITLE_ART = [
  '  _   _      _ ____  ',
  ' | |_| |_   | / ___| ',
  ' | __| __|  | \\___ \\ ',
  ' | |_| |_ |_| |___) |',
  '  \\__|\\__|(___|____/ ',
];

class TypingTest {
  constructor() {
    this.sentence = '';
    this.userInput = '';
    this.startTime = null;
    this.endTime = null;
    this.inputHandler = null; // Store the handler so we can remove it
    this.isWaitingForRestart = false;
  }

  // Uniform random pick, (non-zipf)
  pickRandomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  // Mirror getNextWord filters for standard english word mode:
  // - don't repeat the previous two words
  // - skip capital "I" when punctuation is off
  // - skip words containing punctuation/numbers
  shouldRegenerateWord(word, previousWord, previousWord2) {
    const normalized = word.toLowerCase();
    return (
      previousWord === normalized ||
      previousWord2 === normalized ||
      word === 'I' ||
      /[-=_+[\]{};'\\:"|,./<>?]/i.test(word) ||
      /[0-9]/.test(word)
    );
  }

  // Get a random sequence of words using selection rules
  getRandomWordsString() {
    const words = [];

    for (let i = 0; i < WORD_MODE_LENGTH; i++) {
      let word = this.pickRandomWord();
      const previousWord = words[i - 1]?.toLowerCase();
      const previousWord2 = words[i - 2]?.toLowerCase();
      let regenerationCount = 0;

      while (
        regenerationCount < WORD_REGEN_LIMIT &&
        this.shouldRegenerateWord(word, previousWord, previousWord2)
      ) {
        regenerationCount++;
        word = this.pickRandomWord();
      }

      words.push(word);
    }

    return words.join(' ');
  }

  // Set the current target text
  setTargetText() {
    this.sentence = this.getRandomWordsString();
  }

  // Center a line in the terminal
  centerLine(text) {
    const width = stdout.columns || 80;
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
  }

  // Title / landing screen
  showLandingPage() {
    this.clearScreen();

    const prompt = 'Press Enter to start typing';
    const rows = stdout.rows || 24;
    const topPad = Math.max(1, Math.floor((rows - TITLE_ART.length - 4) / 3));

    stdout.write('\n'.repeat(topPad));
    for (const line of TITLE_ART) {
      console.log(`\x1b[36m${this.centerLine(line)}\x1b[0m`);
    }
    console.log();
    console.log(`\x1b[2m${this.centerLine(prompt)}\x1b[0m`);
  }

  // Wait on the landing page until the user presses Enter
  waitForLandingEnter() {
    this.showLandingPage();

    return new Promise((resolve) => {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      const onData = (char) => {
        if (char === '\u0003' || char === '\u001b') { // Ctrl+C or ESC
          stdin.removeListener('data', onData);
          this.cleanup();
          process.exit(0);
        }
        if (char === '\r' || char === '\n') {
          stdin.removeListener('data', onData);
          resolve();
        }
      };

      stdin.on('data', onData);
    });
  }

  // Clear the terminal
  clearScreen() {
    stdout.write('\x1B[2J\x1B[0f');
  }

  // Display the current state
  displayProgress() {
    this.clearScreen();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              TYPING TEST - Type the text below             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Text to type:');
    console.log('─────────────────────────────────────────────────────────────\n');

    // Display the sentence with color coding and cursor
    let display = '';
    const cursorPos = this.userInput.length;

    for (let i = 0; i < this.sentence.length; i++) {
      const char = this.sentence[i];
      const isWrong = i < this.userInput.length && this.userInput[i] !== char;
      // Only show space marker when user mistyped a space (expected space, typed something else)
      const displayChar = char === ' ' && isWrong ? SPACE_MARKER : char;

      // Highlight the character at cursor position with reverse video
      if (i === cursorPos) {
        if (i < this.userInput.length) {
          if (this.userInput[i] === char) {
            // Correct character - green with reverse video for cursor
            display += `\x1b[7m\x1b[32m${char}\x1b[0m`;
          } else {
            // Incorrect character - red with reverse video for cursor
            display += `\x1b[7m\x1b[31m${displayChar}\x1b[0m`;
          }
        } else {
          // Not yet typed - gray with reverse video for cursor
          display += `\x1b[7m\x1b[90m${char}\x1b[0m`;
        }
      } else {
        // Normal display for non-cursor characters
        if (i < this.userInput.length) {
          if (this.userInput[i] === char) {
            // Correct character - green
            display += `\x1b[32m${char}\x1b[0m`;
          } else {
            // Incorrect character - red (show _ only when expected was space)
            display += `\x1b[31m${displayChar}\x1b[0m`;
          }
        } else {
          // Not yet typed - white/gray
          display += `\x1b[90m${char}\x1b[0m`;
        }
      }
    }

    // Show cursor at the end if all characters are typed (highlight a space)
    if (cursorPos >= this.sentence.length) {
      display += `\x1b[7m \x1b[0m`; // Reverse video space for cursor
    }

    console.log(display);
    console.log('\n─────────────────────────────────────────────────────────────\n');

    // Show current input
    if (this.userInput.length > 0) {
      console.log(`Your input: ${this.userInput}`);
    }

    // Show progress
    const correctChars = this.getCorrectCharacters();
    const accuracy = this.userInput.length > 0 
      ? ((correctChars / this.userInput.length) * 100).toFixed(1)
      : 0;

    console.log(`\nProgress: ${this.userInput.length}/${this.sentence.length} characters`);
    console.log(`Accuracy: ${accuracy}%`);

    // Show elapsed time if started
    if (this.startTime) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      console.log(`Time: ${elapsed.toFixed(1)}s`);
    }

    console.log('\n─────────────────────────────────────────────────────────────');
    console.log('Press ESC to quit, Backspace to delete, Enter when finished\n');
  }

  // Count correct characters
  getCorrectCharacters() {
    let count = 0;
    const minLength = Math.min(this.userInput.length, this.sentence.length);
    for (let i = 0; i < minLength; i++) {
      if (this.userInput[i] === this.sentence[i]) {
        count++;
      }
    }
    return count;
  }

  // Build word ranges from the target sentence
  getWordRanges() {
    const ranges = [];
    let wordStart = 0;

    for (let i = 0; i < this.sentence.length; i++) {
      if (this.sentence[i] === ' ') {
        if (i > wordStart) {
          ranges.push({ start: wordStart, end: i - 1 });
        }
        wordStart = i + 1;
      }
    }

    if (wordStart < this.sentence.length) {
      ranges.push({ start: wordStart, end: this.sentence.length - 1 });
    }

    return ranges;
  }

  // Determine how far back the user is allowed to backspace
  getLockedPrefixLength() {
    const wordRanges = this.getWordRanges();
    let lockedPrefixLength = 0;

    for (let i = 0; i < wordRanges.length; i++) {
      const { start, end } = wordRanges[i];
      const isWordComplete = this.userInput.length >= end + 1;
      if (!isWordComplete) {
        break;
      }

      const expectedWord = this.sentence.slice(start, end + 1);
      const typedWord = this.userInput.slice(start, end + 1);

      if (typedWord === expectedWord) {
        // Lock completed words only while they remain fully correct.
        lockedPrefixLength = end + 1;
      } else {
        // If a completed word is incorrect, allow backspacing into it.
        break;
      }
    }

    return lockedPrefixLength;
  }

  // (correct characters / 5) / minutes
  calculateWPM() {
    if (!this.startTime || !this.endTime) return 0;

    const timeInMinutes = (this.endTime - this.startTime) / 1000 / 60;
    if (timeInMinutes <= 0) return 0;

    const correctChars = this.getCorrectCharacters();
    const wpm = (correctChars / 5) / timeInMinutes;

    return Math.round(wpm);
  }

  // Calculate accuracy
  calculateAccuracy() {
    if (this.userInput.length === 0) return 0;
    const correctChars = this.getCorrectCharacters();
    return (correctChars / this.userInput.length) * 100;
  }

  // Show results
  showResults() {
    this.clearScreen();

    const timeInSeconds = (this.endTime - this.startTime) / 1000;
    const wpm = this.calculateWPM();
    const accuracy = this.calculateAccuracy();
    const correctChars = this.getCorrectCharacters();
    const totalChars = this.userInput.length;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      TYPING TEST RESULTS                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Time: ${timeInSeconds.toFixed(2)} seconds`);
    console.log(`Speed: ${wpm} WPM (Words Per Minute)`);
    console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`Characters: ${correctChars}/${totalChars} correct\n`);

    // Show comparison
    console.log('Original text:');
    console.log(`  ${this.sentence}\n`);
    console.log('Your input:');
    console.log(`  ${this.userInput}\n`);

    console.log('─────────────────────────────────────────────────────────────\n');
    console.log("Press Enter to play again, or 'q' to exit\n");
  }

  // Handle character input
  handleInput(char) {
    // Results screen: ignore accidental keypresses unless Enter / q
    if (this.isWaitingForRestart) {
      if (char === '\r' || char === '\n') { // Detect Enter
        this.beginRound();
      } else if (char && char.toLowerCase() === 'q') {
        this.cleanup();
        process.exit(0);
      }
      return;
    }

    // Start timer on first character
    if (this.userInput.length === 0 && !this.startTime) {
      this.startTime = Date.now();
    }

    // Handle special keys
    if (char === '\u001b') { // ESC
      this.cleanup();
      process.exit(0);
    } else if (char === '\u007f' || char === '\b') { // Backspace
      if (this.userInput.length > this.getLockedPrefixLength()) {
        this.userInput = this.userInput.slice(0, -1);
      }
    } else if (char === '\r' || char === '\n') { // Enter
      this.endTime = Date.now();
      this.showResults();
      this.isWaitingForRestart = true;
      return;
    } else if (char >= ' ' && char <= '~') { // Printable characters
      this.userInput += char;

      // Auto-complete check - if user typed all characters correctly
      if (this.userInput.length === this.sentence.length) {
        this.endTime = Date.now();
        this.showResults();
        this.isWaitingForRestart = true;
        return;
      }
    }

    this.displayProgress();
  }

  // Remove event listeners
  removeInputHandler() {
    if (this.inputHandler) {
      stdin.removeListener('data', this.inputHandler);
      this.inputHandler = null;
    }
  }

  // Reset the test
  reset() {
    this.setTargetText();
    this.userInput = '';
    this.startTime = null;
    this.endTime = null;
    this.isWaitingForRestart = false;
  }

  // Cleanup
  cleanup() {
    this.removeInputHandler();
    stdin.setRawMode(false);
    stdin.pause();
  }

  // Start a typing round (skips the landing page)
  beginRound() {
    this.removeInputHandler();
    this.reset();

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    this.displayProgress();

    this.inputHandler = (char) => {
      this.handleInput(char);
    };

    stdin.on('data', this.inputHandler);
  }

  // Start the application from the landing page
  async start() {
    stdin.once('SIGINT', () => {
      this.cleanup();
      console.log('\n\nGoodbye!');
      process.exit(0);
    });

    await this.waitForLandingEnter();
    this.beginRound();
  }
}

// Start the application
const test = new TypingTest();
test.start();

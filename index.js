import readline from 'readline';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { stdin, stdout } from 'process';

// Sample sentences for typing test
const SENTENCES = [
  "The quick brown fox jumps over the lazy dog.",
  "Programming is the art of telling another human being what one wants the computer to do.",
  "The best way to get a project done faster is to start sooner.",
  "Code is like humor. When you have to explain it, it's bad.",
  "First, solve the problem. Then, write the code.",
  "Experience is the name everyone gives to their mistakes.",
  "In order to be irreplaceable, one must always be different.",
  "Java is to JavaScript what car is to carpet.",
  "Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code.",
  "Perfection is achieved not when there is nothing more to add, but rather when there is nothing more to take away."
];

// Default english word list (200 most common words):
// https://github.com/monkeytypegame/monkeytype/blob/master/frontend/static/languages/english.json
const WORDS = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'words/english.json'), 'utf8')
).words;

const WORD_MODE_LENGTH = 14; // number of words per round in word mode
const WORD_REGEN_LIMIT = 100; // infinite-loop guard

// Visible character for space so mistakes on spaces are visible
const SPACE_MARKER = '_';

class TypingTest {
  constructor() {
    this.sentence = '';
    this.userInput = '';
    this.startTime = null;
    this.endTime = null;
    this.rl = null;
    this.inputHandler = null; // Store the handler so we can remove it
    this.isWaitingForRestart = false;
    this.mode = null; // 'sentence' | 'words'
  }

  // Get a random sentence
  getRandomSentence() {
    return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
  }

  // Uniform random pick, (non-zipf) mode
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

  // Set the current target text based on mode
  setTargetText() {
    if (this.mode === 'words') {
      this.sentence = this.getRandomWordsString();
    } else {
      this.sentence = this.getRandomSentence();
    }
  }

  // Mode selection prompt
  async selectMode() {
    return new Promise((resolve) => {
      // Ensure raw mode is disabled for the prompt
      stdin.setRawMode(false);
      stdin.resume();

      this.clearScreen();
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║                     SELECT GAME MODE                       ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      console.log('Choose a mode:');
      console.log('  1) Sentences');
      console.log('  2) Random words\n');

      this.rl = readline.createInterface({ input: stdin, output: stdout });
      this.rl.question('Enter 1 or 2: ', (answer) => {
        const trimmed = answer.trim();
        if (trimmed === '2') {
          resolve('words');
        } else if (trimmed === '1') {
          resolve('sentence');
        } else {
          console.log('Invalid Input!');
        }
        this.rl.close();
        this.rl = null;
      });
    });
  }

  // Clear the terminal
  clearScreen() {
    stdout.write('\x1B[2J\x1B[0f');
  }

  // Display the current state
  displayProgress() {
    this.clearScreen();

    const modeLabel = this.mode === 'words' ? 'Random words' : 'Sentences';
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║   TYPING TEST (${modeLabel}) - Type the text below         ║`);
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
    console.log('Original sentence:');
    console.log(`  ${this.sentence}\n`);
    console.log('Your input:');
    console.log(`  ${this.userInput}\n`);

    console.log('─────────────────────────────────────────────────────────────\n');
    console.log("Press any key to play again, 'm' to change mode, or 'q' to exit\n");
  }

  // Handle character input
  handleInput(char) {
    // If waiting for restart, handle restart
    if (this.isWaitingForRestart) {
      this.reset();
      this.start();
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
    if (this.rl) {
      this.rl.close();
    }
  }

  // Start the test
  async start() {
    // Remove any existing handler first
    this.removeInputHandler();

    // Prompt for mode if not set
    if (!this.mode) {
      this.mode = await this.selectMode();
    }

    this.reset();

    // Set up raw mode for character-by-character input
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    this.displayProgress();

    // Create and store the handler
    this.inputHandler = (char) => {
      // Allow switching mode on restart screen
      if (this.isWaitingForRestart) {
        if (char && char.toLowerCase() === 'm') {
          this.mode = null; // force mode selection next round
        } else if (char && char.toLowerCase() === 'q') {
          this.cleanup();
          process.exit(0);
        }
      }
      this.handleInput(char);
    };

    // Add the event listener
    stdin.on('data', this.inputHandler);

    // Handle Ctrl+C
    stdin.once('SIGINT', () => {
      this.cleanup();
      console.log('\n\nGoodbye!');
      process.exit(0);
    });
  }
}

// Start the application
const test = new TypingTest();
test.start();

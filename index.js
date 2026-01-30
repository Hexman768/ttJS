import readline from 'readline';
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

// Pool of words for word-mode
const WORDS = [
  "river", "cloud", "stone", "window", "keyboard", "syntax", "function", "variable",
  "forest", "planet", "ocean", "mountain", "coffee", "camera", "signal", "memory",
  "library", "buffer", "matrix", "vector", "random", "puzzle", "rocket", "energy",
  "garden", "summer", "winter", "autumn", "spring", "light", "shadow", "pixel",
  "binary", "logic", "thread", "promise", "async", "render", "bundle", "module",
  "cursor", "screen", "button", "switch", "charger", "battery", "cable", "server"
];

const WORD_MODE_LENGTH = 14; // number of words per round in word mode

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

  // Get a random sequence of words
  getRandomWordsString() {
    const words = [];
    for (let i = 0; i < WORD_MODE_LENGTH; i++) {
      words.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
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
      // Highlight the character at cursor position with reverse video
      if (i === cursorPos) {
        if (i < this.userInput.length) {
          if (this.userInput[i] === this.sentence[i]) {
            // Correct character - green with reverse video for cursor
            display += `\x1b[7m\x1b[32m${this.sentence[i]}\x1b[0m`;
          } else {
            // Incorrect character - red with reverse video for cursor
            display += `\x1b[7m\x1b[31m${this.sentence[i]}\x1b[0m`;
          }
        } else {
          // Not yet typed - gray with reverse video for cursor
          display += `\x1b[7m\x1b[90m${this.sentence[i]}\x1b[0m`;
        }
      } else {
        // Normal display for non-cursor characters
        if (i < this.userInput.length) {
          if (this.userInput[i] === this.sentence[i]) {
            // Correct character - green
            display += `\x1b[32m${this.sentence[i]}\x1b[0m`;
          } else {
            // Incorrect character - red
            display += `\x1b[31m${this.sentence[i]}\x1b[0m`;
          }
        } else {
          // Not yet typed - white/gray
          display += `\x1b[90m${this.sentence[i]}\x1b[0m`;
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

  // Calculate WPM (Words Per Minute)
  calculateWPM() {
    if (!this.startTime || !this.endTime) return 0;

    const timeInMinutes = (this.endTime - this.startTime) / 1000 / 60;
    const wordsTyped = this.userInput.trim().split(/\s+/).length;
    const wpm = wordsTyped / timeInMinutes;

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
      if (this.userInput.length > 0) {
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

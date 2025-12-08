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

class TypingTest {
  constructor() {
    this.sentence = '';
    this.userInput = '';
    this.startTime = null;
    this.endTime = null;
    this.rl = null;
    this.inputHandler = null; // Store the handler so we can remove it
    this.isWaitingForRestart = false;
  }

  // Get a random sentence
  getRandomSentence() {
    return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
  }

  // Clear the terminal
  clearScreen() {
    stdout.write('\x1B[2J\x1B[0f');
  }

  // Display the current state
  displayProgress() {
    this.clearScreen();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              TYPING TEST - Type the sentence below         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('Sentence to type:');
    console.log('─────────────────────────────────────────────────────────────\n');
    
    // Display the sentence with color coding
    let display = '';
    for (let i = 0; i < this.sentence.length; i++) {
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
    console.log('Press any key to try again, or Ctrl+C to exit\n');
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
    this.sentence = this.getRandomSentence();
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
  start() {
    // Remove any existing handler first
    this.removeInputHandler();
    
    this.sentence = this.getRandomSentence();
    this.userInput = '';
    this.startTime = null;
    this.endTime = null;
    this.isWaitingForRestart = false;

    // Set up raw mode for character-by-character input
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    this.displayProgress();

    // Create and store the handler
    this.inputHandler = (char) => {
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


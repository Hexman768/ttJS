import { stdin, stdout } from 'process';
import { SpaceshipTypingGame } from './game.js';
import { nextEligibleWord } from './words.js';

const DEFAULT_DURATION_SECONDS = 15;
const WORD_BUFFER_CHARS = 200; // keep ahead of the cursor for multi-line display
const TIMER_TICK_MS = 100;
// Monkeytype-style line layout: capped width, side margins, 3 visible lines
const MAX_LINE_CHARS = 60;
const SIDE_MARGIN = 6;
const VISIBLE_LINES = 3;

// Visible character for space so mistakes on spaces are visible
const SPACE_MARKER = '_';

const TITLE_ART = [
  '  _   _      _ ____  ',
  ' | |_| |_   | / ___| ',
  ' | __| __|  | \\___ \\ ',
  ' | |_| |_ |_| |___) |',
  '  \\__|\\__|(___|____/ ',
];

// Keep this in sync with program behavior as features are added.
const HELP = {
  description:
    'A terminal typing trainer with a timed test and a spaceship word-blaster game. Both modes use the same English word list.',
  sections: [
    {
      title: 'Usage',
      items: [
        ['npm start', 'Open the splash menu'],
        ['node index.js --time 30', 'Start a timed test lasting 30 seconds'],
        ['node index.js -t 60', 'Same as --time 60'],
        ['node index.js --game', 'Start the spaceship typing game'],
        ['node index.js -g', 'Same as --game'],
        ['node index.js --help', 'Show this help menu'],
        ['node index.js -h', 'Show this help menu'],
      ],
    },
    {
      title: 'Splash menu',
      items: [
        ['1 or Enter', 'Start the timed typing test'],
        ['2', 'Start the spaceship typing game'],
        ['?', 'Show this help menu'],
        ['ESC, q', 'Quit'],
      ],
    },
    {
      title: 'Timed test',
      items: [
        ['Letter keys', 'Type the shown text'],
        ['Backspace', 'Delete the last unlocked character'],
        ['ESC', 'Quit'],
        ['WPM', '(correct characters / 5) / configured minutes'],
      ],
    },
    {
      title: 'Spaceship game',
      items: [
        ['Letter keys', 'Lock onto and type approaching words'],
        ['Backspace', 'Undo the last typed character'],
        ['Complete a word', 'Ship fires a laser and the word explodes'],
        ['Word reaches ship', 'Game over'],
        ['ESC', 'Quit'],
      ],
    },
    {
      title: 'Results',
      items: [
        ['Enter', 'Play another round'],
        ['m', 'Return to the splash menu'],
        ['?', 'Show this help menu'],
        ['q', 'Quit'],
      ],
    },
  ],
};

function wantsHelp(args) {
  return args.some((arg) => arg === '--help' || arg === '-h' || arg === 'help');
}

function parseArgs(args) {
  let durationSeconds = DEFAULT_DURATION_SECONDS;
  let mode = null; // 'test' | 'game' | null (menu)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h' || arg === 'help') {
      continue;
    }

    if (arg === '--game' || arg === '-g') {
      mode = 'game';
      continue;
    }

    if (arg === '--test') {
      mode = 'test';
      continue;
    }

    let value = null;
    if (arg === '--time' || arg === '-t') {
      value = args[i + 1];
      i++;
    } else if (arg.startsWith('--time=')) {
      value = arg.slice('--time='.length);
    } else if (arg.startsWith('-t=') && arg.length > 3) {
      value = arg.slice(3);
    } else {
      return { error: `Unknown option: ${arg}` };
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      return { error: `Invalid duration "${value}". Use a positive whole number of seconds.` };
    }

    durationSeconds = parsed;
    if (!mode) {
      mode = 'test';
    }
  }

  return { durationSeconds, mode };
}

function colorize(text, code) {
  if (!stdout.isTTY) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

function writeHelp() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                         ttJS HELP                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`${HELP.description}\n`);

  for (const section of HELP.sections) {
    console.log(colorize(section.title.toUpperCase(), '36'));
    for (const [key, description] of section.items) {
      console.log(`  ${key.padEnd(28)}${description}`);
    }
    console.log();
  }
}

class TypingTest {
  constructor(durationSeconds) {
    this.durationSeconds = durationSeconds;
    this.sentence = '';
    this.userInput = '';
    this.startTime = null;
    this.endTime = null;
    this.inputHandler = null; // Store the handler so we can remove it
    this.timerInterval = null;
    this.isWaitingForRestart = false;
    this.isShowingHelp = false;
    this.paragraphStart = 0;
    this.onReturnToMenu = null;
  }

  // Append one word using the shared word-list selection rules
  appendWord() {
    const existing = this.sentence.length > 0 ? this.sentence.split(' ') : [];
    const word = nextEligibleWord(existing);
    this.sentence = this.sentence.length === 0 ? word : `${this.sentence} ${word}`;
  }

  // Keep a buffer of upcoming words so the timed test never runs out of text
  ensureWordBuffer() {
    while (this.sentence.length - this.userInput.length < WORD_BUFFER_CHARS) {
      this.appendWord();
    }
  }

  // Set the current target text
  setTargetText() {
    this.sentence = '';
    this.ensureWordBuffer();
  }

  // Center a line in the terminal
  centerLine(text) {
    const width = stdout.columns || 80;
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
  }

  // Splash screen used as the mode menu
  showLandingPage() {
    this.clearScreen();

    const rows = stdout.rows || 24;
    const menuLines = [
      '1  Timed typing test',
      '2  Spaceship typing game',
      '',
      `Timed test length: ${this.durationSeconds}s  (change with --time)`,
      '',
      '? help   ·   ESC quit',
    ];
    const topPad = Math.max(1, Math.floor((rows - TITLE_ART.length - menuLines.length - 3) / 3));

    stdout.write('\n'.repeat(topPad));
    for (const line of TITLE_ART) {
      console.log(`\x1b[36m${this.centerLine(line)}\x1b[0m`);
    }
    console.log();
    console.log(this.centerLine('Choose a mode'));
    console.log();
    for (const line of menuLines) {
      console.log(`\x1b[2m${this.centerLine(line)}\x1b[0m`);
    }
  }

  // Full-screen help used during runtime
  displayHelp() {
    this.clearScreen();
    writeHelp();
    console.log('─────────────────────────────────────────────────────────────\n');
    console.log('Press Enter or ESC to return\n');
  }

  isHelpKey(char) {
    return char === '?';
  }

  isQuitKey(char) {
    return char === 'q' || char === 'Q' || char === '\u001b' || char === '\u0003';
  }

  // Wait on the splash menu until the user picks a mode
  waitForMenuSelection() {
    return new Promise((resolve) => {
      const attachLandingHandler = () => {
        this.showLandingPage();
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        const onData = (char) => {
          if (this.isQuitKey(char)) {
            stdin.removeListener('data', onData);
            this.cleanup();
            process.exit(0);
          }

          if (this.isHelpKey(char)) {
            stdin.removeListener('data', onData);
            this.waitForHelpDismiss().then(attachLandingHandler);
            return;
          }

          if (char === '1' || char === '\r' || char === '\n') {
            stdin.removeListener('data', onData);
            resolve('test');
            return;
          }

          if (char === '2') {
            stdin.removeListener('data', onData);
            resolve('game');
          }
        };

        stdin.on('data', onData);
      };

      attachLandingHandler();
    });
  }

  // Show help, then resume when the user dismisses it
  waitForHelpDismiss() {
    this.isShowingHelp = true;
    this.displayHelp();

    return new Promise((resolve) => {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      const onData = (char) => {
        if (char === '\u0003') {
          stdin.removeListener('data', onData);
          this.cleanup();
          process.exit(0);
        }
        if (char === '\r' || char === '\n' || char === '\u001b') {
          stdin.removeListener('data', onData);
          this.isShowingHelp = false;
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

  getRemainingSeconds() {
    if (!this.startTime) {
      return this.durationSeconds;
    }
    const elapsed = (Date.now() - this.startTime) / 1000;
    return Math.max(0, this.durationSeconds - elapsed);
  }

  // Centered content width with side margins so lines never hug the terminal edges
  getTextLayout() {
    const cols = stdout.columns || 80;
    const usable = Math.max(20, cols - SIDE_MARGIN * 2);
    const contentWidth = Math.min(MAX_LINE_CHARS, usable);
    const leftPad = Math.max(SIDE_MARGIN, Math.floor((cols - contentWidth) / 2));
    return { contentWidth, leftPad, cols };
  }

  // Word tokens as [start, end) ranges into this.sentence
  getWordTokens() {
    const tokens = [];
    let start = 0;

    for (let i = 0; i <= this.sentence.length; i++) {
      const atEnd = i === this.sentence.length;
      const isSpace = !atEnd && this.sentence[i] === ' ';
      if (atEnd || isSpace) {
        if (i > start) {
          tokens.push({ start, end: i });
        }
        start = i + 1;
      }
    }

    return tokens;
  }

  // Wrap at word boundaries into lines of at most contentWidth characters.
  // When fromIndex > 0, only wrap words at or after that point (current paragraph).
  wrapTextLines(contentWidth, fromIndex = 0) {
    const words = this.getWordTokens().filter((word) => word.start >= fromIndex);
    const lines = [];
    let i = 0;

    while (i < words.length) {
      const lineStart = words[i].start;
      let lineWidth = words[i].end - words[i].start;
      let j = i + 1;

      while (j < words.length) {
        const wordLen = words[j].end - words[j].start;
        if (lineWidth + 1 + wordLen > contentWidth) {
          break;
        }
        lineWidth += 1 + wordLen;
        j++;
      }

      // Include the trailing space before the next line's first word (if any)
      const lineEnd = j < words.length ? words[j].start : this.sentence.length;
      lines.push({ start: lineStart, end: lineEnd });
      i = j;
    }

    return lines;
  }

  // Build a full paragraph of VISIBLE_LINES rows; advance when the user finishes it
  syncParagraph(contentWidth) {
    // Safety bound so a runaway cursor cannot loop forever
    for (let guard = 0; guard < 100; guard++) {
      this.ensureWordBuffer();

      let lines = this.wrapTextLines(contentWidth, this.paragraphStart);

      while (lines.length < VISIBLE_LINES) {
        this.appendWord();
        lines = this.wrapTextLines(contentWidth, this.paragraphStart);
      }

      const paragraphLines = lines.slice(0, VISIBLE_LINES);
      const paragraphEnd = paragraphLines[paragraphLines.length - 1].end;

      // Finished this paragraph — swap in the next one without pausing the timer
      if (this.userInput.length >= paragraphEnd) {
        this.paragraphStart = paragraphEnd;
        continue;
      }

      return paragraphLines;
    }

    return this.wrapTextLines(contentWidth, this.paragraphStart).slice(0, VISIBLE_LINES);
  }

  // Colorize one character at index i for the typing display
  formatDisplayChar(i, cursorPos) {
    const char = this.sentence[i];
    const isWrong = i < this.userInput.length && this.userInput[i] !== char;
    const displayChar = char === ' ' && isWrong ? SPACE_MARKER : char;

    if (i === cursorPos) {
      if (i < this.userInput.length) {
        if (this.userInput[i] === char) {
          return `\x1b[7m\x1b[32m${char}\x1b[0m`;
        }
        return `\x1b[7m\x1b[31m${displayChar}\x1b[0m`;
      }
      return `\x1b[7m\x1b[90m${char}\x1b[0m`;
    }

    if (i < this.userInput.length) {
      if (this.userInput[i] === char) {
        return `\x1b[32m${char}\x1b[0m`;
      }
      return `\x1b[31m${displayChar}\x1b[0m`;
    }

    return `\x1b[90m${char}\x1b[0m`;
  }

  // Display the current state
  displayProgress() {
    this.clearScreen();

    const remaining = this.getRemainingSeconds();
    const { contentWidth, leftPad } = this.getTextLayout();
    const pad = ' '.repeat(leftPad);
    const rule = '─'.repeat(contentWidth);
    const title = 'TYPING TEST - Type the text below';
    const innerWidth = Math.max(2, contentWidth - 2);
    const clippedTitle = title.length > innerWidth
      ? `${title.slice(0, Math.max(0, innerWidth - 1))}…`
      : title;
    const titlePad = Math.max(0, innerWidth - clippedTitle.length);
    const titleLeft = Math.floor(titlePad / 2);
    const titleRight = titlePad - titleLeft;

    console.log(`\n${pad}╔${'═'.repeat(innerWidth)}╗`);
    console.log(`${pad}║${' '.repeat(titleLeft)}${clippedTitle}${' '.repeat(titleRight)}║`);
    console.log(`${pad}╚${'═'.repeat(innerWidth)}╝\n`);

    console.log(`${pad}Text to type:`);
    console.log(`${pad}${rule}\n`);

    const cursorPos = this.userInput.length;
    // Show a fixed paragraph: completed rows stay visible; cursor moves down.
    // When the paragraph is finished, syncParagraph swaps in a new one.
    const visibleLines = this.syncParagraph(contentWidth);

    for (const line of visibleLines) {
      let rendered = '';
      for (let i = line.start; i < line.end; i++) {
        rendered += this.formatDisplayChar(i, cursorPos);
      }
      console.log(pad + rendered);
    }

    // Keep vertical space stable when near the end of the buffer
    for (let i = visibleLines.length; i < VISIBLE_LINES; i++) {
      console.log('');
    }

    console.log(`\n${pad}${rule}\n`);

    const correctChars = this.getCorrectCharacters();
    const accuracy = this.userInput.length > 0
      ? ((correctChars / this.userInput.length) * 100).toFixed(1)
      : 0;

    console.log(`${pad}Time left: ${remaining.toFixed(1)}s / ${this.durationSeconds}s`);
    console.log(`${pad}Characters: ${this.userInput.length}`);
    console.log(`${pad}Accuracy: ${accuracy}%`);

    console.log(`\n${pad}${rule}`);
    console.log(`${pad}Press ESC to quit, Backspace to delete\n`);
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
    let lockedPrefixLength = this.paragraphStart;

    for (let i = 0; i < wordRanges.length; i++) {
      const { start, end } = wordRanges[i];
      if (end < this.paragraphStart) {
        continue;
      }

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

  // Monkeytype-style timed WPM: (correct characters / 5) / configured minutes
  calculateWPM() {
    if (!this.startTime) return 0;

    const timeInMinutes = this.durationSeconds / 60;
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

  clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  startCountdown() {
    this.clearTimer();
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      if (this.isWaitingForRestart || this.isShowingHelp) {
        return;
      }
      if (this.getRemainingSeconds() <= 0) {
        this.finishTest();
      } else {
        this.displayProgress();
      }
    }, TIMER_TICK_MS);
  }

  finishTest() {
    if (this.isWaitingForRestart) return;

    this.clearTimer();
    this.endTime = this.startTime
      ? this.startTime + this.durationSeconds * 1000
      : Date.now();
    this.showResults();
    this.isWaitingForRestart = true;
  }

  // Show results
  showResults() {
    this.clearScreen();

    const wpm = this.calculateWPM();
    const accuracy = this.calculateAccuracy();
    const correctChars = this.getCorrectCharacters();
    const totalChars = this.userInput.length;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      TYPING TEST RESULTS                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Duration: ${this.durationSeconds} seconds`);
    console.log(`Speed: ${wpm} WPM (Words Per Minute)`);
    console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`Characters: ${correctChars}/${totalChars} correct\n`);

    console.log('─────────────────────────────────────────────────────────────\n');
    console.log("Press Enter to play again, 'm' for menu, '?' for help, or 'q' to exit\n");
  }

  // Handle character input
  handleInput(char) {
    if (this.isShowingHelp) {
      if (char === '\u0003') {
        this.cleanup();
        process.exit(0);
      }
      if (char === '\r' || char === '\n' || char === '\u001b') {
        this.isShowingHelp = false;
        this.showResults();
      }
      return;
    }

    // Results screen: ignore accidental keypresses unless Enter / m / ? / q
    if (this.isWaitingForRestart) {
      if (char === '\r' || char === '\n') { // Detect Enter
        this.beginRound();
      } else if (char && char.toLowerCase() === 'm') {
        this.cleanup();
        if (typeof this.onReturnToMenu === 'function') {
          this.onReturnToMenu();
        }
      } else if (this.isHelpKey(char)) {
        this.isShowingHelp = true;
        this.displayHelp();
      } else if (char && char.toLowerCase() === 'q') {
        this.cleanup();
        process.exit(0);
      }
      return;
    }

    // Handle special keys
    if (char === '\u001b') { // ESC
      this.cleanup();
      process.exit(0);
    } else if (char === '\u007f' || char === '\b') { // Backspace
      if (this.userInput.length > this.getLockedPrefixLength()) {
        this.userInput = this.userInput.slice(0, -1);
      }
    } else if (char === '\r' || char === '\n') {
      // Timed tests ignore Enter; the countdown finishes the round.
      return;
    } else if (char >= ' ' && char <= '~') { // Printable characters
      // Start timer on first character
      if (!this.startTime) {
        this.startCountdown();
      }

      this.userInput += char;
      this.ensureWordBuffer();
      // Advance to a new paragraph as soon as the current one is finished
      this.syncParagraph(this.getTextLayout().contentWidth);
    }

    if (this.startTime && this.getRemainingSeconds() <= 0) {
      this.finishTest();
      return;
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
    this.clearTimer();
    this.setTargetText();
    this.userInput = '';
    this.startTime = null;
    this.endTime = null;
    this.isWaitingForRestart = false;
    this.isShowingHelp = false;
    this.paragraphStart = 0;
  }

  // Cleanup
  cleanup() {
    this.clearTimer();
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

  // Start a timed typing test (optionally after the splash menu)
  start({ onReturnToMenu } = {}) {
    this.onReturnToMenu = onReturnToMenu || null;
    this.beginRound();
  }
}

async function showHelpOverlay() {
  return new Promise((resolve) => {
    stdout.write('\x1B[2J\x1B[0f');
    writeHelp();
    console.log('─────────────────────────────────────────────────────────────\n');
    console.log('Press Enter or ESC to return\n');

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      if (char === '\u0003') {
        stdin.removeListener('data', onData);
        process.exit(0);
      }
      if (char === '\r' || char === '\n' || char === '\u001b') {
        stdin.removeListener('data', onData);
        resolve();
      }
    };

    stdin.on('data', onData);
  });
}

async function runApp(options) {
  const menuHost = new TypingTest(options.durationSeconds);

  stdin.once('SIGINT', () => {
    menuHost.cleanup();
    console.log('\n\nGoodbye!');
    process.exit(0);
  });

  const launchMode = async (mode) => {
    if (mode === 'game') {
      const game = new SpaceshipTypingGame();
      game.start({
        onShowHelp: async (done) => {
          await showHelpOverlay();
          done();
        },
        onReturnToMenu: () => {
          runFromMenu();
        },
      });
      return;
    }

    const test = new TypingTest(options.durationSeconds);
    test.start({
      onReturnToMenu: () => {
        runFromMenu();
      },
    });
  };

  const runFromMenu = async () => {
    const mode = await menuHost.waitForMenuSelection();
    await launchMode(mode);
  };

  if (options.mode === 'game' || options.mode === 'test') {
    await launchMode(options.mode);
  } else {
    await runFromMenu();
  }
}

const args = process.argv.slice(2);

if (wantsHelp(args)) {
  writeHelp();
  process.exit(0);
}

const options = parseArgs(args);
if (options.error) {
  console.error(`Error: ${options.error}`);
  console.error('Try: node index.js --time 30');
  console.error('Or:  node index.js --game');
  console.error('Or:  node index.js --help');
  process.exit(1);
}

runApp(options);

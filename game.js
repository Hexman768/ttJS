import { stdin, stdout } from 'process';
import { nextEligibleWord } from './words.js';

const TICK_MS = 80;
const SPAWN_BASE_MS = 1800;
const MAX_ACTIVE_WORDS = 6;
const LASER_FRAMES = 3;
const EXPLOSION_FRAMES = 5;
const SHIP_COL = 2;
const SHIP_SPRITE = [
  '  __',
  '>=||>',
  "  ''",
];

export class SpaceshipTypingGame {
  constructor() {
    this.words = [];
    this.activeWordId = null;
    this.typed = '';
    this.score = 0;
    this.destroyed = 0;
    this.charsTyped = 0;
    this.charsCorrect = 0;
    this.startTime = null;
    this.endTime = null;
    this.tick = 0;
    this.spawnAccumulator = 0;
    this.speed = 0.35;
    this.effects = [];
    this.inputHandler = null;
    this.loopInterval = null;
    this.isWaitingForRestart = false;
    this.isShowingHelp = false;
    this.gameOver = false;
    this.recentWords = [];
    this.onShowHelp = null;
    this.onQuit = null;
  }

  getSize() {
    return {
      cols: Math.max(60, stdout.columns || 80),
      rows: Math.max(18, stdout.rows || 24),
    };
  }

  getShipRow() {
    const { rows } = this.getSize();
    return Math.floor(rows / 2) - 1;
  }

  clearScreen() {
    stdout.write('\x1B[2J\x1B[0f');
  }

  cleanup() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    if (this.inputHandler) {
      stdin.removeListener('data', this.inputHandler);
      this.inputHandler = null;
    }
    stdin.setRawMode(false);
    stdin.pause();
  }

  reset() {
    this.words = [];
    this.activeWordId = null;
    this.typed = '';
    this.score = 0;
    this.destroyed = 0;
    this.charsTyped = 0;
    this.charsCorrect = 0;
    this.startTime = null;
    this.endTime = null;
    this.tick = 0;
    this.spawnAccumulator = 0;
    this.speed = 0.35;
    this.effects = [];
    this.isWaitingForRestart = false;
    this.isShowingHelp = false;
    this.gameOver = false;
    this.recentWords = [];
  }

  occupiedRows() {
    return new Set(this.words.map((word) => word.row));
  }

  pickSpawnRow() {
    const { rows } = this.getSize();
    const top = 3;
    const bottom = rows - 5;
    const occupied = this.occupiedRows();
    const candidates = [];

    for (let row = top; row <= bottom; row++) {
      if (!occupied.has(row)) {
        candidates.push(row);
      }
    }

    if (candidates.length === 0) {
      return top + Math.floor(Math.random() * Math.max(1, bottom - top + 1));
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  spawnWord() {
    if (this.words.length >= MAX_ACTIVE_WORDS) {
      return;
    }

    const { cols } = this.getSize();
    const text = nextEligibleWord(this.recentWords);
    this.recentWords.push(text);
    if (this.recentWords.length > 8) {
      this.recentWords.shift();
    }

    this.words.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      x: cols - text.length - 2,
      row: this.pickSpawnRow(),
      typed: '',
    });
  }

  findWordById(id) {
    return this.words.find((word) => word.id === id) || null;
  }

  // Lock onto a word that uniquely matches the typed prefix (ZType-style)
  resolveActiveWord() {
    if (this.typed.length === 0) {
      this.activeWordId = null;
      return null;
    }

    if (this.activeWordId) {
      const current = this.findWordById(this.activeWordId);
      if (current && current.text.startsWith(this.typed)) {
        current.typed = this.typed;
        return current;
      }
      this.activeWordId = null;
    }

    const matches = this.words.filter((word) => word.text.startsWith(this.typed));
    if (matches.length === 1) {
      this.activeWordId = matches[0].id;
      matches[0].typed = this.typed;
      return matches[0];
    }

    if (matches.length > 1) {
      // Prefer the closest threat when several words share a prefix
      matches.sort((a, b) => a.x - b.x);
      this.activeWordId = matches[0].id;
      matches[0].typed = this.typed;
      return matches[0];
    }

    return null;
  }

  destroyWord(word) {
    const shipRow = this.getShipRow();
    this.effects.push({
      type: 'laser',
      fromRow: shipRow,
      toRow: word.row,
      toX: Math.floor(word.x),
      framesLeft: LASER_FRAMES,
    });
    this.effects.push({
      type: 'explosion',
      row: word.row,
      x: Math.floor(word.x + word.text.length / 2),
      framesLeft: EXPLOSION_FRAMES,
      stage: 0,
    });

    this.words = this.words.filter((item) => item.id !== word.id);
    if (this.activeWordId === word.id) {
      this.activeWordId = null;
      this.typed = '';
    }

    this.destroyed += 1;
    this.score += word.text.length * 10;
    this.speed = Math.min(1.2, this.speed + 0.015);
  }

  getAccuracy() {
    if (this.charsTyped === 0) return 100;
    return (this.charsCorrect / this.charsTyped) * 100;
  }

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    const end = this.endTime || Date.now();
    return (end - this.startTime) / 1000;
  }

  finishGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.endTime = Date.now();
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.isWaitingForRestart = true;
    this.showResults();
  }

  formatWord(word) {
    const isActive = word.id === this.activeWordId;
    const typedLen = isActive ? this.typed.length : 0;
    let out = '';

    for (let i = 0; i < word.text.length; i++) {
      const char = word.text[i];
      if (i < typedLen) {
        if (this.typed[i] === char) {
          out += `\x1b[32m${char}\x1b[0m`;
        } else {
          out += `\x1b[31m${char}\x1b[0m`;
        }
      } else if (isActive && i === typedLen) {
        out += `\x1b[7m\x1b[37m${char}\x1b[0m`;
      } else {
        out += `\x1b[37m${char}\x1b[0m`;
      }
    }

    return out;
  }

  drawFrame() {
    if (this.isShowingHelp || this.isWaitingForRestart) {
      return;
    }

    const { cols, rows } = this.getSize();
    const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
    const colorGrid = Array.from({ length: rows }, () => Array(cols).fill(null));

    const put = (row, col, ch, color = null) => {
      if (row < 0 || row >= rows || col < 0 || col >= cols) return;
      if (ch === ' ') return;
      grid[row][col] = ch;
      colorGrid[row][col] = color;
    };

    // HUD
    const hud = ` SCORE ${this.score}   DESTROYED ${this.destroyed}   ACC ${this.getAccuracy().toFixed(0)}%   SPEED ${this.speed.toFixed(2)} `;
    for (let i = 0; i < hud.length && i < cols; i++) {
      put(0, i, hud[i], '36');
    }
    for (let i = 0; i < cols; i++) {
      put(1, i, '─', '90');
    }

    // Spaceship on the left
    const shipRow = this.getShipRow();
    for (let i = 0; i < SHIP_SPRITE.length; i++) {
      const line = SHIP_SPRITE[i];
      for (let j = 0; j < line.length; j++) {
        put(shipRow - 1 + i, SHIP_COL + j, line[j], '36');
      }
    }

    // Effects under words so text can overwrite briefly
    for (const effect of this.effects) {
      if (effect.type === 'laser') {
        const minRow = Math.min(effect.fromRow, effect.toRow);
        const maxRow = Math.max(effect.fromRow, effect.toRow);
        const startCol = SHIP_COL + SHIP_SPRITE[1].length;
        for (let c = startCol; c <= effect.toX; c++) {
          put(effect.fromRow, c, '-', '33');
        }
        if (maxRow !== minRow) {
          const step = effect.toRow > effect.fromRow ? 1 : -1;
          for (let r = effect.fromRow; r !== effect.toRow; r += step) {
            put(r, effect.toX, '|', '33');
          }
        }
        put(effect.toRow, effect.toX, '*', '33');
      } else if (effect.type === 'explosion') {
        const frames = ['*', '+*+', '*+#*', '.*.', ' . '];
        const art = frames[Math.min(effect.stage, frames.length - 1)];
        const start = effect.x - Math.floor(art.length / 2);
        for (let i = 0; i < art.length; i++) {
          put(effect.row, start + i, art[i], '31');
        }
      }
    }

    // Words with typing progress colors (drawn as full strings later)
    this.clearScreen();
    let frame = '';
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const color = colorGrid[r][c];
        const ch = grid[r][c];
        if (color) {
          line += `\x1b[${color}m${ch}\x1b[0m`;
        } else {
          line += ch;
        }
      }
      frame += `${line}\n`;
    }
    stdout.write(frame);

    // Overlay words with ANSI color sequences by cursor positioning
    for (const word of this.words) {
      const x = Math.max(0, Math.floor(word.x));
      const rendered = this.formatWord(word);
      stdout.write(`\x1b[${word.row + 1};${x + 1}H${rendered}`);
    }

    const footerRow = rows - 1;
    const hint = this.typed.length > 0
      ? ` Locked: ${this.typed}   Backspace undo   ESC quit`
      : ' Type a word to lock on   ESC quit';
    stdout.write(`\x1b[${footerRow};1H\x1b[2m${hint.padEnd(cols).slice(0, cols)}\x1b[0m`);
  }

  updateEffects() {
    for (const effect of this.effects) {
      effect.framesLeft -= 1;
      if (effect.type === 'explosion') {
        effect.stage += 1;
      }
    }
    this.effects = this.effects.filter((effect) => effect.framesLeft > 0);
  }

  update() {
    if (this.gameOver || this.isShowingHelp || this.isWaitingForRestart) {
      return;
    }

    if (!this.startTime) {
      this.drawFrame();
      return;
    }

    this.tick += 1;
    this.spawnAccumulator += TICK_MS;

    const spawnEvery = Math.max(700, SPAWN_BASE_MS - this.destroyed * 25);
    if (this.spawnAccumulator >= spawnEvery || this.words.length === 0) {
      this.spawnAccumulator = 0;
      this.spawnWord();
    }

    const shipHitCol = SHIP_COL + SHIP_SPRITE[1].length + 1;
    for (const word of this.words) {
      word.x -= this.speed;
      if (word.x <= shipHitCol) {
        this.finishGame();
        return;
      }
    }

    this.updateEffects();
    this.drawFrame();
  }

  showResults() {
    this.clearScreen();
    const elapsed = this.getElapsedSeconds();
    const accuracy = this.getAccuracy();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                   SPACESHIP GAME OVER                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`Score: ${this.score}`);
    console.log(`Words destroyed: ${this.destroyed}`);
    console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`Survived: ${elapsed.toFixed(1)}s\n`);
    console.log('─────────────────────────────────────────────────────────────\n');
    console.log("Press Enter to play again, 'm' for menu, or 'q' to exit\n");
  }

  handleInput(char) {
    if (this.isShowingHelp) {
      return;
    }

    if (this.isWaitingForRestart) {
      if (char === '\r' || char === '\n') {
        this.beginRound();
      } else if (char && char.toLowerCase() === 'm') {
        this.cleanup();
        if (typeof this.onReturnToMenu === 'function') {
          this.onReturnToMenu();
        }
      } else if (char && char.toLowerCase() === 'q') {
        this.cleanup();
        process.exit(0);
      }
      return;
    }

    if (char === '\u001b' || char === '\u0003') {
      this.cleanup();
      process.exit(0);
    }

    if (char === '\u007f' || char === '\b') {
      if (this.typed.length > 0) {
        this.typed = this.typed.slice(0, -1);
        const active = this.resolveActiveWord();
        if (!active) {
          this.typed = '';
          this.activeWordId = null;
        } else {
          active.typed = this.typed;
        }
      }
      this.drawFrame();
      return;
    }

    if (char === '?' && typeof this.onShowHelp === 'function') {
      this.isShowingHelp = true;
      if (this.inputHandler) {
        stdin.removeListener('data', this.inputHandler);
      }
      this.onShowHelp(() => {
        this.isShowingHelp = false;
        if (this.inputHandler) {
          stdin.on('data', this.inputHandler);
        }
        stdin.setRawMode(true);
        stdin.resume();
        this.drawFrame();
      });
      return;
    }

    if (char < ' ' || char > '~' || char === ' ') {
      return;
    }

    if (!this.startTime) {
      this.startTime = Date.now();
    }

    this.charsTyped += 1;
    const nextTyped = this.typed + char;
    const previousActive = this.activeWordId;
    this.typed = nextTyped;
    const active = this.resolveActiveWord();

    if (!active) {
      // Invalid key for current lock — reject and keep previous typed prefix
      this.typed = nextTyped.slice(0, -1);
      if (previousActive) {
        this.activeWordId = previousActive;
        const word = this.findWordById(previousActive);
        if (word) word.typed = this.typed;
      } else {
        this.typed = '';
        this.activeWordId = null;
      }
      this.drawFrame();
      return;
    }

    this.charsCorrect += 1;

    if (this.typed === active.text) {
      this.destroyWord(active);
    }

    this.drawFrame();
  }

  beginRound() {
    this.cleanup();
    this.reset();

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    this.spawnWord();
    this.spawnWord();
    this.drawFrame();

    this.inputHandler = (char) => this.handleInput(char);
    stdin.on('data', this.inputHandler);

    this.loopInterval = setInterval(() => this.update(), TICK_MS);
  }

  start({ onShowHelp, onReturnToMenu } = {}) {
    this.onShowHelp = onShowHelp || null;
    this.onReturnToMenu = onReturnToMenu || null;
    this.beginRound();
  }
}

# Terminal Typing Test (ttjs)

A simple terminal-based typing test application that measures your typing speed and accuracy.

## Features

- Real-time progress tracking with color-coded feedback
- Character-by-character accuracy display
- Words Per Minute (WPM) calculation
- Multiple random sentences to practice with
- Clean terminal interface

## Installation

No dependencies required! Just make sure you have Node.js installed (v14 or higher).

## Usage

Run the typing test:

```bash
npm start
```

or

```bash
node index.js
```

## How to Use

1. A random sentence will appear on screen
2. Start typing the sentence character by character
3. You'll see:
   - **Green** characters = correctly typed
   - **Red** characters = incorrectly typed
   - **Gray** characters = not yet typed
4. Progress, accuracy, and elapsed time are shown in real-time
5. Press **Enter** when finished, or continue typing until you complete the sentence
6. View your results: WPM, accuracy, and time
7. Press any key to try again with a new sentence

## Controls

- **ESC** - Exit the application
- **Backspace** - Delete last character
- **Enter** - Finish typing (or auto-finishes when sentence is complete)
- **Ctrl+C** - Exit the application

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║              TYPING TEST - Type the sentence below         ║
╚════════════════════════════════════════════════════════════╝

Sentence to type:
─────────────────────────────────────────────────────────────

The quick brown fox jumps over the lazy dog.

─────────────────────────────────────────────────────────────

Progress: 15/44 characters
Accuracy: 100.0%
Time: 3.2s

─────────────────────────────────────────────────────────────
Press ESC to quit, Backspace to delete, Enter when finished
```

## License

MIT


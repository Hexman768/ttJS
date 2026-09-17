<p align="center">
  <img src="assets/logo.png" alt="ttJS" width="420">
</p>

<h1 align="center">Terminal Typing Test (ttjs)</h1>

A simple terminal-based typing test application that measures your typing speed and accuracy.

## Features

- Timed typing tests (Monkeytype-style)
- Configurable duration via CLI (`--time` / `-t`)
- Real-time progress tracking with color-coded feedback
- Character-by-character accuracy display
- Words Per Minute (WPM) calculation
- Random-word stream so results stay accurate
- Clean terminal interface
- Help menu (`--help`, or `?` in the app)

## Installation

No dependencies required! Just make sure you have Node.js installed (v14 or higher).

## Usage

Run a 15-second timed test (default):

```bash
npm start
```

or

```bash
node index.js
```

Run a custom-length timed test:

```bash
node index.js --time 30
```

or

```bash
node index.js -t 60
```

or

```bash
npm start -- --time 45
```

Show the in-program help menu:

```bash
node index.js --help
```

or

```bash
npm start -- --help
```

## How to Use

1. Press **Enter** on the title screen to start, or **?** for help
2. A paragraph of random words will appear on screen (three wrapped lines)
3. Start typing — the timer begins on your first keypress
4. You'll see:
   - **Green** characters = correctly typed
   - **Red** characters = incorrectly typed
   - **Gray** characters = not yet typed
5. Finished lines stay visible; when you complete the whole paragraph, a new one appears immediately
6. Time remaining, characters typed, and accuracy are shown in real-time
7. When the timer hits zero, your results appear: WPM, accuracy, and duration
8. Press **Enter** to try again, **?** for help, or **q** to exit

## Controls

- **Enter** (title screen) - Start a typing test
- **?** (title or results screen) - Show the help menu
- **ESC** - Exit the application (or return from help)
- **Backspace** - Delete last character
- **Ctrl+C** - Exit the application
- **q** (on title or results screen) - Exit the application

## Scoring

WPM is calculated the same way Monkeytype does for timed tests:

`(correct characters / 5) / (configured seconds / 60)`

Accuracy is `correct characters / characters typed`.

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║              TYPING TEST - Type the text below             ║
╚════════════════════════════════════════════════════════════╝

                    Text to type:
                    ────────────────────────────────────────────────────────────

                    the of and to in he have it that for they with as
                    not on she at by this we you do but from or which
                    one would all will there say who make when can more

                    ────────────────────────────────────────────────────────────

                    Time left: 12.4s / 15s
                    Characters: 18
                    Accuracy: 100.0%

                    ────────────────────────────────────────────────────────────
                    Press ESC to quit, Backspace to delete
```

## License

MIT

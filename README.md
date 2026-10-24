# Pseudo View — Code in Plain English

**Understand any function at a glance.** Pseudo View opens a panel next to the file you are editing and translates every function into plain English, step by step, so beginners (and anyone reading unfamiliar code) can follow what it does.

Works with **TypeScript, TSX, JavaScript and JSX**, including React components and hooks.

## Features

### Side-by-side translation
Every function gets a card: the code on the left and the translation on the right. The panel follows whichever file you switch to, updates as you type, and highlights the function your cursor is in. Click a card's header to jump to that function in the editor.

### Three styles, one click apart

| Tab | Looks like |
| --- | --- |
| **In English** | `1. Store the result of useIsHealthDataAvailable as isAvailable.` |
| **Pseudo English** | `1. DECLARE CONST isAvailable AS useIsHealthDataAvailable()` |
| **Pseudo code** | `SET isAvailable ← useIsHealthDataAvailable()` … `END IF` |

Names of functions, variables, hooks and parameters stay **exactly as written in your code**, so you can always match the explanation to the source.

### 💡 Good to know
Under each English translation, a short beginner-friendly explanation of every JavaScript idea that function uses: `async` / `await`, promises, `fetch`, destructuring, spread and rest, optional chaining `?.`, `??`, template strings, arrow functions, `map` / `filter` / `reduce`, `try` / `catch`, JSX, `useState`, `useEffect` and more.

### 📄 About this file
A summary at the top of the panel: what kind of file it is (a screen, a component, hooks, helpers, a test…), what it does (talks to a server, saves data, navigates), which libraries and project files it uses, what it shares with other files, and a one-line role for each function.

### Show code switch
Already have the real file open next to the panel? Turn **Show code** off and the translation fills the whole card.

### ✨ Explain with Claude (optional)
For an even more human explanation, the **✨ Claude** tab asks Claude to explain a function, or the whole file, in detail: purpose, steps, edge cases and result. This uses **your own Anthropic API key** and sends that code to the Anthropic API. Everything else in Pseudo View runs locally and offline.

## Usage

- Open a `.ts`, `.tsx`, `.js` or `.jsx` file. The panel opens beside it automatically.
- Or run **Pseudo View: Show Pseudo Code Beside File** from the Command Palette (`Cmd+Alt+P` on macOS, `Ctrl+Alt+P` on Windows/Linux).

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `pseudoView.autoOpen` | `true` | Open the panel automatically when a file with functions becomes active. |
| `pseudoView.model` | `claude-haiku-5-5` | Claude model used for the ✨ Claude explanations. |

## Commands

- **Pseudo View: Show Pseudo Code Beside File**
- **Pseudo View: Toggle Auto-Open**
- **Pseudo View: Set Anthropic API Key (for Explain with Claude)**: your key is stored in VS Code's secret storage.

## Privacy

The English, Pseudo English, Pseudo code and About views are generated on your machine; no code leaves it. Only when you click a ✨ Claude button is that function's code (or the file, for the file summary) sent to the Anthropic API with your key.

## License

[MIT](LICENSE)

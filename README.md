# Pseudo View — Code in Plain English

**Understand any function at a glance.** Pseudo View opens a panel next to the file you are editing and translates every function into plain English, step by step, so beginners (and anyone reading unfamiliar code) can follow what it does.

Works with **TypeScript, TSX, JavaScript and JSX**, including React components and hooks.

## Features

### Side-by-side translation
Every function gets a card: the code on the left and the translation on the right. The panel follows whichever file you switch to, updates as you type, and highlights the function your cursor is in. Click a card's header to jump to that function in the editor.

### Three styles, one click apart

Take this function:

```ts
export async function loadUser(id: string, retries = 3) {
  let attempt = 0
  while (attempt < retries) {
    try {
      const res = await fetch(`/api/users/${id}`)
      if (res.ok) return res.json()
      else if (res.status === 404) throw new Error('missing')
    } catch (err) {
      attempt++
    }
  }
  return null
}
```

**In English**

```text
Function: loadUser (id, retries = 3)
  Note: this is async: it can pause to wait for slow work without freezing the app, and its result arrives later (as a promise).
  1. Store 0 as attempt.
  2. As long as attempt is less than retries, keep repeating:
    Try the following, and be ready for something to go wrong:
      Wait for the response from requesting the text "/api/users/" followed by id to finish, and keep the result as res.
      If res was successful, then:
        Give back the body of res read as data.
      Otherwise, if the status code of res is equal to 404, then:
        Stop and fail with the error a brand-new Error built from "missing".
    If something goes wrong (call the problem err):
      Increase attempt by 1.
  3. Give back nothing.
```

**Pseudo English**

```text
ASYNC FUNCTION loadUser(id, retries = 3)
  1. DECLARE LET attempt AS 0
  2. WHILE attempt is less than retries, keep doing:
    TRY to do:
      WAIT FOR fetch(`/api/users/${id}`), then KEEP the result AS res
      IF res.ok THEN:
        RETURN res.json()
      ELSE IF res.status equals 404 THEN:
        THROW ERROR NEW Error('missing')
    IF IT FAILS (as err), do:
      INCREASE attempt BY 1
  3. RETURN null
```

**Pseudo code**

```text
ASYNC FUNCTION loadUser(id, retries = 3)
  SET attempt ← 0
  WHILE attempt < retries DO
    TRY
      SET res ← AWAIT fetch(`/api/users/${id}`)
      IF res.ok THEN
        RETURN res.json()
      ELSE IF res.status = 404 THEN
        THROW NEW Error('missing')
      END IF
    CATCH err
      SET attempt ← attempt + 1
    END TRY
  END WHILE
  RETURN null
END FUNCTION
```

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

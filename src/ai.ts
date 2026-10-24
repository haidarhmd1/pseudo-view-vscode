const EXPLAIN = `You explain code to beginners by rewriting it as detailed, plain-English pseudo code.
Format:
- First line: "Purpose:" followed by one sentence saying what the function is for.
- Then numbered steps (1., 2., 3.). Indent nested steps (inside an if, loop or try) by two spaces, using sub-numbers like 2.1.
- Say what each step does AND why it matters. Mention what happens in edge cases (missing data, errors, empty lists).
- Use everyday words and no code syntax, but keep variable, function and hook names exactly as written in the code (e.g. isAvailable, useIsHealthDataAvailable). No backticks, no markdown.
- Last line: "Result:" followed by what the function gives back or changes.`

const SUMMARY = `You explain source files to beginners in plain English.
Format:
- First line: "Purpose:" followed by one or two sentences on what this whole file is for and why it exists in the app.
- Then "How it works:" followed by 2 to 5 numbered points describing the main flow, in order.
- Then "Key parts:" followed by one line per important function, component or hook: its exact name, a dash, and what it does.
- Keep every name exactly as written in the code. Everyday words, no code syntax, no backticks, no markdown.`

async function ask(apiKey: string, model: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 200)}`)
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] }
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim()
  if (!text) throw new Error('Claude returned no text')
  return text
}

export const explain = (apiKey: string, model: string, source: string) =>
  ask(apiKey, model, EXPLAIN, `Explain this function:\n\n${source.slice(0, 12000)}`, 1500)

export const summarizeFile = (apiKey: string, model: string, fileName: string, text: string) =>
  ask(apiKey, model, SUMMARY, `File: ${fileName}\n\n${text.slice(0, 40000)}`, 1200)

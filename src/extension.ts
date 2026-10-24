import * as vscode from 'vscode'
import { explain, summarizeFile } from './ai'
import { fileOverview } from './overview'
import { extractFunctions, FnInfo } from './pseudo'

const LANGS = new Set(['typescript', 'typescriptreact', 'javascript', 'javascriptreact'])

let panel: vscode.WebviewPanel | undefined
let current: vscode.TextDocument | undefined
let fns: FnInfo[] = []
let timer: NodeJS.Timeout | undefined
let dismissed = new Set<string>()
const aiCache = new Map<string, string>() // source -> Claude's explanation
const inFlight = new Set<string>()
const fileAi = new Map<string, string>() // whole file text -> Claude's summary
const KEY = 'pseudoView.anthropicKey'

const supported = (d?: vscode.TextDocument) => !!d && LANGS.has(d.languageId) && d.uri.scheme !== 'output'

function ensurePanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  if (panel) return panel
  panel = vscode.window.createWebviewPanel(
    'pseudoView',
    'Pseudo code',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true },
  )
  panel.webview.html = html()
  panel.onDidDispose(() => {
    if (current) dismissed.add(current.uri.toString())
    panel = undefined
  }, null, context.subscriptions)
  panel.webview.onDidReceiveMessage(
    async (m: { type: string; line: number; index: number }) => {
      if (m.type === 'explain') return void explainOne(context, m.index)
      if (m.type === 'summarizeFile') return void summarizeCurrent(context)
      if (m.type === 'explainAll') return void Promise.all(fns.map((_, i) => explainOne(context, i)))
      if (m.type !== 'reveal' || !current) return
      const editor = await vscode.window.showTextDocument(current, { viewColumn: vscode.ViewColumn.One, preserveFocus: false })
      const pos = new vscode.Position(m.line, 0)
      editor.selection = new vscode.Selection(pos, pos)
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop)
    },
    null,
    context.subscriptions,
  )
  return panel
}

function refresh(doc: vscode.TextDocument | undefined, open: boolean, context: vscode.ExtensionContext) {
  if (!supported(doc)) return
  current = doc
  try {
    fns = extractFunctions(doc!.getText(), doc!.fileName)
  } catch {
    fns = []
  }
  if (!panel) {
    const auto = vscode.workspace.getConfiguration('pseudoView').get<boolean>('autoOpen', true)
    if (!open && (!auto || fns.length === 0 || dismissed.has(doc!.uri.toString()))) return
    ensurePanel(context)
  }
  panel!.title = `Pseudo: ${doc!.fileName.split(/[\\/]/).pop()}`
  const text = doc!.getText()
  let overview: ReturnType<typeof fileOverview> = []
  try {
    overview = fileOverview(text, doc!.fileName, fns)
  } catch {
    // the overview is a bonus; the function cards still show
  }
  void panel!.webview.postMessage({
    type: 'update',
    file: doc!.fileName.split(/[\\/]/).pop(),
    overview,
    fileAi: fileAi.get(text) ?? null,
    fileBusy: inFlight.has(text),
    fns: fns.map(f => ({ name: f.name, startLine: f.startLine, endLine: f.endLine, source: f.source, pseudo: f.pseudo, hybrid: f.hybrid, classic: f.classic, ai: aiCache.get(f.source) ?? null, busy: inFlight.has(f.source) })),
  })
  highlight()
}

async function apiKey(context: vscode.ExtensionContext, ask: boolean): Promise<string | undefined> {
  const saved = await context.secrets.get(KEY)
  if (saved || !ask) return saved
  const entered = await vscode.window.showInputBox({
    title: 'Anthropic API key',
    prompt: 'Needed for "Explain with Claude". Your function code is sent to the Anthropic API. The key is kept in VS Code secret storage.',
    password: true,
    ignoreFocusOut: true,
  })
  if (entered) await context.secrets.store(KEY, entered.trim())
  return entered?.trim()
}

async function explainOne(context: vscode.ExtensionContext, index: number) {
  const fn = fns[index]
  if (!fn || aiCache.has(fn.source) || inFlight.has(fn.source)) return
  const key = await apiKey(context, true)
  if (!key) return
  const model = vscode.workspace.getConfiguration('pseudoView').get<string>('model', 'claude-haiku-5-5')
  inFlight.add(fn.source)
  refresh(current, false, context)
  try {
    aiCache.set(fn.source, await explain(key, model, fn.source))
  } catch (err) {
    void vscode.window.showErrorMessage(`Pseudo View: ${(err as Error).message}`)
  } finally {
    inFlight.delete(fn.source)
    refresh(current, false, context)
  }
}

async function summarizeCurrent(context: vscode.ExtensionContext) {
  const doc = current
  if (!doc) return
  const text = doc.getText()
  if (fileAi.has(text) || inFlight.has(text)) return
  const key = await apiKey(context, true)
  if (!key) return
  const model = vscode.workspace.getConfiguration('pseudoView').get<string>('model', 'claude-haiku-5-5')
  inFlight.add(text)
  refresh(current, false, context)
  try {
    fileAi.set(text, await summarizeFile(key, model, doc.fileName.split(/[\\/]/).pop()!, text))
  } catch (err) {
    void vscode.window.showErrorMessage(`Pseudo View: ${(err as Error).message}`)
  } finally {
    inFlight.delete(text)
    refresh(current, false, context)
  }
}

function highlight() {
  const ed = vscode.window.activeTextEditor
  if (!panel || !ed || ed.document !== current) return
  const line = ed.selection.active.line
  // innermost function (latest start) that contains the cursor
  let idx = -1
  fns.forEach((f, i) => {
    if (line >= f.startLine && line <= f.endLine) idx = i
  })
  void panel.webview.postMessage({ type: 'active', index: idx })
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('pseudoView.open', () => {
      const doc = vscode.window.activeTextEditor?.document
      if (!supported(doc)) {
        void vscode.window.showInformationMessage('Open a TypeScript/TSX file first.')
        return
      }
      dismissed.delete(doc!.uri.toString())
      refresh(doc, true, context)
    }),
    vscode.commands.registerCommand('pseudoView.toggleAuto', async () => {
      const cfg = vscode.workspace.getConfiguration('pseudoView')
      const next = !cfg.get<boolean>('autoOpen', true)
      await cfg.update('autoOpen', next, vscode.ConfigurationTarget.Global)
      void vscode.window.showInformationMessage(`Pseudo View auto-open: ${next ? 'on' : 'off'}`)
    }),
    vscode.commands.registerCommand('pseudoView.setApiKey', async () => {
      await context.secrets.delete(KEY)
      await apiKey(context, true)
    }),
    // follow whichever file is open
    vscode.window.onDidChangeActiveTextEditor(ed => refresh(ed?.document, false, context)),
    // keep the translation live while typing
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document !== current || !panel) return
      clearTimeout(timer)
      timer = setTimeout(() => refresh(e.document, false, context), 300)
    }),
    // follow the cursor
    vscode.window.onDidChangeTextEditorSelection(() => highlight()),
  )
  refresh(vscode.window.activeTextEditor?.document, false, context)
}

export function deactivate() {
  clearTimeout(timer)
}

function html(): string {
  const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  return /* html */ `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 12px 40px; }
  h2 { font-size: 13px; font-weight: 600; opacity: .7; margin: 12px 0; }
  .empty { opacity: .6; margin-top: 20px; }
  .card { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin-bottom: 14px; overflow: hidden; }
  .card.active { border-color: var(--vscode-focusBorder); box-shadow: 0 0 0 1px var(--vscode-focusBorder); }
  .head { display: flex; justify-content: space-between; align-items: center; cursor: pointer;
          padding: 6px 10px; background: var(--vscode-editorWidget-background); font-weight: 600; }
  .head small { font-weight: 400; opacity: .6; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; }
  .col { min-width: 0; padding: 8px 10px; }
  .col + .col { border-left: 1px solid var(--vscode-panel-border); }
  .bar { position: sticky; top: 0; z-index: 1; background: var(--vscode-editor-background);
         display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 0; }
  #file { font-size: 13px; font-weight: 600; opacity: .7; }
  .switch { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; user-select: none; margin-left: auto; }
  .switch input { display: none; }
  .slider { position: relative; width: 28px; height: 16px; border-radius: 8px; background: var(--vscode-input-background);
            border: 1px solid var(--vscode-panel-border); transition: background .15s; }
  .slider::after { content: ''; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%;
                   background: var(--vscode-foreground); opacity: .6; transition: transform .15s; }
  .switch input:checked + .slider { background: var(--vscode-button-background); }
  .switch input:checked + .slider::after { transform: translateX(12px); background: var(--vscode-button-foreground); opacity: 1; }
  body.nocode .src { display: none; }
  body.nocode .cols { grid-template-columns: 1fr; }
  body.nocode .col + .col { border-left: 0; border-top: 0; }
  .tabs { display: flex; border: 1px solid var(--vscode-panel-border); border-radius: 6px; overflow: hidden; }
  .tab { background: transparent; color: var(--vscode-foreground); border: 0; padding: 4px 12px; cursor: pointer; font-size: 12px; opacity: .75; }
  .tab + .tab { border-left: 1px solid var(--vscode-panel-border); }
  .tab:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
  .tab.on { opacity: 1; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .ex.big { float: none; margin-top: 6px; padding: 6px 12px; font-size: 12px; }
  .ex.all { float: none; margin-bottom: 12px; padding: 5px 12px; font-size: 12px; }
  .label { font-size: 10px; letter-spacing: .08em; opacity: .55; margin-bottom: 4px; }
  pre { margin: 0; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); line-height: 1.55;
        white-space: pre-wrap; word-break: break-word; }
  .src pre { opacity: .85; max-height: 420px; overflow: auto; }
  .ln { display: block; }
  .ex { float: right; font-size: 11px; padding: 1px 8px; border-radius: 4px; cursor: pointer; letter-spacing: 0;
        color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border: 0; }
  .ex:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .num { opacity: .55; }
  #about { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin-bottom: 16px; padding: 0 12px 10px;
           background: var(--vscode-editorWidget-background); }
  #about summary { cursor: pointer; font-weight: 600; padding: 8px 0; }
  #about .row { margin: 6px 0; line-height: 1.5; }
  #about ul { margin: 2px 0 0; padding-left: 20px; }
  #about li { margin: 1px 0; }
  .ai-sum { margin: 4px 0 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--vscode-panel-border); }
  .tip-head { margin-top: 14px; padding-top: 8px; border-top: 1px dashed var(--vscode-panel-border); }
  .tip { font-family: var(--vscode-font-family); font-size: 12px; opacity: .85; margin: 3px 0; padding-left: 1.4em; text-indent: 0; }
  .tip .kw { color: var(--vscode-textLink-foreground); }
  .spin { opacity: .7; font-style: italic; }
  .kw { color: var(--vscode-symbolIcon-keywordForeground, #c586c0); font-weight: 600; }
  @media (max-width: 520px) { .cols { grid-template-columns: 1fr; } .col + .col { border-left: 0; border-top: 1px solid var(--vscode-panel-border); } }
</style></head>
<body>
<div class="bar">
  <span id="file"></span>
  <label class="switch" title="Hide the code column when the real file is open next to the panel">
    <input type="checkbox" id="showCode"><span class="slider"></span> Show code
  </label>
  <div class="tabs" role="tablist">
    <button class="tab" data-tab="english">In English</button>
    <button class="tab" data-tab="hybrid">Pseudo English</button>
    <button class="tab" data-tab="classic">Pseudo code</button>
    <button class="tab" data-tab="claude">✨ Claude</button>
  </div>
</div>
<details id="about" open>
  <summary>📄 About this file</summary>
  <div id="aboutBody"></div>
</details>
<div id="list"></div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi()
  const LABELS = { english: 'IN ENGLISH', hybrid: 'PSEUDO ENGLISH', classic: 'PSEUDO CODE', claude: 'CLAUDE EXPLANATION' }
  const saved = vscode.getState() || {}
  let tab = saved.tab || 'english'
  let showCode = saved.showCode !== false
  const save = () => vscode.setState({ tab, showCode })
  const codeToggle = document.getElementById('showCode')
  codeToggle.checked = showCode
  document.body.classList.toggle('nocode', !showCode)
  codeToggle.addEventListener('change', () => {
    showCode = codeToggle.checked
    document.body.classList.toggle('nocode', !showCode)
    save()
  })
  let last = null
  let activeIndex = -1
  let cards = []
  function esc(s) { return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) }
  function linesHtml(lines) {
    return lines.map(l => {
      const num = l.num ? '<span class="num">' + l.num + '.</span> ' : ''
      const kw = l.kw ? '<span class="kw">' + esc(l.kw) + '</span>' : ''
      const cls = l.tip ? (l.indent ? 'ln tip' : 'ln tip-head') : 'ln'
      return '<span class="' + cls + '" style="padding-left:' + l.indent * 1.4 + 'em">' + num + kw + esc(l.text) + '</span>'
    }).join('')
  }
  function aiHtml(text) {
    return text.split('\\n').map(line => {
      const lead = line.match(/^ */)[0].length
      const m = line.trim().match(/^(Purpose:|Result:|How it works:|Key parts:|[0-9.]+)\\s*(.*)$/)
      const body = m ? '<span class="kw">' + esc(m[1]) + '</span> ' + esc(m[2]) : esc(line.trim())
      return '<span class="ln" style="padding-left:' + (lead / 2) * 1.4 + 'em">' + body + '</span>'
    }).join('')
  }
  function rightCol(f, i) {
    if (tab === 'claude') {
      if (f.busy) return '<div class="label">CLAUDE EXPLAINS…</div><div class="spin">Thinking about this function…</div>'
      if (f.ai) return '<div class="label">' + LABELS.claude + '</div><pre>' + aiHtml(f.ai) + '</pre>'
      return '<div class="label">' + LABELS.claude + '</div><button class="ex big" data-i="' + i + '">✨ Explain this function with Claude</button>'
    }
    const lines = tab === 'hybrid' ? f.hybrid : tab === 'classic' ? f.classic : f.pseudo
    return '<div class="label">' + LABELS[tab] + '</div><pre>' + linesHtml(lines) + '</pre>'
  }
  function aboutHtml(m) {
    let h = ''
    if (m.fileBusy) h += '<div class="spin">Claude is reading the whole file…</div>'
    else if (m.fileAi) h += '<div class="ai-sum"><div class="label">CLAUDE’S SUMMARY</div><pre>' + aiHtml(m.fileAi) + '</pre></div>'
    h += (m.overview || []).map(r =>
      '<div class="row"><span class="kw">' + esc(r.label) + '</span>' + (r.text ? ' ' + esc(r.text) : '') +
      (r.items ? '<ul>' + r.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '') + '</div>').join('')
    if (!m.fileAi && !m.fileBusy) h += '<button class="ex big" id="sumFile">✨ Ask Claude what this file does</button>'
    return h
  }
  function render() {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab))
    if (!last) return
    document.getElementById('file').textContent = last.file
    document.getElementById('aboutBody').innerHTML = aboutHtml(last)
    const sum = document.getElementById('sumFile')
    if (sum) sum.addEventListener('click', () => vscode.postMessage({ type: 'summarizeFile' }))
    const list = document.getElementById('list')
    if (!last.fns.length) { list.innerHTML = '<div class="empty">No functions found in this file.</div>'; cards = []; return }
    const explainAll = tab === 'claude' && last.fns.some(f => !f.ai && !f.busy)
      ? '<button class="ex all" id="all">✨ Explain all with Claude</button>' : ''
    list.innerHTML = explainAll + last.fns.map((f, i) =>
      '<div class="card" id="c' + i + '"><div class="head" data-line="' + f.startLine + '"><span>' + esc(f.name) +
      '</span><small>lines ' + (f.startLine + 1) + '–' + (f.endLine + 1) + '</small></div>' +
      '<div class="cols"><div class="col src"><div class="label">CODE</div><pre>' + esc(f.source) + '</pre></div>' +
      '<div class="col">' + rightCol(f, i) + '</div></div></div>').join('')
    cards = [...list.querySelectorAll('.card')]
    const all = document.getElementById('all')
    if (all) all.addEventListener('click', () => vscode.postMessage({ type: 'explainAll' }))
    list.querySelectorAll('.ex[data-i]').forEach(b => b.addEventListener('click', () =>
      vscode.postMessage({ type: 'explain', index: Number(b.dataset.i) })))
    list.querySelectorAll('.head').forEach(h => h.addEventListener('click', () =>
      vscode.postMessage({ type: 'reveal', line: Number(h.dataset.line) })))
    markActive(false)
  }
  function markActive(scroll) {
    cards.forEach((c, i) => c.classList.toggle('active', i === activeIndex))
    if (scroll && activeIndex >= 0 && cards[activeIndex]) cards[activeIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    tab = b.dataset.tab
    save()
    render()
  }))
  render()
  window.addEventListener('message', ev => {
    const m = ev.data
    if (m.type === 'update') { last = m; render() }
    else if (m.type === 'active') { activeIndex = m.index; markActive(true) }
  })
</script></body></html>`
}

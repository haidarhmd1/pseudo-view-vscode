import * as ts from 'typescript'
import { CONCEPTS, detectConcepts } from './concepts'

/** One line of the English translation. `kw` is the lead phrase, drawn bold. */
export type PseudoLine = { indent: number; kw?: string; text: string; num?: number; tip?: boolean }
export type FnInfo = {
  name: string
  startLine: number // 0-based
  endLine: number
  source: string
  pseudo: PseudoLine[] // "In English"
  hybrid: PseudoLine[] // "Pseudo English": FUNCTION f(x) / 1. IF … THEN
  classic: PseudoLine[] // "Pseudo code": IF … THEN / END IF
}

const BIN: Record<number, string> = {
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: 'is equal to',
  [ts.SyntaxKind.EqualsEqualsToken]: 'is equal to',
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: 'is not equal to',
  [ts.SyntaxKind.ExclamationEqualsToken]: 'is not equal to',
  [ts.SyntaxKind.AmpersandAmpersandToken]: 'and',
  [ts.SyntaxKind.BarBarToken]: 'or',
  [ts.SyntaxKind.GreaterThanToken]: 'is greater than',
  [ts.SyntaxKind.GreaterThanEqualsToken]: 'is at least',
  [ts.SyntaxKind.LessThanToken]: 'is less than',
  [ts.SyntaxKind.LessThanEqualsToken]: 'is at most',
  [ts.SyntaxKind.PlusToken]: 'plus',
  [ts.SyntaxKind.MinusToken]: 'minus',
  [ts.SyntaxKind.AsteriskToken]: 'times',
  [ts.SyntaxKind.SlashToken]: 'divided by',
  [ts.SyntaxKind.PercentToken]: 'remainder after dividing by',
  [ts.SyntaxKind.InstanceOfKeyword]: 'is an instance of',
  [ts.SyntaxKind.InKeyword]: 'is a key of',
}

const clip = (s: string, n = 80) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? one.slice(0, n - 1) + '…' : one
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function extractFunctions(text: string, fileName: string): FnInfo[] {
  const kind = /\.tsx$/i.test(fileName)
    ? ts.ScriptKind.TSX
    : /\.jsx$/i.test(fileName)
      ? ts.ScriptKind.JSX
      : /\.jsx?$/i.test(fileName)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
  const out: FnInfo[] = []
  const t = (n: ts.Node) => n.getText(sf)

  // ---- expressions: noun phrases -----------------------------------------
  function name(n: ts.Node): string {
    if (ts.isObjectBindingPattern(n)) return list(n.elements.map(e => (t(e.name))))
    if (ts.isArrayBindingPattern(n)) return list(n.elements.map(e => (ts.isOmittedExpression(e) ? 'an unused item' : (t(e.name)))))
    return (t(n))
  }

  function ex(n: ts.Node | undefined): string {
    if (!n) return ''
    if (ts.isParenthesizedExpression(n)) return ex(n.expression)
    if (ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n)) return ex(n.expression)
    if (ts.isIdentifier(n)) return n.text === 'undefined' ? 'nothing' : (n.text)
    if (n.kind === ts.SyntaxKind.ThisKeyword) return 'this object'
    if (n.kind === ts.SyntaxKind.NullKeyword) return 'nothing'
    if (n.kind === ts.SyntaxKind.TrueKeyword) return 'true'
    if (n.kind === ts.SyntaxKind.FalseKeyword) return 'false'
    if (ts.isNumericLiteral(n)) return n.text
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return `"${clip(n.text, 40)}"`
    if (ts.isAwaitExpression(n)) return `the result of waiting for ${ex(n.expression)}`
    if (ts.isTypeOfExpression(n)) return `the type of ${ex(n.expression)}`
    if (ts.isPrefixUnaryExpression(n)) {
      if (n.operator === ts.SyntaxKind.ExclamationToken) {
        const inner = n.operand
        if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.ExclamationToken) return `${ex(inner.operand)} has a value`
        return `not ${ex(inner)}`
      }
      if (n.operator === ts.SyntaxKind.MinusToken) return `minus ${ex(n.operand)}`
      return clip(t(n))
    }
    if (ts.isBinaryExpression(n)) {
      if (n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return `${ex(n.left)} (or ${ex(n.right)} if that is missing)`
      const op = BIN[n.operatorToken.kind]
      return op ? `${ex(n.left)} ${op} ${ex(n.right)}` : clip(t(n))
    }
    if (ts.isConditionalExpression(n)) return `(${ex(n.whenTrue)} if ${ex(n.condition)}, otherwise ${ex(n.whenFalse)})`
    if (ts.isCallExpression(n)) return callNoun(n)
    if (ts.isNewExpression(n)) return `a brand-new ${t(n.expression)}${n.arguments?.length ? ` built from ${list(n.arguments.map(ex))}` : ''}`
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      const ps = n.parameters.map(p => name(p.name))
      const takes = ps.length ? `takes ${list(ps)}` : 'takes nothing'
      return ts.isBlock(n.body) ? `a small function that ${takes}` : `a small function that ${takes} and gives back ${ex(n.body)}`
    }
    if (ts.isObjectLiteralExpression(n))
      return n.properties.length
        ? `a new object with the fields ${list(n.properties.map(p => (p.name ? t(p.name) : ts.isSpreadAssignment(p) ? `everything from ${ex(p.expression)}` : 'more')).slice(0, 5))}`
        : 'a new, empty object'
    if (ts.isArrayLiteralExpression(n)) return n.elements.length ? `a new list containing ${list(n.elements.map(ex).slice(0, 5))}` : 'a new, empty list'
    if (ts.isJsxElement(n)) return jsx(n.openingElement.tagName, n.children)
    if (ts.isJsxSelfClosingElement(n)) return jsx(n.tagName, [])
    if (ts.isJsxFragment(n)) return jsx(undefined, n.children)
    if (ts.isTemplateExpression(n)) {
      const parts = [`"${n.head.text}"`, ...n.templateSpans.flatMap(s => [ex(s.expression), s.literal.text ? `"${s.literal.text}"` : ''])].filter(Boolean)
      return `the text ${parts.join(' followed by ')}`
    }
    if (ts.isElementAccessExpression(n)) return `the item at ${ex(n.argumentExpression)} in ${ex(n.expression)}`
    if (ts.isPropertyAccessExpression(n)) {
      const prop = t(n.name)
      if (prop === 'length') return `the number of items in ${ex(n.expression)}`
      const obj = ex(n.expression)
      const known: Record<string, string> = {
        ok: `${obj} was successful`,
        status: `the status code of ${obj}`,
        message: `the error message of ${obj}`,
        value: `the value of ${obj}`,
      }
      const phrase = known[prop] ?? `the ${(prop)} of ${obj}`
      return n.questionDotToken ? `${phrase} (if ${obj} exists)` : phrase
    }
    if (ts.isSpreadElement(n)) return `everything in ${ex(n.expression)}`
    return clip(t(n))
  }

  function jsx(tag: ts.Node | undefined, children: readonly ts.JsxChild[]): string {
    const label = tag ? `<${t(tag)}>` : 'a group of elements'
    const shown = children
      .map(c => (ts.isJsxExpression(c) && c.expression ? ex(c.expression) : ts.isJsxText(c) && c.text.trim() ? `"${clip(c.text, 30)}"` : ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c) ? ex(c) : ''))
      .filter(Boolean)
    return tag ? `a ${label} element${shown.length ? ` showing ${list(shown.slice(0, 4))}` : ''}` : `${label}${shown.length ? ` showing ${list(shown.slice(0, 4))}` : ''}`
  }

  const CONSOLE: Record<string, string> = { log: 'prints', info: 'prints', warn: 'prints a warning with', error: 'prints an error with', debug: 'prints' }

  /** [verb phrase, noun phrase] for a call */
  function callParts(n: ts.CallExpression): [string, string] {
    const args = n.arguments.map(ex)
    const a0 = args[0] ?? 'nothing'
    const c = n.expression
    if (ts.isPropertyAccessExpression(c)) {
      const obj = ex(c.expression)
      const m = t(c.name)
      const o = t(c.expression)
      if (o === 'console') return [`Print ${list(args)} to the console`, `the act of printing ${list(args)}`]
      if (o === 'JSON' && m === 'parse') return [`Convert the JSON text ${a0} into data`, `${a0} converted from JSON text into data`]
      if (o === 'JSON' && m === 'stringify') return [`Convert ${a0} into JSON text`, `${a0} converted into JSON text`]
      if (o === 'Math') return [`Calculate Math.${m} of ${list(args)}`, `${(m)} of ${list(args)}`]
      if (o === 'Promise' && m === 'all') return [`Wait for all of ${a0} to finish together`, `all of ${a0} finished together`]
      // a one-line callback reads as its own rule: "x is greater than 0"
      const a = n.arguments[0]
      const rule = a && (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) && !ts.isBlock(a.body) ? ex(a.body) : undefined
      if (rule) {
        const R: Record<string, [string, string]> = {
          filter: [`Keep only the items of ${obj} where ${rule}`, `the items of ${obj} where ${rule}`],
          find: [`Find the first item of ${obj} where ${rule}`, `the first item of ${obj} where ${rule}`],
          some: [`Check whether ${rule} for at least one item of ${obj}`, `whether ${rule} for at least one item of ${obj}`],
          every: [`Check whether ${rule} for every item of ${obj}`, `whether ${rule} for every item of ${obj}`],
          map: [`Turn each item of ${obj} into ${rule}`, `each item of ${obj} turned into ${rule}`],
          reduce: [
            `Combine ${obj} into one value${args[1] ? `, starting from ${args[1]}` : ''}, each time working out ${rule}`,
            `${obj} combined into one value${args[1] ? ` (starting from ${args[1]}, each time working out ${rule})` : ` (each time working out ${rule})`}`,
          ],
        }
        if (R[m]) return R[m]
      }
      const T: Record<string, [string, string]> = {
        map: [`Transform each item of ${obj} using ${a0}`, `each item of ${obj} transformed using ${a0}`],
        filter: [`Keep only the items of ${obj} that pass ${a0}`, `the items of ${obj} that pass ${a0}`],
        find: [`Find the first item of ${obj} that matches ${a0}`, `the first item of ${obj} that matches ${a0}`],
        some: [`Check whether any item of ${obj} matches ${a0}`, `whether any item of ${obj} matches ${a0}`],
        every: [`Check whether every item of ${obj} matches ${a0}`, `whether every item of ${obj} matches ${a0}`],
        reduce: [`Combine all items of ${obj} into one value using ${a0}`, `all items of ${obj} combined into one value using ${a0}`],
        includes: [`Check whether ${obj} contains ${a0}`, `whether ${obj} contains ${a0}`],
        join: [`Join the items of ${obj} into one text${args.length ? ` separated by ${a0}` : ''}`, `the items of ${obj} joined into one text`],
        push: [`Add ${list(args)} to the end of ${obj}`, `${obj} with ${list(args)} added`],
        slice: [`Take a part of ${obj} from ${args.join(' to ')}`, `a part of ${obj} from ${args.join(' to ')}`],
        sort: [`Sort ${obj}`, `${obj} sorted`],
        trim: [`Remove the spaces around ${obj}`, `${obj} without surrounding spaces`],
        toUpperCase: [`Make ${obj} all capitals`, `${obj} in capitals`],
        toLowerCase: [`Make ${obj} all lowercase`, `${obj} in lowercase`],
        split: [`Split ${obj} at ${a0}`, `${obj} split at ${a0}`],
        then: [`When ${obj} finishes, run ${a0}`, `${obj}, followed by ${a0}`],
        json: [`Read the body of ${obj} as data`, `the body of ${obj} read as data`],
        delete: [`Remove ${a0} from ${obj}`, `${obj} without ${a0}`],
        set: [`Store ${args.join(' as ')} in ${obj}`, `${obj} with ${args.join(' as ')} stored`],
        get: [`Look up ${a0} in ${obj}`, `the value for ${a0} in ${obj}`],
      }
      if (T[m]) return T[m]
      return [`Call ${m} on ${obj}${args.length ? ` with ${list(args)}` : ''}`, `the result of calling ${m} on ${obj}${args.length ? ` with ${list(args)}` : ''}`]
    }
    const f = t(c)
    if (f === 'fetch') return [`Request data from ${a0}`, `the response from requesting ${a0}`]
    if (/^set[A-Z]/.test(f)) return [`Call ${f} to change the state to ${a0}`, `the state changed to ${a0} (via ${f})`]
    if (f === 'useState') return [`Create a remembered value starting at ${a0}`, `a remembered value starting at ${a0}`]
    if (f === 'useEffect') return [`Run a side effect after the screen updates`, `a side effect after the screen updates`]
    if (f === 'useMemo' || f === 'useCallback') return [`Remember a calculation so it is not repeated needlessly`, `a remembered calculation`]
    if (f === 'parseInt' || f === 'Number') return [`Turn ${a0} into a number`, `${a0} as a number`]
    if (f === 'String') return [`Turn ${a0} into text`, `${a0} as text`]
    const h = f
    return [`Run ${h}${args.length ? ` using ${list(args)}` : ''}`, `the result of ${h}${args.length ? ` using ${list(args)}` : ''}`]
  }
  const callNoun = (n: ts.CallExpression) => callParts(n)[1]
  const callVerb = (n: ts.CallExpression) => callParts(n)[0]

  // ---- statements: sentences ---------------------------------------------
  const L = (indent: number, text: string, kw?: string): PseudoLine => ({ indent, kw, text })

  function body(s: ts.Statement | undefined, indent: number, lines: PseudoLine[]) {
    if (!s) return
    if (ts.isBlock(s)) for (const x of s.statements) stmt(x, indent, lines)
    else stmt(s, indent, lines)
  }

  function nestedCallback(call: ts.CallExpression): ts.ArrowFunction | ts.FunctionExpression | undefined {
    const last = call.arguments[call.arguments.length - 1]
    if (last && (ts.isArrowFunction(last) || ts.isFunctionExpression(last)) && ts.isBlock(last.body)) return last
    return undefined
  }

  const bare = (n: ts.Node) => n.kind === ts.SyntaxKind.VariableDeclarationList ? t(n).replace(/^(const|let|var)\s+/, '') : t(n)

  function stmt(s: ts.Node, indent: number, lines: PseudoLine[]) {
    const push = (text: string, kw?: string, d = indent) => lines.push(L(d, text, kw))

    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const nm = name(d.name)
        const init = d.initializer
        if (!init) push(` a variable called ${nm}, with no value yet.`, 'Prepare')
        else if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && ts.isBlock(init.body)) push(` a helper step called ${nm}, to use later.`, 'Define')
        else if (ts.isAwaitExpression(init)) {
          const inner = init.expression
          push(` for ${ts.isCallExpression(inner) ? callNoun(inner) : ex(inner)} to finish, and keep the result as ${nm}.`, 'Wait')
        } else if (
          ts.isArrayBindingPattern(d.name) && d.name.elements.length === 2 &&
          ts.isCallExpression(init) && /^(React\.)?useState$/.test(t(init.expression))
        ) {
          // const [count, setCount] = useState(0)
          const [v, setter] = d.name.elements.map(e => (ts.isOmittedExpression(e) ? '' : t(e.name)))
          push(` a state value ${v}, starting at ${ex(init.arguments[0]) || 'nothing'}. Use ${setter} to change it (that redraws the screen).`, 'Create')
        } else if (ts.isObjectBindingPattern(d.name) || ts.isArrayBindingPattern(d.name)) push(` ${nm} out of ${ex(init)}.`, 'Pull')
        else {
          const v = ex(init)
          if (v.length > 70) push(` ${nm}: ${v}.`, 'Work out')
          else push(` ${v} as ${nm}.`, 'Store')
        }
      }
    } else if (ts.isReturnStatement(s)) {
      push(s.expression ? ` ${ex(s.expression)}.` : ' nothing and finish.', 'Give back')
    } else if (ts.isIfStatement(s)) {
      push(` ${ex(s.expression)}, then:`, 'If')
      body(s.thenStatement, indent + 1, lines)
      let e = s.elseStatement
      while (e && ts.isIfStatement(e)) {
        push(` if ${ex(e.expression)}, then:`, 'Otherwise,')
        body(e.thenStatement, indent + 1, lines)
        e = e.elseStatement
      }
      if (e) {
        push(':', 'Otherwise')
        body(e, indent + 1, lines)
      }
    } else if (ts.isForOfStatement(s)) {
      push(` ${name(ts.isVariableDeclarationList(s.initializer) ? s.initializer.declarations[0].name : s.initializer)} in ${ex(s.expression)}, do the following:`, 'For each')
      body(s.statement, indent + 1, lines)
    } else if (ts.isForInStatement(s)) {
      push(` name (${(bare(s.initializer))}) in ${ex(s.expression)}, do the following:`, 'For each')
      body(s.statement, indent + 1, lines)
    } else if (ts.isForStatement(s)) {
      const start = s.initializer ? `Start with ${(bare(s.initializer))}. ` : ''
      push(` ${start}Keep repeating while ${s.condition ? ex(s.condition) : 'forever'}${s.incrementor ? `; after each round, ${incText(s.incrementor)}` : ''}:`, 'Loop:')
      body(s.statement, indent + 1, lines)
    } else if (ts.isWhileStatement(s)) {
      push(` ${ex(s.expression)}, keep repeating:`, 'As long as')
      body(s.statement, indent + 1, lines)
    } else if (ts.isDoStatement(s)) {
      push(' the following once, then repeat it while the condition holds:', 'Do')
      body(s.statement, indent + 1, lines)
      push(` ${ex(s.expression)}.`, 'Repeat while')
    } else if (ts.isSwitchStatement(s)) {
      push(` ${ex(s.expression)} and choose the matching case:`, 'Look at')
      for (const c of s.caseBlock.clauses) {
        if (ts.isCaseClause(c)) push(` it is ${ex(c.expression)}:`, 'When', indent + 1)
        else push(':', 'In any other case', indent + 1)
        for (const x of c.statements) stmt(x, indent + 2, lines)
      }
    } else if (ts.isTryStatement(s)) {
      push(' the following, and be ready for something to go wrong:', 'Try')
      body(s.tryBlock, indent + 1, lines)
      if (s.catchClause) {
        const v = s.catchClause.variableDeclaration
        push(`${v ? ` (call the problem ${name(v.name)})` : ''}:`, 'If something goes wrong', indent)
        body(s.catchClause.block, indent + 1, lines)
      }
      if (s.finallyBlock) {
        push(', whether it worked or not:', 'Finally', indent)
        body(s.finallyBlock, indent + 1, lines)
      }
    } else if (ts.isThrowStatement(s)) {
      push(` with the error ${ex(s.expression)}.`, 'Stop and fail')
    } else if (ts.isBreakStatement(s)) {
      push(' repeating and move on.', 'Stop')
    } else if (ts.isContinueStatement(s)) {
      push(' the rest of this round and go to the next one.', 'Skip')
    } else if (ts.isBlock(s)) {
      for (const x of s.statements) stmt(x, indent, lines)
    } else if (ts.isFunctionDeclaration(s)) {
      push(` a helper step called ${s.name ? (t(s.name)) : 'unnamed'}, to use later.`, 'Define')
    } else if (ts.isExpressionStatement(s)) {
      expressionStmt(s.expression, indent, lines)
    }
  }

  function incText(e: ts.Expression): string {
    if (ts.isPostfixUnaryExpression(e) || ts.isPrefixUnaryExpression(e)) {
      if (e.operator === ts.SyntaxKind.PlusPlusToken) return `increase ${ex(e.operand)} by 1`
      if (e.operator === ts.SyntaxKind.MinusMinusToken) return `decrease ${ex(e.operand)} by 1`
    }
    return clip(t(e))
  }

  function expressionStmt(e: ts.Expression, indent: number, lines: PseudoLine[]) {
    const push = (text: string, kw?: string) => lines.push(L(indent, text, kw))
    if (ts.isParenthesizedExpression(e)) return expressionStmt(e.expression, indent, lines)
    if (ts.isAwaitExpression(e)) {
      const inner = e.expression
      return push(` for ${ts.isCallExpression(inner) ? callNoun(inner) : ex(inner)} to finish.`, 'Wait')
    }
    if (ts.isBinaryExpression(e)) {
      const k = e.operatorToken.kind
      if (k === ts.SyntaxKind.EqualsToken) return push(` ${ex(e.left)} to ${ex(e.right)}.`, 'Change')
      if (k === ts.SyntaxKind.PlusEqualsToken) return push(` ${ex(e.left)} by ${ex(e.right)}.`, 'Increase')
      if (k === ts.SyntaxKind.MinusEqualsToken) return push(` ${ex(e.left)} by ${ex(e.right)}.`, 'Decrease')
      if (k === ts.SyntaxKind.AsteriskEqualsToken) return push(` ${ex(e.left)} by ${ex(e.right)}.`, 'Multiply')
      if (k === ts.SyntaxKind.SlashEqualsToken) return push(` ${ex(e.left)} by ${ex(e.right)}.`, 'Divide')
    }
    if (ts.isPostfixUnaryExpression(e) || ts.isPrefixUnaryExpression(e)) {
      const txt = incText(e)
      if (txt !== clip(t(e))) return push(` ${txt.replace(/^\w+ /, '')}.`, cap(txt.split(' ')[0]))
    }
    if (ts.isCallExpression(e)) {
      const cb = nestedCallback(e)
      const c = e.expression
      if (cb) {
        const params = cb.parameters.map(p => name(p.name))
        if (ts.isPropertyAccessExpression(c) && t(c.name) === 'forEach') {
          push(` ${params[0] ?? 'item'} in ${ex(c.expression)}, do the following:`, 'For each')
        } else {
          const rest = e.arguments.slice(0, -1).map(ex)
          const target = ts.isPropertyAccessExpression(c) ? `${(t(c.name))} on ${ex(c.expression)}` : (t(c))
          push(` ${target}${rest.length ? `, using ${list(rest)},` : ''} and hand it a function${params.length ? ` that takes ${list(params)}` : ''}, which does this:`, 'Run')
        }
        return body(cb.body as ts.Block, indent + 1, lines)
      }
      const v = callVerb(e)
      const [first, ...rest] = v.split(' ')
      return push(` ${rest.join(' ')}.`, first)
    }
    push(clip(t(e)) + '.', 'Do')
  }

  // ---- code-style views: "Pseudo English" (hybrid) and "Pseudo code" (classic)
  type Style = 'hybrid' | 'classic'
  const SYM: Record<number, string> = {
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: '=',
    [ts.SyntaxKind.EqualsEqualsToken]: '=',
    [ts.SyntaxKind.ExclamationEqualsEqualsToken]: '≠',
    [ts.SyntaxKind.ExclamationEqualsToken]: '≠',
    [ts.SyntaxKind.AmpersandAmpersandToken]: 'AND',
    [ts.SyntaxKind.BarBarToken]: 'OR',
    [ts.SyntaxKind.QuestionQuestionToken]: 'OR ELSE',
    [ts.SyntaxKind.GreaterThanEqualsToken]: '≥',
    [ts.SyntaxKind.LessThanEqualsToken]: '≤',
    [ts.SyntaxKind.PercentToken]: 'MOD',
  }
  const WORD: Record<number, string> = {
    ...SYM,
    [ts.SyntaxKind.EqualsEqualsEqualsToken]: 'equals',
    [ts.SyntaxKind.EqualsEqualsToken]: 'equals',
    [ts.SyntaxKind.ExclamationEqualsEqualsToken]: 'does not equal',
    [ts.SyntaxKind.ExclamationEqualsToken]: 'does not equal',
    [ts.SyntaxKind.QuestionQuestionToken]: 'OR (if missing)',
    [ts.SyntaxKind.GreaterThanToken]: 'is greater than',
    [ts.SyntaxKind.GreaterThanEqualsToken]: 'is at least',
    [ts.SyntaxKind.LessThanToken]: 'is less than',
    [ts.SyntaxKind.LessThanEqualsToken]: 'is at most',
  }

  function cx(n: ts.Node | undefined, st: Style): string {
    if (!n) return ''
    if (ts.isParenthesizedExpression(n)) return `(${cx(n.expression, st)})`
    if (ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n)) return cx(n.expression, st)
    if (ts.isAwaitExpression(n)) return `${st === 'classic' ? 'AWAIT' : '(wait for)'} ${cx(n.expression, st)}`
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) return `NOT ${cx(n.operand, st)}`
    if (ts.isBinaryExpression(n)) {
      const op = (st === 'classic' ? SYM : WORD)[n.operatorToken.kind] ?? t(n.operatorToken)
      return `${cx(n.left, st)} ${op} ${cx(n.right, st)}`
    }
    if (ts.isConditionalExpression(n)) return `(IF ${cx(n.condition, st)} THEN ${cx(n.whenTrue, st)} ELSE ${cx(n.whenFalse, st)})`
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      const ps = n.parameters.map(p => t(p.name)).join(', ')
      return ts.isBlock(n.body) ? `FUNCTION(${ps})` : `(${ps}) → ${cx(n.body, st)}`
    }
    if (ts.isCallExpression(n)) return `${cx(n.expression, st)}(${n.arguments.map(a => cx(a, st)).join(', ')})`
    if (ts.isNewExpression(n)) return `NEW ${cx(n.expression, st)}(${(n.arguments ?? []).map(a => cx(a, st)).join(', ')})`
    if (ts.isPropertyAccessExpression(n)) return `${cx(n.expression, st)}.${t(n.name)}`
    if (ts.isJsxElement(n)) return `<${t(n.openingElement.tagName)}> element`
    if (ts.isJsxSelfClosingElement(n)) return `<${t(n.tagName)}> element`
    if (ts.isJsxFragment(n)) return 'a group of elements'
    if (ts.isObjectLiteralExpression(n) && n.properties.length > 3) return `{ ${n.properties.slice(0, 3).map(p => (p.name ? t(p.name) : '…')).join(', ')}, … }`
    return clip(t(n), 60)
  }

  // [keyword, rest of the line]; the keyword is drawn bold
  const KW = {
    hybrid: {
      decl: (k: string, n: string, v: string): [string, string] => [`DECLARE ${k.toUpperCase()}`, ` ${n} AS ${v}`],
      declEmpty: (k: string, n: string): [string, string] => [`DECLARE ${k.toUpperCase()}`, ` ${n} (empty for now)`],
      declFn: (n: string): [string, string] => ['DEFINE HELPER', ` ${n}`],
      await: (n: string, v: string): [string, string] => ['WAIT FOR', ` ${v}, then KEEP the result AS ${n}`],
      ret: (v: string): [string, string] => ['RETURN', v ? ` ${v}` : ' (nothing)'],
      iff: (c: string): [string, string] => ['IF', ` ${c} THEN:`],
      elif: (c: string): [string, string] => ['ELSE IF', ` ${c} THEN:`],
      els: (): [string, string] => ['ELSE', ' do:'],
      forOf: (x: string, y: string): [string, string] => ['FOR EACH', ` ${x} IN ${y}, do:`],
      forIn: (x: string, y: string): [string, string] => ['FOR EACH KEY', ` ${x} IN ${y}, do:`],
      forC: (i: string, c: string, s: string): [string, string] => ['LOOP', ` starting with ${i}, WHILE ${c}${s ? `, then ${s} each time` : ''}:`],
      whl: (c: string): [string, string] => ['WHILE', ` ${c}, keep doing:`],
      doo: (): [string, string] => ['DO', ' the following:'],
      doWhile: (c: string): [string, string] => ['REPEAT WHILE', ` ${c}`],
      sw: (v: string): [string, string] => ['CHECK', ` ${v}:`],
      cas: (v: string): [string, string] => ['CASE', ` ${v}, do:`],
      def: (): [string, string] => ['OTHERWISE', ', do:'],
      tryy: (): [string, string] => ['TRY', ' to do:'],
      cat: (e: string): [string, string] => ['IF IT FAILS', `${e ? ` (as ${e})` : ''}, do:`],
      fin: (): [string, string] => ['FINALLY', ', always do:'],
      thr: (v: string): [string, string] => ['THROW ERROR', ` ${v}`],
      brk: (): [string, string] => ['STOP', ' the loop'],
      cont: (): [string, string] => ['SKIP', ' to the next round'],
      set: (a: string, b: string): [string, string] => ['CHANGE', ` ${a} TO ${b}`],
      inc: (a: string, by: string, up: boolean): [string, string] => [up ? 'INCREASE' : 'DECREASE', ` ${a} BY ${by}`],
      call: (c: string): [string, string] => ['CALL', ` ${c}`],
      awaitCall: (c: string): [string, string] => ['WAIT FOR', ` ${c}`],
      callback: (f: string, ps: string): [string, string] => ['CALL', ` ${f} WITH A FUNCTION(${ps}) that does:`],
      each: (x: string, y: string): [string, string] => ['FOR EACH', ` ${x} IN ${y}, do:`],
    },
    classic: {
      decl: (_k: string, n: string, v: string): [string, string] => ['SET', ` ${n} ← ${v}`],
      declEmpty: (_k: string, n: string): [string, string] => ['DECLARE', ` ${n}`],
      declFn: (n: string): [string, string] => ['DEFINE', ` ${n}`],
      await: (n: string, v: string): [string, string] => ['SET', ` ${n} ← AWAIT ${v}`],
      ret: (v: string): [string, string] => ['RETURN', v ? ` ${v}` : ''],
      iff: (c: string): [string, string] => ['IF', ` ${c} THEN`],
      elif: (c: string): [string, string] => ['ELSE IF', ` ${c} THEN`],
      els: (): [string, string] => ['ELSE', ''],
      forOf: (x: string, y: string): [string, string] => ['FOR EACH', ` ${x} IN ${y} DO`],
      forIn: (x: string, y: string): [string, string] => ['FOR EACH KEY', ` ${x} IN ${y} DO`],
      forC: (i: string, c: string, s: string): [string, string] => ['FOR', ` ${i}; WHILE ${c}${s ? `; STEP ${s}` : ''} DO`],
      whl: (c: string): [string, string] => ['WHILE', ` ${c} DO`],
      doo: (): [string, string] => ['REPEAT', ''],
      doWhile: (c: string): [string, string] => ['UNTIL NOT', ` (${c})`],
      sw: (v: string): [string, string] => ['SWITCH', ` ${v}`],
      cas: (v: string): [string, string] => ['CASE', ` ${v}:`],
      def: (): [string, string] => ['DEFAULT', ':'],
      tryy: (): [string, string] => ['TRY', ''],
      cat: (e: string): [string, string] => ['CATCH', e ? ` ${e}` : ''],
      fin: (): [string, string] => ['FINALLY', ''],
      thr: (v: string): [string, string] => ['THROW', ` ${v}`],
      brk: (): [string, string] => ['BREAK', ''],
      cont: (): [string, string] => ['CONTINUE', ''],
      set: (a: string, b: string): [string, string] => ['SET', ` ${a} ← ${b}`],
      inc: (a: string, by: string, up: boolean): [string, string] => ['SET', ` ${a} ← ${a} ${up ? '+' : '-'} ${by}`],
      call: (c: string): [string, string] => ['CALL', ` ${c}`],
      awaitCall: (c: string): [string, string] => ['AWAIT', ` ${c}`],
      callback: (f: string, ps: string): [string, string] => ['CALL', ` ${f} WITH FUNCTION(${ps})`],
      each: (x: string, y: string): [string, string] => ['FOR EACH', ` ${x} IN ${y} DO`],
    },
  }
  const ENDS = { if: 'END IF', for: 'END FOR', while: 'END WHILE', switch: 'END SWITCH', try: 'END TRY', fn: 'END FUNCTION' }

  function cblock(s: ts.Statement | undefined, indent: number, lines: PseudoLine[], st: Style) {
    if (!s) return
    if (ts.isBlock(s)) for (const x of s.statements) cstmt(x, indent, lines, st)
    else cstmt(s, indent, lines, st)
  }

  function cstmt(s: ts.Node, indent: number, lines: PseudoLine[], st: Style) {
    const K = KW[st]
    const put = ([kw, text]: [string, string], d = indent) => lines.push({ indent: d, kw, text: (text.startsWith(' ') ? ' ' : '') + clip(text, 140) })
    const end = (which: keyof typeof ENDS) => st === 'classic' && lines.push({ indent, kw: ENDS[which], text: '' })
    const c = (n: ts.Node | undefined) => cx(n, st)

    if (ts.isVariableStatement(s)) {
      const kind = s.declarationList.flags & ts.NodeFlags.Const ? 'const' : s.declarationList.flags & ts.NodeFlags.Let ? 'let' : 'var'
      for (const d of s.declarationList.declarations) {
        const n = t(d.name)
        const i = d.initializer
        if (!i) put(K.declEmpty(kind, n))
        else if ((ts.isArrowFunction(i) || ts.isFunctionExpression(i)) && ts.isBlock(i.body)) put(K.declFn(n))
        else if (ts.isAwaitExpression(i)) put(K.await(n, c(i.expression)))
        else put(K.decl(kind, n, c(i)))
      }
    } else if (ts.isReturnStatement(s)) put(K.ret(c(s.expression)))
    else if (ts.isIfStatement(s)) {
      put(K.iff(c(s.expression)))
      cblock(s.thenStatement, indent + 1, lines, st)
      let e = s.elseStatement
      while (e && ts.isIfStatement(e)) {
        put(K.elif(c(e.expression)))
        cblock(e.thenStatement, indent + 1, lines, st)
        e = e.elseStatement
      }
      if (e) {
        put(K.els())
        cblock(e, indent + 1, lines, st)
      }
      end('if')
    } else if (ts.isForOfStatement(s) || ts.isForInStatement(s)) {
      const x = ts.isVariableDeclarationList(s.initializer) ? t(s.initializer.declarations[0].name) : t(s.initializer)
      put(ts.isForOfStatement(s) ? K.forOf(x, c(s.expression)) : K.forIn(x, c(s.expression)))
      cblock(s.statement, indent + 1, lines, st)
      end('for')
    } else if (ts.isForStatement(s)) {
      const i = s.initializer ? bare(s.initializer) : ''
      put(K.forC(clip(i, 40), s.condition ? c(s.condition) : 'TRUE', s.incrementor ? clip(t(s.incrementor), 30) : ''))
      cblock(s.statement, indent + 1, lines, st)
      end('for')
    } else if (ts.isWhileStatement(s)) {
      put(K.whl(c(s.expression)))
      cblock(s.statement, indent + 1, lines, st)
      end('while')
    } else if (ts.isDoStatement(s)) {
      put(K.doo())
      cblock(s.statement, indent + 1, lines, st)
      put(K.doWhile(c(s.expression)))
    } else if (ts.isSwitchStatement(s)) {
      put(K.sw(c(s.expression)))
      for (const cl of s.caseBlock.clauses) {
        put(ts.isCaseClause(cl) ? K.cas(c(cl.expression)) : K.def(), indent + 1)
        for (const x of cl.statements) cstmt(x, indent + 2, lines, st)
      }
      end('switch')
    } else if (ts.isTryStatement(s)) {
      put(K.tryy())
      cblock(s.tryBlock, indent + 1, lines, st)
      if (s.catchClause) {
        put(K.cat(s.catchClause.variableDeclaration ? t(s.catchClause.variableDeclaration.name) : ''))
        cblock(s.catchClause.block, indent + 1, lines, st)
      }
      if (s.finallyBlock) {
        put(K.fin())
        cblock(s.finallyBlock, indent + 1, lines, st)
      }
      end('try')
    } else if (ts.isThrowStatement(s)) put(K.thr(c(s.expression)))
    else if (ts.isBreakStatement(s)) put(K.brk())
    else if (ts.isContinueStatement(s)) put(K.cont())
    else if (ts.isBlock(s)) for (const x of s.statements) cstmt(x, indent, lines, st)
    else if (ts.isFunctionDeclaration(s)) put(K.declFn(s.name ? t(s.name) : 'function'))
    else if (ts.isExpressionStatement(s)) {
      let e = s.expression
      while (ts.isParenthesizedExpression(e)) e = e.expression
      if (ts.isAwaitExpression(e)) return put(K.awaitCall(c(e.expression)))
      if (ts.isBinaryExpression(e)) {
        const k = e.operatorToken.kind
        if (k === ts.SyntaxKind.EqualsToken) return put(K.set(c(e.left), c(e.right)))
        if (k === ts.SyntaxKind.PlusEqualsToken || k === ts.SyntaxKind.MinusEqualsToken)
          return put(K.inc(c(e.left), c(e.right), k === ts.SyntaxKind.PlusEqualsToken))
      }
      if ((ts.isPostfixUnaryExpression(e) || ts.isPrefixUnaryExpression(e)) &&
          (e.operator === ts.SyntaxKind.PlusPlusToken || e.operator === ts.SyntaxKind.MinusMinusToken))
        return put(K.inc(c(e.operand), '1', e.operator === ts.SyntaxKind.PlusPlusToken))
      if (ts.isCallExpression(e)) {
        const cb = nestedCallback(e)
        if (cb) {
          const ps = cb.parameters.map(p => t(p.name)).join(', ')
          const callee = e.expression
          if (ts.isPropertyAccessExpression(callee) && t(callee.name) === 'forEach') {
            put(K.each(ps || 'item', c(callee.expression)))
            cblock(cb.body as ts.Block, indent + 1, lines, st)
            return end('for')
          }
          put(K.callback(c(callee), ps))
          cblock(cb.body as ts.Block, indent + 1, lines, st)
          return end('fn')
        }
        return put(K.call(c(e)))
      }
      put(['DO', ` ${c(e)}`])
    }
  }

  // the parameters exactly as written, minus their types: `id, retries = 3, ...rest`
  const paramList = (fn: ts.FunctionLikeDeclaration) =>
    fn.parameters
      .map(p => `${p.dotDotDotToken ? '...' : ''}${t(p.name)}${p.questionToken ? '?' : ''}${p.initializer ? ` = ${t(p.initializer)}` : ''}`)
      .join(', ')

  function codeView(fnName: string, fn: ts.FunctionLikeDeclaration, st: Style): PseudoLine[] {
    const params = paramList(fn)
    const isAsync = !!fn.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)
    const lines: PseudoLine[] = [{ indent: 0, kw: `${isAsync ? 'ASYNC ' : ''}FUNCTION`, text: ` ${fnName}(${params})` }]
    if (fn.body && ts.isBlock(fn.body)) {
      let n = 0
      for (const s of fn.body.statements) {
        const tmp: PseudoLine[] = []
        cstmt(s, 1, tmp, st)
        if (tmp.length && st === 'hybrid') tmp[0].num = ++n
        lines.push(...tmp)
      }
    } else if (fn.body) lines.push({ indent: 1, kw: 'RETURN', text: ` ${cx(fn.body, st)}`, num: st === 'hybrid' ? 1 : undefined })
    if (st === 'classic') lines.push({ indent: 0, kw: 'END FUNCTION', text: '' })
    return lines
  }

  // ---- finding functions -------------------------------------------------
  function add(fnName: string, node: ts.Node, fn: ts.FunctionLikeDeclaration) {
    const pseudo: PseudoLine[] = []
    const isAsync = !!fn.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)
    const [owner, own] = fnName.includes('.') ? fnName.split('.') : [undefined, fnName]
    // Function: loadUser (id, retries = 3), names exactly as in the code
    pseudo.push(L(0, ` ${own} (${paramList(fn)})`, 'Function:'))
    if (owner) pseudo.push(L(1, ` this belongs to ${owner}.`, 'Note:'))
    if (isAsync) pseudo.push(L(1, ' this is async: it can pause to wait for slow work without freezing the app, and its result arrives later (as a promise).', 'Note:'))
    if (fn.body) {
      if (ts.isBlock(fn.body)) {
        let n = 0
        for (const s of fn.body.statements) {
          const tmp: PseudoLine[] = []
          stmt(s, 1, tmp)
          if (tmp.length) {
            tmp[0].num = ++n
            pseudo.push(...tmp)
          }
        }
        if (n === 0) pseudo.push(L(1, 'This function has nothing in it yet.'))
      } else pseudo.push({ indent: 1, kw: 'Give back', text: ` ${ex(fn.body)}.`, num: 1 })
    }
    const used = detectConcepts(node, fn, sf)
    if (used.length) {
      pseudo.push({ indent: 0, kw: '💡 Good to know', text: '', tip: true })
      for (const c of CONCEPTS.filter(c => used.includes(c.key))) pseudo.push({ indent: 1, kw: c.label, text: ` — ${c.text}`, tip: true })
    }
    const start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line
    const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line
    out.push({
      name: fnName,
      startLine: start,
      endLine: end,
      source: text.slice(node.getStart(sf), node.getEnd()),
      pseudo,
      hybrid: codeView(fnName, fn, 'hybrid'),
      classic: codeView(fnName, fn, 'classic'),
    })
  }

  function visit(n: ts.Node) {
    if (ts.isFunctionDeclaration(n) && n.body) {
      add(n.name ? t(n.name) : 'default', n, n)
      return
    }
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        const i = d.initializer
        if (i && (ts.isArrowFunction(i) || ts.isFunctionExpression(i))) add(t(d.name), n, i)
        else if (i) visit(i)
      }
      return
    }
    if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) {
      const cls = n.name ? t(n.name) : 'class'
      for (const m of n.members) {
        if (ts.isMethodDeclaration(m) && m.body) add(`${cls}.${t(m.name)}`, m, m)
        else if (ts.isConstructorDeclaration(m) && m.body) add(`${cls}.constructor`, m, m)
        else if (ts.isPropertyDeclaration(m) && m.initializer && (ts.isArrowFunction(m.initializer) || ts.isFunctionExpression(m.initializer)))
          add(`${cls}.${t(m.name)}`, m, m.initializer)
      }
      return
    }
    if (ts.isExportAssignment(n) && (ts.isArrowFunction(n.expression) || ts.isFunctionExpression(n.expression))) {
      add('default export', n, n.expression)
      return
    }
    ts.forEachChild(n, visit)
  }

  visit(sf)
  return out.sort((a, b) => a.startLine - b.startLine)
}

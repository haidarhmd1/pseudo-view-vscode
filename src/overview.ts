import * as ts from 'typescript'
import type { FnInfo } from './pseudo'

/** One row of the "About this file" section: a bold label and plain text. */
export type OverviewRow = { label: string; text: string; items?: string[] }

// what a well-known import tells a beginner about the file
const LIBS: [RegExp, string][] = [
  [/^react$/, 'React (building user interfaces from components)'],
  [/^react-native$/, 'React Native (the building blocks of a mobile app screen)'],
  [/^react-dom/, 'React DOM (showing React components in a web page)'],
  [/^next(\/|$)/, 'Next.js (a framework for React websites)'],
  [/^expo-router$/, 'Expo Router (moving between screens of the app)'],
  [/^@react-navigation\//, 'React Navigation (moving between screens of the app)'],
  [/^expo-/, 'an Expo module (ready-made phone features)'],
  [/^@expo\//, 'an Expo package (ready-made app features)'],
  [/health/i, 'a health-data library (reading health information from the device)'],
  [/^axios$/, 'Axios (sending requests to servers)'],
  [/^@tanstack\/react-query$|^react-query$/, 'React Query (loading and caching data from a server)'],
  [/^zustand$|^redux|^@reduxjs\/|^jotai$|^mobx/, 'a state library (data shared across the whole app)'],
  [/^zod$|^yup$/, 'a validation library (checking that data has the right shape)'],
  [/async-storage/, 'AsyncStorage (saving small bits of data on the device)'],
  [/^date-fns|^dayjs$|^moment$|^luxon$/, 'a date library (working with dates and times)'],
  [/^lodash/, 'Lodash (general helper utilities)'],
  [/supabase|firebase/, 'a backend service (database, login and storage in the cloud)'],
  [/^express$|^fastify$|^koa$|^hono$/, 'a web-server framework (answering requests from clients)'],
  [/^jest$|^vitest$|^@testing-library\//, 'a testing library (checking that code works)'],
  [/^node:|^fs$|^path$|^os$|^crypto$/, 'Node.js built-ins (files, paths, the computer itself)'],
  [/styled-components|nativewind|tailwind/, 'a styling library (how things look)'],
]

/** Builds the beginner-level "About this file" rows from the code alone. */
export function fileOverview(text: string, fileName: string, fns: FnInfo[]): OverviewRow[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, /\.[jt]sx$/i.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const rows: OverviewRow[] = []

  // the author's own description: a comment at the very top of the file
  const lead = ts.getLeadingCommentRanges(text, 0) ?? []
  const note = lead
    .map(r => text.slice(r.pos, r.end))
    .filter(c => !/eslint|@ts-|prettier|use (client|server|strict)/.test(c))
    .map(c => c.replace(/^\/\*\*?|\*\/$/g, '').replace(/^\s*(\*|\/\/)\s?/gm, '').trim())
    .filter(Boolean)
    .join(' ')
  if (note) rows.push({ label: 'Author’s note', text: note.length > 400 ? note.slice(0, 399) + '…' : note })

  // imports
  const external = new Map<string, string[]>()
  const local: string[] = []
  const types: string[] = []
  const exportsList: string[] = []
  let defaultExport = ''
  let hasTests = false

  const isExported = (n: ts.Node) => !!(ts.canHaveModifiers(n) && ts.getModifiers(n)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))
  const isDefault = (n: ts.Node) => !!(ts.canHaveModifiers(n) && ts.getModifiers(n)?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword))

  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)) {
      const from = s.moduleSpecifier.text
      const names: string[] = []
      const c = s.importClause
      if (c?.name) names.push(c.name.text)
      if (c?.namedBindings && ts.isNamedImports(c.namedBindings)) names.push(...c.namedBindings.elements.map(e => e.name.text))
      if (c?.namedBindings && ts.isNamespaceImport(c.namedBindings)) names.push(`* as ${c.namedBindings.name.text}`)
      if (from.startsWith('.') || from.startsWith('@/') || from.startsWith('~/')) local.push(`${from}${names.length ? ` (${names.join(', ')})` : ''}`)
      else external.set(from, [...(external.get(from) ?? []), ...names])
      continue
    }
    if (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isEnumDeclaration(s)) {
      types.push(s.name.text)
      if (isExported(s)) exportsList.push(s.name.text)
      continue
    }
    if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) {
      if (isExported(s) && s.name) (isDefault(s) ? (defaultExport = s.name.text) : exportsList.push(s.name.text))
      else if (isDefault(s)) defaultExport = 'an unnamed function'
    } else if (ts.isVariableStatement(s) && isExported(s)) {
      for (const d of s.declarationList.declarations) exportsList.push(d.name.getText(sf))
    } else if (ts.isExportAssignment(s)) {
      defaultExport = ts.isIdentifier(s.expression) ? s.expression.text : 'an unnamed value'
    } else if (ts.isExportDeclaration(s) && s.exportClause && ts.isNamedExports(s.exportClause)) {
      exportsList.push(...s.exportClause.elements.map(e => e.name.text))
    } else if (ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && /^(describe|it|test)$/.test(s.expression.expression.getText(sf))) {
      hasTests = true
    }
  }

  // what kind of file is it?
  const returnsUi = (f: FnInfo) => /return\s*\(?\s*</.test(f.source) || /=>\s*\(?\s*</.test(f.source)
  const components = fns.filter(f => /^[A-Z]/.test(f.name) && returnsUi(f))
  const hooks = fns.filter(f => /^use[A-Z]/.test(f.name))
  const asyncFns = fns.filter(f => f.hybrid[0]?.kw?.startsWith('ASYNC'))
  const usesNetwork = /\bfetch\(|axios\.|\.get\(|\.post\(|useQuery|supabase|firebase/.test(text)
  const usesStorage = /AsyncStorage|localStorage|SecureStore|sessionStorage/.test(text)
  const usesNav = /useRouter|useNavigation|router\.(push|replace)|navigation\.navigate|<Link\b/.test(text)
  const isRN = [...external.keys()].some(k => k === 'react-native' || k.startsWith('expo'))

  let kind: string
  if (hasTests || /\.(test|spec)\.[jt]sx?$/.test(fileName)) kind = 'A test file: it checks that other code behaves the way it should.'
  else if (components.length && /(^|\/)(app|screens?|pages?)\//.test(fileName.replace(/\\/g, '/')))
    kind = `A ${isRN ? 'mobile app screen' : 'page'}: it builds what the user sees${components.length > 1 ? ` out of ${components.length} components` : ''}.`
  else if (components.length) kind = `A React component file: it builds ${components.length === 1 ? 'a piece' : `${components.length} pieces`} of ${isRN ? 'the app’s screen' : 'the user interface'} (${components.map(c => c.name).join(', ')}).`
  else if (hooks.length && hooks.length >= fns.length / 2) kind = `A React hooks file: it gives components reusable behaviour (${hooks.map(h => h.name).join(', ')}).`
  else if (!fns.length && types.length) kind = 'A types file: it only describes the shape of data (no steps run here).'
  else if (/express|fastify|koa|hono/.test([...external.keys()].join(' '))) kind = 'A server file: it answers requests coming from clients.'
  else if (fns.length) kind = `A helper module: it holds ${fns.length === 1 ? 'one function' : `${fns.length} functions`} that other parts of the project can use.`
  else kind = 'A file with settings or values used elsewhere (it has no functions).'
  rows.push({ label: 'What it is', text: kind })

  const extras: string[] = []
  if (usesNetwork) extras.push('talks to a server or API over the internet')
  if (usesStorage) extras.push('saves or reads data stored on the device')
  if (usesNav) extras.push('moves the user between screens')
  if (asyncFns.length) extras.push(`does slow work in the background (${asyncFns.map(f => f.name).join(', ')})`)
  if (extras.length) rows.push({ label: 'It also', text: extras.join('; ') + '.' })

  if (external.size) {
    rows.push({
      label: 'Uses',
      text: '',
      items: [...external.entries()].map(([from, names]) => {
        const lib = LIBS.find(([re]) => re.test(from))?.[1]
        return `${from}${lib ? ` — ${lib}` : ''}${names.length ? `: ${names.join(', ')}` : ''}`
      }),
    })
  }
  if (local.length) rows.push({ label: 'Other project files it uses', text: '', items: local })

  if (defaultExport || exportsList.length) {
    const parts: string[] = []
    if (defaultExport) parts.push(`${defaultExport} (the main thing this file shares)`)
    if (exportsList.length) parts.push(...exportsList)
    rows.push({ label: 'Shares with other files', text: '', items: parts })
  }
  if (types.length) rows.push({ label: 'Describes data shapes', text: types.join(', ') })

  if (fns.length)
    rows.push({
      label: `Functions (${fns.length})`,
      text: '',
      items: fns.map(f => `${f.name} — ${role(f)}`),
    })
  return rows
}

// a one-line guess at what a function is for, from its name and shape
function role(f: FnInfo): string {
  const n = f.name.split('.').pop()!
  const src = f.source
  const ui = /return\s*\(?\s*</.test(src) || /=>\s*\(?\s*</.test(src)
  const tag = src.match(/return\s*\(?\s*<([A-Za-z.]+)/)?.[1]
  if (/^[A-Z]/.test(n) && ui) return `a component that shows ${tag ? `a <${tag}>` : 'part of the screen'}`
  if (/^use[A-Z]/.test(n)) return 'a custom React hook (reusable behaviour for components)'
  if (n === 'constructor') return 'sets up a new object when it is created'
  if (/^(handle|on)[A-Z]/.test(n)) return 'reacts to something the user does (an event handler)'
  if (/^(is|has|can|should)[A-Z]/.test(n)) return 'checks something and answers true or false'
  if (/^(get|fetch|load|read)[A-Z]?/.test(n)) return `${/fetch\(|axios|await/.test(src) ? 'loads' : 'gets'} data and gives it back`
  if (/(Fetch|Load|Request|Api)$/.test(n)) return 'requests data from somewhere and gives it back'
  if (/^(add|push|append|insert)[A-Z]?/.test(n)) return 'adds something to a collection'
  if (/^(set|update|save|write|store)[A-Z]?/.test(n)) return 'changes or saves data'
  if (/^(create|make|build)[A-Z]?/.test(n)) return 'creates something new and gives it back'
  if (/^(delete|remove|clear)[A-Z]?/.test(n)) return 'removes data'
  if (/^(format|to|parse|convert)[A-Z]?/.test(n)) return 'turns data from one form into another'
  if (/^(validate|check)[A-Z]?/.test(n)) return 'checks that data is correct'
  if (/^(calc|calculate|compute|count|sum)[A-Z]?/.test(n)) return 'works out a value'
  if (/\bawait\b/.test(src)) return 'does slow work (it waits for something) and then finishes'
  return 'a helper step'
}

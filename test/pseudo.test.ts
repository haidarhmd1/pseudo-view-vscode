import { readFileSync } from 'node:fs'
import { extractFunctions } from '../src/pseudo'

const file = process.argv[2]
for (const f of extractFunctions(readFileSync(file, 'utf8'), file)) {
  console.log(`# ${f.name} (${f.startLine + 1}-${f.endLine + 1})`)
  for (const view of ['pseudo', 'hybrid', 'classic'] as const) for (const l of f[view]) console.log('  '.repeat(l.indent) + (l.num ? l.num + '. ' : '') + (l.kw ?? '') + l.text)
}

import { fileOverview } from '../src/overview'
const fns = extractFunctions(readFileSync(file, 'utf8'), file)
console.log('\n=== About this file ===')
for (const r of fileOverview(readFileSync(file, 'utf8'), file, fns)) {
  console.log(`${r.label}: ${r.text}`)
  for (const i of r.items ?? []) console.log(`  • ${i}`)
}

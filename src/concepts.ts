import * as ts from 'typescript'

/**
 * Beginner explanations of the JavaScript/TypeScript ideas a function uses,
 * written from javascript.info (async/await) and MDN (destructuring, optional
 * chaining, nullish coalescing, spread, template literals, array methods).
 * Listed in the order they are shown under "Good to know".
 */
export const CONCEPTS: { key: string; label: string; text: string }[] = [
  { key: 'export', label: 'export', text: 'This function is shared: other files can import it and use it.' },
  { key: 'async', label: 'async', text: 'An async function can pause to wait for slow work (like loading data from the internet) without freezing the app. It always hands back a promise, so whoever calls it gets the result a little later.' },
  { key: 'await', label: 'await', text: 'Pauses only this function until the slow task finishes, then gives you its result. The rest of the app keeps running meanwhile. If the task fails, the error is thrown right here, so a try/catch around it can handle it.' },
  { key: 'promise', label: 'promise', text: 'A placeholder for a result that is not ready yet. It ends either with a value (success) or an error (failure). .then(...) says what to do on success, .catch(...) what to do on failure, and Promise.all waits for several at once (failing if any one fails).' },
  { key: 'fetch', label: 'fetch', text: 'Asks a web address (a server or API) for data. It does not give the data directly; it gives a promise of a response, which you usually await and then read with .json().' },
  { key: 'json', label: '.json()', text: 'Reads the body of a web response and turns the JSON text into a normal JavaScript object or list. It is also slow, so it returns a promise too.' },
  { key: 'objDestructure', label: '{ a, b } = …', text: 'Destructuring: pulls the fields named a and b out of an object and puts each in its own variable. Matching is by name, so the order does not matter.' },
  { key: 'arrDestructure', label: '[a, b] = …', text: 'Array destructuring: takes items by position. The first item goes into a, the second into b. Missing items become undefined.' },
  { key: 'default', label: 'x = value', text: 'A default value: used when that input is left out or is undefined. It is NOT used when someone passes null on purpose.' },
  { key: 'optional', label: 'x?', text: 'An optional input: the caller may leave it out, in which case it is undefined.' },
  { key: 'rest', label: '...rest', text: 'Collects all the remaining values into one list (or the remaining fields into one object), however many there are.' },
  { key: 'spread', label: '...spread', text: 'Copies everything out of a list or object into the new one, like pouring one box into another. Often used to make a copy with a few changes.' },
  { key: 'optionalChain', label: '?.', text: 'Optional chaining: reads a field safely. If the thing before ?. is missing (null or undefined), the whole thing just becomes undefined instead of crashing the app.' },
  { key: 'nullish', label: '??', text: 'Nullish coalescing: gives a fallback ONLY when the left side is missing (null or undefined). Unlike ||, it keeps real values like 0, empty text and false.' },
  { key: 'or', label: '||  /  &&', text: '|| means "or" and && means "and". They are also used as shortcuts: a || b gives b when a is empty-ish (0, "", false, null, undefined); a && b only looks at b when a is truthy.' },
  { key: 'strictEq', label: '=== / !==', text: 'Strict equality: checks that two values are the same AND of the same type, so 1 === "1" is false.' },
  { key: 'ternary', label: 'a ? b : c', text: 'A one-line if/else: if a is true the result is b, otherwise it is c.' },
  { key: 'typeof', label: 'typeof', text: 'Tells you what kind of value something is, as text: "string", "number", "boolean", "object", "function" or "undefined".' },
  { key: 'object', label: '{ key: value }', text: 'An object: a bundle of named values (called fields or properties), like a small labelled record.' },
  { key: 'array', label: '[ … ]', text: 'An array: a list of items kept in order. Positions are counted from 0, so the first item is at [0].' },
  { key: 'template', label: '`text ${x}`', text: 'A template string: builds text by dropping values into the ${...} spots, e.g. `Hello ${name}` becomes "Hello Sam".' },
  { key: 'arrow', label: '(x) => …', text: 'An arrow function: a short way to write a small function. It is often handed to another function to run later, or once for each item in a list.' },
  { key: 'arrayMethods', label: 'map / filter / reduce …', text: 'List helpers: map makes a new list by changing each item, filter keeps only items that pass a test, find returns the first match, some/every check if any/all items match, reduce boils the list down to one value. They do not change the original list.' },
  { key: 'forEach', label: 'forEach / for…of', text: 'Goes through a list one item at a time and runs the same steps for each item.' },
  { key: 'forLoop', label: 'for (…; …; …)', text: 'A counting loop: set a starting value, keep going while a condition is true, and update the counter after each round.' },
  { key: 'while', label: 'while', text: 'Repeats the steps for as long as the condition stays true. Something inside must eventually make it false, or it loops forever.' },
  { key: 'switch', label: 'switch', text: 'Compares one value against several cases and runs the matching one, like a multi-way if. break stops it from falling into the next case.' },
  { key: 'try', label: 'try / catch', text: 'try runs code that might fail. If anything inside throws an error, the code jumps to catch instead of crashing. finally (if present) runs either way.' },
  { key: 'throw', label: 'throw', text: 'Stops the function immediately and reports an error to whoever called it. Something above can catch it with try/catch.' },
  { key: 'new', label: 'new', text: 'Builds a brand-new object from a blueprint (a class), e.g. new Error("oops") makes an error object.' },
  { key: 'this', label: 'this', text: 'Means "the object this function belongs to", e.g. inside a Cart method, this.items is that cart\'s own items.' },
  { key: 'jsx', label: '<Tags />', text: 'JSX: HTML-like tags that describe what should appear on screen. React turns them into real page elements. Values in { } are inserted into the page.' },
  { key: 'useState', label: 'useState', text: 'A React hook that gives the component a value it remembers between redraws, plus a function to change it. Changing it makes the screen update.' },
  { key: 'useEffect', label: 'useEffect', text: 'A React hook that runs code after the screen has updated, e.g. to load data or start a timer. Its list of dependencies decides when it runs again.' },
  { key: 'hook', label: 'use…()', text: 'A React hook: a special function (its name starts with "use") that lets a component remember things or react to changes.' },
  { key: 'console', label: 'console.log', text: 'Prints a message to the developer console. It is for debugging; users of the app do not see it.' },
]

const ARRAY_METHODS = new Set(['map', 'filter', 'reduce', 'find', 'findIndex', 'some', 'every', 'flatMap', 'sort', 'includes'])

/** The concept keys a function uses, in CONCEPTS order. */
export function detectConcepts(node: ts.Node, fn: ts.FunctionLikeDeclaration, sf: ts.SourceFile): string[] {
  const found = new Set<string>()
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  if (mods?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) found.add('export')
  if (ts.isExportAssignment(node)) found.add('export')
  if (fn.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) found.add('async')

  const visit = (n: ts.Node) => {
    if (ts.isAwaitExpression(n)) found.add('await')
    else if (ts.isObjectBindingPattern(n)) found.add('objDestructure')
    else if (ts.isArrayBindingPattern(n)) found.add('arrDestructure')
    else if (ts.isSpreadElement(n) || ts.isSpreadAssignment(n)) found.add('spread')
    else if (ts.isTemplateExpression(n)) found.add('template')
    else if (ts.isObjectLiteralExpression(n)) found.add('object')
    else if (ts.isArrayLiteralExpression(n)) found.add('array')
    else if (ts.isConditionalExpression(n)) found.add('ternary')
    else if (ts.isTypeOfExpression(n)) found.add('typeof')
    else if (ts.isForOfStatement(n)) found.add('forEach')
    else if (ts.isForStatement(n) || ts.isForInStatement(n)) found.add('forLoop')
    else if (ts.isWhileStatement(n) || ts.isDoStatement(n)) found.add('while')
    else if (ts.isSwitchStatement(n)) found.add('switch')
    else if (ts.isTryStatement(n)) found.add('try')
    else if (ts.isThrowStatement(n)) found.add('throw')
    else if (n.kind === ts.SyntaxKind.ThisKeyword) found.add('this')
    else if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found.add('jsx')
    else if (ts.isArrowFunction(n) && n !== fn) found.add('arrow')
    else if (ts.isNewExpression(n)) found.add(n.expression.getText(sf) === 'Promise' ? 'promise' : 'new')

    if ((ts.isParameter(n) || ts.isBindingElement(n)) && n.initializer) found.add('default')
    if ((ts.isParameter(n) || ts.isBindingElement(n)) && n.dotDotDotToken) found.add('rest')
    if (ts.isParameter(n) && n.questionToken) found.add('optional')
    if ((ts.isPropertyAccessExpression(n) || ts.isCallExpression(n) || ts.isElementAccessExpression(n)) && n.questionDotToken) found.add('optionalChain')

    if (ts.isBinaryExpression(n)) {
      const k = n.operatorToken.kind
      if (k === ts.SyntaxKind.QuestionQuestionToken) found.add('nullish')
      if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.AmpersandAmpersandToken) found.add('or')
      if (k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsEqualsToken) found.add('strictEq')
    }

    if (ts.isCallExpression(n)) {
      const c = n.expression
      const callee = c.getText(sf)
      if (callee === 'fetch') found.add('fetch')
      if (callee === 'useState') found.add('useState')
      else if (callee === 'useEffect') found.add('useEffect')
      else if (/^use[A-Z]/.test(callee)) found.add('hook')
      if (ts.isPropertyAccessExpression(c)) {
        const m = c.name.getText(sf)
        const o = c.expression.getText(sf)
        if (o === 'console') found.add('console')
        else if (o === 'Promise' || m === 'then' || m === 'catch' || m === 'finally') found.add('promise')
        else if (m === 'json') found.add('json')
        else if (m === 'forEach') found.add('forEach')
        else if (ARRAY_METHODS.has(m)) found.add('arrayMethods')
      }
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(fn, visit)

  return CONCEPTS.filter(c => found.has(c.key)).map(c => c.key)
}

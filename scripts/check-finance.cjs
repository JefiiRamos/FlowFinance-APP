const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('src/lib/finance.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exportsObject = {}
vm.runInNewContext(source, { exports: exportsObject, Intl, Date })
const { parseMoney } = exportsObject
for (const [input, expected] of [
  ['246,80', 246.8], ['246.80', 246.8], ['R$ 1.234,56', 1234.56],
  ['0,01', 0.01], ['-25,50', -25.5], ['5000', 5000], ['', 0],
  ['abc', 0], ['1,2,3', 0], ['Infinity', 0], ['0.001', 0],
]) assert.equal(parseMoney(input), expected, input)
console.log('Currency checks passed: decimal API values, Brazilian format, cents and invalid inputs.')

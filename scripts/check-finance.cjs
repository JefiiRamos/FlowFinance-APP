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

const { parseTransactionDateInput, transactionDateToInput } = exportsObject
for (const [input, expected] of [
  ['07/10/2026', '2026-10-07'], ['29/02/2024', '2024-02-29'],
  ['29/02/2026', null], ['31/02/2026', null], ['31/04/2026', null],
  ['00/10/2026', null], ['07/13/2026', null], ['', null],
  ['2026-10-07', null], ['7/10/2026', null],
]) assert.equal(parseTransactionDateInput(input), expected, input)
assert.equal(transactionDateToInput('2026-10-07T00:00:00.000Z'), '07/10/2026')
assert.equal(parseTransactionDateInput(transactionDateToInput('2024-02-29')), '2024-02-29')
console.log('Transaction date checks passed: Brazilian input, leap years, invalid calendar dates and editing round trips.')

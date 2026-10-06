const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const storage = new Map()
const requests = []
let responses = []
const source = ts.transpileModule(fs.readFileSync('src/lib/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
const exportsObject = {}
vm.runInNewContext(source, {
  exports: exportsObject, process: { env: {} }, AbortController, setTimeout, clearTimeout,
  require: () => ({ getItem: async key => storage.get(key) ?? null, setItem: async (key,value) => storage.set(key,value), removeItem: async key => storage.delete(key) }),
  fetch: async (url,options) => {
    requests.push({url,...options})
    const response = responses.shift()
    assert.ok(response, 'Unexpected network request')
    return { ok: response.status >= 200 && response.status < 300, status: response.status, text: async () => response.raw ?? JSON.stringify(response.data) }
  },
})
async function main() {
  const api=exportsObject
  await assert.rejects(api.fetchTransactions(), error => error.status === 401)
  assert.equal(requests.length,0)
  responses.push({status:200,data:{exists:true}})
  assert.equal(await api.checkEmail(' User@Example.com '),true)
  assert.equal(JSON.parse(requests.at(-1).body).email,'user@example.com')
  assert.equal(requests.at(-1).headers.Authorization,undefined)
  responses.push({status:200,data:{exists:false}})
  assert.equal(await api.checkEmail('new@example.com'),false)
  responses.push({status:200,data:{}})
  await assert.rejects(api.checkEmail('new@example.com'),error=>error.status===502)
  responses.push({status:200,data:{token:'real-session',user:{id:'u1',onboardingCompleted:true}}})
  await api.login(' User@Example.com ','secret')
  assert.equal(JSON.parse(requests.at(-1).body).email,'user@example.com')
  assert.equal(requests.at(-1).url,'https://flow-finance-five.vercel.app/api/auth/login')
  assert.equal(await api.getAuthToken(),'real-session')
  responses.push({status:405,raw:''})
  await assert.rejects(api.fetchRecurringIncome(), error => error.status === 405 && error.path === '/recurring' && error.message.includes('HTTP 405'))
  assert.equal(await api.getAuthToken(),'real-session')
  responses.push({status:401,raw:'Unauthorized'})
  await assert.rejects(api.getMe(), error => error.status === 401 && error.path === '/auth/me')
  assert.equal(await api.getAuthToken(),null)
  await api.setAuthToken('real-session')
  responses.push({status:200,data:[{id:'t1',type:'expense',amount:42,date:'2026-10-03',description:null}]})
  const rows=await api.fetchTransactions()
  assert.equal(rows[0].description,'')
  assert.equal(requests.at(-1).headers.Authorization,'Bearer real-session')
  responses.push({status:204})
  assert.equal(await api.deleteTransaction('a/b'),undefined)
  assert.ok(requests.at(-1).url.endsWith('/transactions/a%2Fb'))
  responses.push({status:503,data:{error:'Unavailable'}})
  await assert.rejects(api.getMe(),error=>error.status===503)
  assert.equal(await api.getAuthToken(),'real-session')
  responses.push({status:401,data:{error:'Expired'}})
  await assert.rejects(api.getMe(),error=>error.status===401)
  assert.equal(await api.getAuthToken(),null)
  responses.push({status:201,data:{id:'new'}},{status:200,data:{token:'new-token',user:{id:'new'}}})
  assert.equal((await api.register('Test','test@example.com','secret')).id,'new')
  responses.push({status:200,raw:'<html>error</html>'})
  await assert.rejects(api.getMe(),error=>error.status===200 && error.name==='ApiError')
  responses.push({status:500,data:{error:'Unavailable'}})
  await assert.rejects(api.logout())
  assert.equal(await api.getAuthToken(),null)
  console.log('API contract checks passed: auth, registration, bearer, nullable fields, DELETE 204, ID escaping, server errors, expiry, invalid JSON and logout.')
}
main().catch(error=>{console.error(error);process.exitCode=1})

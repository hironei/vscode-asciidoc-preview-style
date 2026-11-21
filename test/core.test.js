'use strict'
const test = require('node:test')
const assert = require('node:assert')
const core = require('../lib/core')

const T = 'c:\\data\\globalStorage\\hironei.vscode-asciidoc-preview-style\\' + core.BUNDLE_NAME
const base = { mode: 'auto', upstreamFixed: false, current: '', target: T, owned: undefined, optedOut: false, forceEnable: false }
const d = (o) => core.decide({ ...base, ...o })

test('initial install sets the bundle', () => {
  assert.strictEqual(d({}).action, 'set')
  assert.strictEqual(d({}).owned, T)
})

test('user value is never overwritten', () => {
  const r = d({ current: 'C:\\my.css', owned: T })
  assert.strictEqual(r.action, 'none')
  assert.strictEqual(r.owned, undefined)
})

test('user-cleared value is not re-applied; enable re-applies', () => {
  const r = d({ owned: T })
  assert.strictEqual(r.action, 'none')
  assert.strictEqual(r.optedOut, true)
  assert.strictEqual(d({ owned: T, optedOut: true, forceEnable: true }).action, 'set')
})

test('own value refreshes; moved storage migrates', () => {
  assert.strictEqual(d({ current: T, owned: T }).action, 'refresh')
  const old = 'x\\old\\' + core.BUNDLE_NAME
  assert.strictEqual(d({ current: old, owned: old }).action, 'set')
})

test('mode off / upstream fixed remove only own value', () => {
  assert.strictEqual(d({ mode: 'off', current: T, owned: T }).action, 'remove')
  assert.strictEqual(d({ upstreamFixed: true, current: T, owned: T }).action, 'remove')
  assert.strictEqual(d({ mode: 'off', current: 'C:\\my.css' }).action, 'none')
})

test('default style resolution', () => {
  assert.strictEqual(core.resolveDefaultStyle('', true), 'vscode')
  assert.strictEqual(core.resolveDefaultStyle('', false), 'asciidoctor')
  assert.strictEqual(core.resolveDefaultStyle('github', true), 'github')
})

test('bundle puts standard CSS before Light 2026', () => {
  const css = core.buildBundle('vscode', (f) => `/*${f}*/`, '/*own*/')
  assert.ok(css.indexOf('asciidoctor-editor.css*/') < css.indexOf('/*own*/'))
  assert.ok(css.includes('asciidoctor-editor-enhancements.css*/'))
})

test('upstream fixed version comparison', () => {
  assert.strictEqual(core.isUpstreamFixed('4.3.0', null), false)
  assert.strictEqual(core.isUpstreamFixed('4.3.0', '4.4.0'), false)
  assert.strictEqual(core.isUpstreamFixed('4.4.0', '4.4.0'), true)
  assert.strictEqual(core.isUpstreamFixed('5.0.1', '4.4.0'), true)
})

test('removeStyleSetting removes only our top-level entry and keeps JSON valid', () => {
  const v = JSON.stringify(T)
  const rm = (t) => core.removeStyleSetting(t, T)
  assert.strictEqual(rm(`{\n  "a": 1,\n  "asciidoc.preview.style": ${v},\n  "b": 2\n}`), '{\n  "a": 1,\n  "b": 2\n}')
  assert.deepStrictEqual(JSON.parse(rm(`{\n  "a": 1,\n  "asciidoc.preview.style": ${v}\n}`)), { a: 1 })
  assert.deepStrictEqual(JSON.parse(rm(`{\r\n  "asciidoc.preview.style": ${v}\r\n}`)), {})
})

test('removeStyleSetting keeps user values, other paths, nested keys and comments', () => {
  const v = JSON.stringify(T)
  const rm = (t) => core.removeStyleSetting(t, T)
  const user = `{
  "asciidoc.preview.style": "C:/my.css"
}`
  assert.strictEqual(rm(user), user)
  const lookalike = JSON.stringify('C:/my-hironei.vscode-asciidoc-preview-style-backup/' + core.BUNDLE_NAME)
  const l = `{\n  "asciidoc.preview.style": ${lookalike}\n}`
  assert.strictEqual(rm(l), l)
  const nested = `{\n  "other": {\n    "asciidoc.preview.style": ${v}\n  }\n}`
  assert.strictEqual(rm(nested), nested)
  const commented = `{\n  // "asciidoc.preview.style": ${v}\n  "a": "/* x */", /* c */\n  "asciidoc.preview.style": ${v}, // ours\n  "b": 2\n}`
  const out = rm(commented)
  assert.ok(out.includes('// "asciidoc.preview.style"'))
  assert.ok(out.includes('"a": "/* x */"') && out.includes('"b": 2'))
  assert.strictEqual(out.split('"asciidoc.preview.style"').length, 2)
})

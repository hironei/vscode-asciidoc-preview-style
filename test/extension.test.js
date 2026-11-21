'use strict'
// Behavioural tests of extension.js against a minimal in-memory `vscode` mock.
const test = require('node:test')
const assert = require('node:assert')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

const KEY = 'asciidoc.preview.style'

function setup() {
  const store = new Map()
  const state = new Map()
  const commands = new Map()
  let warningAnswer = 'Replace'
  const mock = {
    ConfigurationTarget: { Global: 1 },
    extensions: {
      getExtension: () => ({ packageJSON: { version: '4.3.0' }, extensionPath: mock.__asciidocDir }),
      onDidChange: () => ({ dispose() {} }),
    },
    commands: {
      registerCommand: (id, fn) => (commands.set(id, fn), { dispose() {} }),
      executeCommand: async () => {},
    },
    window: {
      createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
      showWarningMessage: async () => warningAnswer,
      setStatusBarMessage() {},
    },
    workspace: {
      onDidChangeConfiguration: () => ({ dispose() {} }),
      getConfiguration(section) {
        const full = (k) => (section ? `${section}.${k}` : k)
        return {
          get: (k, d) => (store.has(full(k)) ? store.get(full(k)) : d),
          inspect: (k) => ({ globalValue: store.get(full(k)), defaultValue: undefined }),
          update: async (k, v) => (v === undefined ? store.delete(full(k)) : store.set(full(k), v)),
        }
      },
    },
  }
  return { mock, store, state, commands, setWarning: (a) => (warningAnswer = a) }
}

async function load(env) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'apstyle-'))
  const asciidocDir = path.join(root, 'asciidoc')
  await fsp.mkdir(path.join(asciidocDir, 'media'), { recursive: true })
  for (const f of ['asciidoctor-editor.css', 'asciidoctor-editor-enhancements.css']) {
    await fsp.writeFile(path.join(asciidocDir, 'media', f), `/* ${f} */`)
  }
  const extDir = path.join(root, 'ext')
  await fsp.mkdir(extDir)
  await fsp.writeFile(path.join(extDir, 'style.css'), '/* own */')
  env.mock.__asciidocDir = asciidocDir

  const origLoad = Module._load
  Module._load = function (request, ...rest) {
    return request === 'vscode' ? env.mock : origLoad.call(this, request, ...rest)
  }
  delete require.cache[require.resolve('../extension.js')]
  const ext = require('../extension.js')
  Module._load = origLoad

  const context = {
    extensionPath: extDir,
    globalStorageUri: { fsPath: path.join(root, 'storage') },
    subscriptions: [],
    globalState: {
      get: (k, d) => (env.state.has(k) ? env.state.get(k) : d),
      update: async (k, v) => (v === undefined ? env.state.delete(k) : env.state.set(k, v)),
    },
  }
  const target = path.join(context.globalStorageUri.fsPath, 'asciidoc-preview-light-2026.css')
  return { ext, context, target, root, extDir }
}

// Run `change` while the bundle is being generated (style.css is read then).
function raceDuringBundle(extDir, change) {
  const orig = fsp.readFile
  fsp.readFile = async function (file, ...rest) {
    if (String(file) === path.join(extDir, 'style.css')) change()
    return orig.call(this, file, ...rest)
  }
  return () => (fsp.readFile = orig)
}

test('initial activation sets the bundle and writes standard CSS + Light 2026', async () => {
  const env = setup()
  const { ext, context, target } = await load(env)
  await ext.activate(context)
  assert.strictEqual(env.store.get(KEY), target)
  const css = await fsp.readFile(target, 'utf8')
  assert.ok(css.includes('asciidoctor-editor.css') && css.includes('/* own */'))
})

test('a value the user sets while the bundle is generated is kept', async () => {
  const env = setup()
  const { ext, context, extDir } = await load(env)
  const restore = raceDuringBundle(extDir, () => env.store.set(KEY, 'C:/user.css'))
  try {
    await ext.activate(context)
  } finally {
    restore()
  }
  assert.strictEqual(env.store.get(KEY), 'C:/user.css')
})

test('Enable: a change after the replace confirmation is not overwritten', async () => {
  const env = setup()
  env.store.set(KEY, 'C:/old.css')
  const { ext, context, extDir } = await load(env)
  await ext.activate(context) // user value present: left alone
  assert.strictEqual(env.store.get(KEY), 'C:/old.css')
  const restore = raceDuringBundle(extDir, () => env.store.set(KEY, 'C:/new.css'))
  try {
    await env.commands.get('asciidocPreviewStyle.enable')()
  } finally {
    restore()
  }
  assert.strictEqual(env.store.get(KEY), 'C:/new.css')
})

test('Enable replaces the confirmed value; Restore removes only our value', async () => {
  const env = setup()
  env.store.set(KEY, 'C:/old.css')
  const { ext, context, target } = await load(env)
  await ext.activate(context)
  await env.commands.get('asciidocPreviewStyle.enable')()
  assert.strictEqual(env.store.get(KEY), target)
  await env.commands.get('asciidocPreviewStyle.restore')()
  assert.strictEqual(env.store.has(KEY), false)
  env.store.set(KEY, 'C:/mine.css')
  await env.commands.get('asciidocPreviewStyle.restore')()
  assert.strictEqual(env.store.get(KEY), 'C:/mine.css')
})

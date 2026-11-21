'use strict'
const vscode = require('vscode')
const fs = require('fs/promises')
const path = require('path')
const core = require('./lib/core')

const ASCIIDOC_EXT_ID = 'asciidoctor.asciidoctor-vscode'
const STYLE_KEY = 'asciidoc.preview.style'
const STATE_OWNED = 'ownedStyleValue'
const STATE_OPTED_OUT = 'optedOut'

let output

function log(message) {
  output.appendLine(`[${new Date().toISOString()}] ${message}`)
}

async function readIfExists(file) {
  try {
    return await fs.readFile(file, 'utf8')
  } catch {
    return undefined
  }
}

function targetPath(context) {
  return path.join(context.globalStorageUri.fsPath, core.BUNDLE_NAME)
}

/**
 * Generate <globalStorage>/asciidoc-preview-light-2026.css from the standard
 * stylesheets of the installed Asciidoctor VS Code plus our style.css.
 * The preview webview may only read the directory of an absolute
 * `asciidoc.preview.style`, so the bundle (and, for non-vscode default styles,
 * the fonts the standard CSS refers to relatively) live in that directory.
 * @returns {Promise<boolean>} true when the file content changed
 */
async function writeBundle(context, asciidocExt, target) {
  // User-level values only, so every window generates the same bundle.
  const cfg = vscode.workspace.getConfiguration('asciidoc.preview')
  const globalOf = (key) => {
    const i = cfg.inspect(key)
    return i && i.globalValue !== undefined ? i.globalValue : i && i.defaultValue
  }
  const style = core.resolveDefaultStyle(globalOf('defaultStyle'), globalOf('useEditorStyle'))
  const mediaDir = path.join(asciidocExt.extensionPath, 'media')
  const contents = new Map()
  for (const f of core.DEFAULT_STYLE_SHEETS[style]) {
    contents.set(f, await fs.readFile(path.join(mediaDir, f), 'utf8'))
  }
  const ownCss = await fs.readFile(path.join(context.extensionPath, 'style.css'), 'utf8')
  const bundle = core.buildBundle(style, (f) => contents.get(f), ownCss)

  const dir = path.dirname(target)
  await fs.mkdir(dir, { recursive: true })
  if (style !== 'vscode') {
    await fs.cp(path.join(mediaDir, 'fonts'), path.join(dir, 'fonts'), { recursive: true, force: true })
  }
  if ((await readIfExists(target)) === bundle) return false
  const tmp = `${target}.tmp`
  await fs.writeFile(tmp, bundle, 'utf8')
  await fs.rename(tmp, target)
  return true
}

async function sync(context, { forceEnable = false, replaceValue, restore = false } = {}) {
  const asciidocExt = vscode.extensions.getExtension(ASCIIDOC_EXT_ID)
  const mode = vscode.workspace.getConfiguration('asciidocPreviewStyle').get('mode', 'auto')
  const target = targetPath(context)
  const inspected = vscode.workspace.getConfiguration().inspect(STYLE_KEY)
  const readGlobal = () => {
    const i = vscode.workspace.getConfiguration().inspect(STYLE_KEY)
    return i && typeof i.globalValue === 'string' ? i.globalValue : ''
  }
  const current = readGlobal()
  const replacing = replaceValue !== undefined
  // Value the decision is based on; it must still be there right before writing.
  const expected = replacing ? replaceValue : current
  if (replacing && current !== replaceValue) {
    log('"asciidoc.preview.style" changed after the replace confirmation; skipped.')
    return { action: 'none', reason: 'changed-concurrently' }
  }

  if (restore) {
    if (current === target || current === context.globalState.get(STATE_OWNED)) {
      await vscode.workspace.getConfiguration().update(STYLE_KEY, undefined, vscode.ConfigurationTarget.Global)
    }
    await context.globalState.update(STATE_OWNED, undefined)
    await context.globalState.update(STATE_OPTED_OUT, true)
    return { action: 'none', reason: 'restore' }
  }

  const result = core.decide({
    mode,
    upstreamFixed: asciidocExt ? core.isUpstreamFixed(asciidocExt.packageJSON.version) : false,
    current: replacing ? '' : current,
    target,
    owned: context.globalState.get(STATE_OWNED),
    optedOut: context.globalState.get(STATE_OPTED_OUT, false),
    forceEnable,
  })
  log(`sync: mode=${mode} current=${current ? 'set' : 'empty'} -> ${result.action} (${result.reason})`)

  if (result.action === 'set' || result.action === 'refresh') {
    if (!asciidocExt) {
      log('Asciidoctor VS Code is not installed; nothing to style.')
      return result
    }
    const changed = await writeBundle(context, asciidocExt, target)
    if (result.action === 'set') {
      // The bundle was generated asynchronously: re-check so a value the user
      // changed meanwhile is never overwritten (the change event re-syncs).
      if (readGlobal() !== expected) {
        log('"asciidoc.preview.style" changed while the bundle was generated; skipped.')
        return { action: 'none', reason: 'changed-concurrently' }
      }
      await vscode.workspace.getConfiguration().update(STYLE_KEY, target, vscode.ConfigurationTarget.Global)
    } else if (changed) {
      await vscode.commands.executeCommand('asciidoc.preview.refresh').then(undefined, () => {})
    }
    if (inspected && (inspected.workspaceValue || inspected.workspaceFolderValue)) {
      log('A workspace/folder "asciidoc.preview.style" overrides the user setting; Light 2026 is not applied there.')
    }
  } else if (result.action === 'remove') {
    if (readGlobal() !== expected) return { action: 'none', reason: 'changed-concurrently' }
    await vscode.workspace.getConfiguration().update(STYLE_KEY, undefined, vscode.ConfigurationTarget.Global)
  } else if (result.reason === 'user-value') {
    log('"asciidoc.preview.style" is set by the user; left unchanged (run "AsciiDoc Preview Style: Enable" to take over).')
  }

  await context.globalState.update(STATE_OWNED, result.owned)
  await context.globalState.update(STATE_OPTED_OUT, result.optedOut)
  return result
}

function activate(context) {
  output = vscode.window.createOutputChannel('AsciiDoc Preview Style')
  context.subscriptions.push(output)

  let queue = Promise.resolve()
  const run = (opts) => {
    queue = queue.then(() => sync(context, opts)).catch((e) => log(`error: ${e && e.stack ? e.stack : e}`))
    return queue
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('asciidocPreviewStyle.enable', async () => {
      const existing = vscode.workspace.getConfiguration().inspect(STYLE_KEY)?.globalValue
      let replaceValue
      if (existing && existing !== targetPath(context)) {
        const pick = await vscode.window.showWarningMessage(
          'The user setting "asciidoc.preview.style" is already set. Replace it with the Light 2026 bundle?',
          { modal: true },
          'Replace',
        )
        if (pick !== 'Replace') return
        replaceValue = existing
      }
      await run({ forceEnable: true, replaceValue })
      vscode.window.setStatusBarMessage('AsciiDoc Preview Light 2026 enabled.', 4000)
    }),
    vscode.commands.registerCommand('asciidocPreviewStyle.restore', async () => {
      await run({ restore: true })
      vscode.window.setStatusBarMessage('AsciiDoc Preview Light 2026 removed from user settings.', 4000)
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('asciidocPreviewStyle') ||
        e.affectsConfiguration('asciidoc.preview.defaultStyle') ||
        e.affectsConfiguration('asciidoc.preview.useEditorStyle') ||
        e.affectsConfiguration(STYLE_KEY)
      ) {
        run()
      }
    }),
    vscode.extensions.onDidChange(() => run()),
  )

  return run()
}

function deactivate() {}

module.exports = { activate, deactivate, sync }

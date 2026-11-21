'use strict'
// Run by VS Code on uninstall (package.json "vscode:uninstall"). Best effort and
// limited to the installation this extension is being removed from: it removes
// only the top-level "asciidoc.preview.style" entry whose value is exactly this
// installation's generated bundle. Anything else (user values, other VS Code
// flavours, unknown layouts) is left untouched; see README for manual recovery.
const fs = require("fs")
const os = require("os")
const path = require("path")
const { removeStyleSetting, BUNDLE_NAME, EXTENSION_ID } = require("./lib/core")

// <root>/extensions/<this extension>  ->  user data directory of the same install
function userDataDir() {
  const extensionsDir = path.resolve(__dirname, "..")
  if (path.basename(extensionsDir) !== "extensions") return undefined
  const root = path.dirname(extensionsDir)
  const portable = path.join(root, "user-data")
  if (fs.existsSync(portable)) return portable // portable layout (e.g. Scoop)
  const flavour = {
    ".vscode": "Code",
    ".vscode-insiders": "Code - Insiders",
    ".vscode-oss": "VSCodium",
  }[path.basename(root)]
  if (!flavour || path.dirname(root) !== os.homedir()) return undefined
  if (process.platform === "win32" && process.env.APPDATA) return path.join(process.env.APPDATA, flavour)
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", flavour)
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), flavour)
}

const dir = userDataDir()
if (dir) {
  const settings = path.join(dir, "User", "settings.json")
  const bundle = path.join(dir, "User", "globalStorage", EXTENSION_ID, BUNDLE_NAME)
  try {
    const text = fs.readFileSync(settings, "utf8")
    const next = removeStyleSetting(text, bundle)
    if (next !== text) {
      fs.writeFileSync(`${settings}.tmp`, next)
      fs.renameSync(`${settings}.tmp`, settings)
    }
  } catch {
    // missing or unreadable settings: ignore
  }
}

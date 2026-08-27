/**
 * Embed build/icon.ico into Windows executables after electron-builder.
 * The portable wrapper often keeps the Electron default icon otherwise.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ResEdit from 'resedit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const icoPath = path.join(root, 'build', 'icon.ico')
const distDir = path.join(root, 'dist')

function listTargetExes() {
  const targets = []
  const unpacked = path.join(distDir, 'win-unpacked', 'FluxPomo.exe')
  if (fs.existsSync(unpacked)) targets.push(unpacked)

  if (fs.existsSync(distDir)) {
    for (const name of fs.readdirSync(distDir)) {
      if (name.toLowerCase().endsWith('.exe')) {
        targets.push(path.join(distDir, name))
      }
    }
  }
  return [...new Set(targets)]
}

function applyIcon(exePath, iconFile) {
  const exeData = fs.readFileSync(exePath)
  const icoData = fs.readFileSync(iconFile)

  const exe = ResEdit.NtExecutable.from(exeData, { ignoreCert: true })
  const res = ResEdit.NtExecutableResource.from(exe)
  const iconFileBin = ResEdit.Data.IconFile.from(icoData)
  const iconDatas = iconFileBin.icons.map((item) => item.data)

  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  const targets =
    groups.length > 0
      ? groups.map((group) => ({ id: group.id, lang: group.lang }))
      : [{ id: 1, lang: 1033 }]

  for (const { id, lang } of targets) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      id,
      lang,
      iconDatas
    )
  }

  res.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))
  console.log(
    `Applied icon → ${path.relative(root, exePath)} (groups: ${targets
      .map((t) => t.id)
      .join(', ')})`
  )
}

if (!fs.existsSync(icoPath)) {
  console.error('Missing build/icon.ico — run npm run icons:generate first')
  process.exit(1)
}

const targets = listTargetExes()
if (targets.length === 0) {
  console.error('No Windows executables found under dist/')
  process.exit(1)
}

for (const exePath of targets) {
  applyIcon(exePath, icoPath)
}

console.log('Done.')

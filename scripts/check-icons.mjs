/**
 * Ensure pre-rendered packaging icons exist (no generation at build/release time).
 * Regenerate with: npm run icons:generate
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const required = [
  path.join(root, 'build', 'icon.ico'),
  path.join(root, 'build', 'icon.icns'),
  path.join(root, 'build', 'icon.png'),
  path.join(root, 'resources', 'icon.png')
]

const missing = required.filter((filePath) => !fs.existsSync(filePath))

if (missing.length > 0) {
  console.error('Missing pre-rendered icon files:')
  for (const filePath of missing) {
    console.error(' -', path.relative(root, filePath))
  }
  console.error('\nRun: npm run icons:generate')
  process.exit(1)
}

const ico = fs.readFileSync(path.join(root, 'build', 'icon.ico'))
const entries = ico.readUInt16LE(4)
if (entries < 3) {
  console.error(
    `build/icon.ico looks incomplete (${entries} sizes). Run: npm run icons:generate`
  )
  process.exit(1)
}

console.log('Pre-rendered icons OK:')
for (const filePath of required) {
  const { size } = fs.statSync(filePath)
  console.log(` - ${path.relative(root, filePath)} (${size} bytes)`)
}

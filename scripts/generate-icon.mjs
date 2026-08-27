/**
 * Generate packaging + runtime icons from the Flux Pomo logo.
 * Uses png-to-ico so Windows Explorer gets a proper multi-size .ico.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sourceWebp = path.join(root, 'resources', 'Flux Pomo logo.webp')
const buildDir = path.join(root, 'build')
const resourcesDir = path.join(root, 'resources')
const buildPng = path.join(buildDir, 'icon.png')
const resourcesPng = path.join(resourcesDir, 'icon.png')
const icoPath = path.join(buildDir, 'icon.ico')

function rasterizeWebpToPng() {
  const script = `
from pathlib import Path
from PIL import Image
src = Path(r'''${sourceWebp}''')
out = Path(r'''${buildPng}''')
img = Image.open(src).convert('RGBA')
side = max(img.size)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
canvas.resize((512, 512), Image.Resampling.LANCZOS).save(out)
print('png ok')
`
  const result = spawnSync('python', ['-c', script], { encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    process.exit(result.status || 1)
  }
}

function icoEntryCount(filePath) {
  const buf = fs.readFileSync(filePath)
  return buf.readUInt16LE(4)
}

fs.mkdirSync(buildDir, { recursive: true })
rasterizeWebpToPng()
fs.copyFileSync(buildPng, resourcesPng)

const icoBuffer = await pngToIco(buildPng)
fs.writeFileSync(icoPath, icoBuffer)

const entries = icoEntryCount(icoPath)
console.log('Wrote', buildPng)
console.log('Wrote', resourcesPng)
console.log(`Wrote ${icoPath} (${icoBuffer.length} bytes, ${entries} sizes)`)

if (entries < 3) {
  console.error('ICO generation failed: expected multiple sizes for Windows Explorer')
  process.exit(1)
}

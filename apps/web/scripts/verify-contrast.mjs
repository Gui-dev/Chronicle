#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app/globals.css')
const css = readFileSync(cssPath, 'utf8')

// The plain `:root` selector never matches the light block: after `:root`
// comes `[`, not `{`.
const blocks = {
  dark: css.match(/:root\s*\{[^}]*\}/)?.[0],
  light: css.match(/:root\[data-theme=['"]light['"]\]\s*\{[^}]*\}/)?.[0],
}

function readVar(theme, name) {
  const block = blocks[theme]
  if (!block) throw new Error(`no palette block found in globals.css for theme "${theme}"`)
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6}(?![0-9a-fA-F]))`))
  if (!match) {
    throw new Error(
      `no #rrggbb literal found for ${name} in the ${theme} palette block of globals.css`,
    )
  }
  return match[1]
}

function luminance(hex) {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255)
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const names = [
  '--background',
  '--foreground',
  '--card',
  '--text',
  '--muted',
  '--muted-foreground',
  '--input',
  '--border',
  '--ring',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
]

const checks = [
  ['--muted-foreground text on --card', '--muted-foreground', '--card', 4.5],
  ['--muted-foreground text on --background', '--muted-foreground', '--background', 4.5],
  ['--text on --background', '--text', '--background', 4.5],
  ['--text on --card', '--text', '--card', 4.5],
  ['--muted text on --background', '--muted', '--background', 4.5],
  ['--muted text on --card', '--muted', '--card', 4.5],
  ['--primary on --background', '--primary', '--background', 4.5],
  ['--primary on --card', '--primary', '--card', 4.5],
  ['--primary-foreground on --primary', '--primary-foreground', '--primary', 4.5],
  ['--secondary on --background', '--secondary', '--background', 4.5],
  ['--secondary-foreground on --secondary', '--secondary-foreground', '--secondary', 4.5],
  ['--accent-foreground on --accent', '--accent-foreground', '--accent', 4.5],
  ['--destructive-foreground on --destructive', '--destructive-foreground', '--destructive', 4.5],
  ['--input border vs --background (UI 3:1)', '--input', '--background', 3],
  ['--input border vs --card (UI 3:1)', '--input', '--card', 3],
  ['--border vs --card (UI 3:1)', '--border', '--card', 3],
  ['--foreground on --background (body)', '--foreground', '--background', 4.5],
  ['--background on --primary (buttons)', '--background', '--primary', 4.5],
  ['--ring vs --background (UI 3:1)', '--ring', '--background', 3],
  ['--border vs --background (UI 3:1)', '--border', '--background', 3],
]

let failed = 0
for (const theme of Object.keys(blocks)) {
  const palette = Object.fromEntries(names.map((name) => [name, readVar(theme, name)]))
  for (const [label, fg, bg, min] of checks) {
    const ratio = contrast(palette[fg], palette[bg])
    const ok = ratio >= min
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${ratio.toFixed(2)}:1 (min ${min}) — [${theme}] ${label}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} contrast check(s) failed`)
  process.exit(1)
}
console.log('\nall contrast checks passed')

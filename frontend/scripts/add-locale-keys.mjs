#!/usr/bin/env node
/* Adds new UI strings to all 17 locale packs: `node scripts/add-locale-keys.mjs <file.json>`, where
 * the JSON maps each English key to { "tr": "…" }. Turkish gets its translation; every other pack
 * gets the English text, so check-locales stays green. Keys a pack already has are left alone.
 * Each key goes in just before the pack's closing brace. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales')
const keys = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const quote = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
for (const file of readdirSync(dir).filter(f => f.endsWith('.js') && !f.includes('.test.'))) {
  const lang = file.replace(/\.js$/, '')
  const src = readFileSync(join(dir, file), 'utf8')
  const lines = src.split('\n')
  const end = lines.lastIndexOf('}')
  if (end < 0) throw new Error('no closing brace in ' + file)
  const add = Object.entries(keys)
    .filter(([en]) => !src.includes(quote(en) + ':'))
    .map(([en, tr]) => `  ${quote(en)}: ${quote(lang === 'tr' ? tr.tr : en)},`)
  lines.splice(end, 0, ...add)
  writeFileSync(join(dir, file), lines.join('\n'))
  console.log(file, '+' + add.length)
}

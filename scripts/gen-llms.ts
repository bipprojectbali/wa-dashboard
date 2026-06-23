#!/usr/bin/env bun
/**
 * Generates llms.txt at the project root from live project sources.
 * Core logic lives in src/lib/llms-generator.ts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildLlmsTxt } from '../src/lib/llms-generator'

const OUTPUT_PATH = join(process.cwd(), 'llms.txt')
const isCheck = process.argv.includes('--check')

const generated = buildLlmsTxt()

if (isCheck) {
  const current = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, 'utf-8') : ''
  if (current !== generated) {
    console.error('✗ llms.txt is out of date. Run `bun run docs:llms` and commit the result.')
    process.exit(1)
  }
  console.log('✓ llms.txt is up to date.')
  process.exit(0)
}

writeFileSync(OUTPUT_PATH, generated)
console.log(`✓ Wrote ${OUTPUT_PATH} (${generated.length} chars)`)

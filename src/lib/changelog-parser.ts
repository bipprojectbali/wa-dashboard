import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type ChangelogSection = 'Added' | 'Changed' | 'Fixed' | 'Removed'

export interface ChangelogEntry {
  version: string
  date: string | null
  sections: Partial<Record<ChangelogSection, string[]>>
}

const CHANGELOG_PATH = join(import.meta.dir, '../../CHANGELOG.md')

const VERSION_REGEX = /^## \[(.+?)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/
const SECTION_REGEX = /^### (Added|Changed|Fixed|Removed)/
const ITEM_REGEX = /^-\s+(.+)/

export function parseChangelog(): ChangelogEntry[] {
  let raw: string
  try {
    raw = readFileSync(CHANGELOG_PATH, 'utf-8')
  } catch {
    return []
  }

  const entries: ChangelogEntry[] = []
  let current: ChangelogEntry | null = null
  let currentSection: ChangelogSection | null = null

  for (const line of raw.split('\n')) {
    const versionMatch = line.match(VERSION_REGEX)
    if (versionMatch) {
      if (current) entries.push(current)
      current = { version: versionMatch[1], date: versionMatch[2] ?? null, sections: {} }
      currentSection = null
      continue
    }

    if (!current) continue

    const sectionMatch = line.match(SECTION_REGEX)
    if (sectionMatch) {
      currentSection = sectionMatch[1] as ChangelogSection
      current.sections[currentSection] = []
      continue
    }

    if (currentSection) {
      const itemMatch = line.match(ITEM_REGEX)
      if (itemMatch) {
        current.sections[currentSection]!.push(itemMatch[1])
      }
    }
  }

  if (current) entries.push(current)
  return entries
}

export function getLatestEntry(): ChangelogEntry | null {
  const entries = parseChangelog()
  return entries.find((e) => e.version !== 'Unreleased') ?? entries[0] ?? null
}

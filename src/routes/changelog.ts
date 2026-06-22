import { Elysia } from 'elysia'
import { getLatestEntry, parseChangelog } from '../lib/changelog-parser'

export const changelogRouter = new Elysia().get(
  '/api/changelog',
  ({ query }) => {
    if (query.all === 'true') return parseChangelog()
    const latest = getLatestEntry()
    if (!latest) return { version: null, date: null, sections: {} }
    return latest
  },
  {
    detail: {
      tags: ['Utility'],
      summary: 'App changelog',
      description: 'Returns the latest changelog entry. Pass `?all=true` for all versions.',
      responses: { 200: { description: 'Changelog entry or list' } },
    },
  },
)

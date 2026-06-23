import { Elysia } from 'elysia'
import { buildLlmsTxt } from '../lib/llms-generator'

export const llmsRouter = new Elysia().get(
  '/llms.txt',
  () =>
    new Response(buildLlmsTxt(), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    }),
  {
    detail: {
      tags: ['Utility'],
      summary: 'LLM-friendly project summary',
      description:
        'Auto-generated llms.txt: project metadata, routes, schema, env vars, and recent changes. Rebuilt live from project sources on each request.',
      responses: { 200: { description: 'Plain-text llms.txt' } },
    },
  },
)

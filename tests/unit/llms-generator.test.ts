import { describe, expect, it } from 'bun:test'
import { buildLlmsTxt, generateLlmsTxt, type LlmsData } from '../../src/lib/llms-generator'

const fixture: LlmsData = {
  meta: { name: 'demo-app', version: '1.2.3', description: 'A demo project' },
  routes: [
    { method: 'GET', path: '/api/users', auth: 'admin', category: 'admin', description: 'List users' },
    { method: 'POST', path: '/api/login', auth: 'public', category: 'auth', description: 'Sign in' },
    { method: 'GET', path: '/llms.txt', auth: 'public', category: 'utility', description: 'LLM summary' },
  ],
  schema: {
    models: [
      {
        name: 'User',
        tableName: 'user',
        fields: [
          { name: 'id', type: 'String', isId: true, isUnique: false, isOptional: false, isList: false, isRelation: false },
          {
            name: 'email',
            type: 'String',
            isId: false,
            isUnique: true,
            isOptional: false,
            isList: false,
            isRelation: false,
          },
        ],
      },
    ],
    enums: [{ name: 'Role', values: ['USER', 'ADMIN'] }],
    relations: [],
  },
  env: [
    {
      name: 'DATABASE_URL',
      envKey: 'DATABASE_URL',
      required: true,
      default: null,
      category: 'database',
      description: 'PG connection',
    },
    {
      name: 'PORT',
      envKey: 'PORT',
      required: false,
      default: '3111',
      category: 'server',
      description: 'HTTP port',
    },
  ],
  changelog: [
    { version: 'Unreleased', date: null, sections: { Added: ['should not appear'] } },
    { version: '1.2.3', date: '2026-06-23', sections: { Added: ['New thing'], Fixed: ['A bug'] } },
  ],
  docs: [{ title: 'API', path: 'docs/API.md', summary: 'Route contracts' }],
}

describe('generateLlmsTxt (deterministic fixture)', () => {
  const out = generateLlmsTxt(fixture)

  it('renders header with name + version', () => {
    expect(out).toContain('# demo-app (v1.2.3)')
    expect(out).toContain('> A demo project')
  })

  it('declares it is auto-generated', () => {
    expect(out).toContain('auto-generated')
  })

  it('groups routes by category with method/path/auth format', () => {
    expect(out).toContain('### admin')
    expect(out).toContain('### auth')
    expect(out).toContain('`GET /api/users` (admin)')
    expect(out).toContain('`POST /api/login` (public)')
  })

  it('renders schema enums and models', () => {
    expect(out).toContain('**Role**: USER | ADMIN')
    expect(out).toContain('**User** (table `user`)')
    expect(out).toContain('email')
  })

  it('marks env required vs optional', () => {
    expect(out).toContain('`DATABASE_URL` (required)')
    expect(out).toContain('`PORT` (optional, default: 3111)')
  })

  it('renders released changelog but skips Unreleased', () => {
    expect(out).toContain('### 1.2.3 — 2026-06-23')
    expect(out).toContain('Added: New thing')
    expect(out).not.toContain('should not appear')
  })

  it('renders doc links', () => {
    expect(out).toContain('[API](docs/API.md)')
  })
})

describe('buildLlmsTxt (real project sources)', () => {
  const out = buildLlmsTxt()

  it('contains the major sections', () => {
    expect(out).toContain('## API Routes')
    expect(out).toContain('## Database Schema')
    expect(out).toContain('## Environment Variables')
  })

  it('contains a real project model', () => {
    expect(out).toContain('**User**')
  })

  it('references itself in the route catalog', () => {
    expect(out).toContain('/llms.txt')
  })
})

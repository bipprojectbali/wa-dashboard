import { swagger } from '@elysiajs/swagger'
import pkg from '../../package.json'

export const swaggerPlugin = swagger({
  path: '/api/docs',
  documentation: {
    info: {
      title: 'WA Dashboard API',
      version: pkg.version,
      description: `Full-stack Bun + Elysia + Better Auth API.\n\n**Auth:** All protected endpoints require a valid session cookie (\`better-auth.session_token\`).\n\n**Roles:** \`USER\` → \`QC\` → \`ADMIN\` → \`SUPER_ADMIN\``,
      contact: { name: 'API Docs', url: '/api/docs' },
    },
    tags: [
      { name: 'Utility', description: 'Health check, version, and example routes' },
      { name: 'Auth', description: 'Better Auth — sign in, sign out, session, Google OAuth' },
      { name: 'Tickets', description: 'Ticket management — requires QC, ADMIN, or SUPER_ADMIN' },
      { name: 'Admin — Users', description: 'User management — requires SUPER_ADMIN' },
      { name: 'Admin — Logs', description: 'App and audit logs — requires SUPER_ADMIN' },
      {
        name: 'Admin — Info',
        description:
          'Project introspection (schema, routes, env, coverage, deps, migrations, sessions) — requires SUPER_ADMIN',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description: 'Session cookie set by Better Auth on sign-in',
        },
      },
    },
  },
  scalarConfig: {
    spec: { url: '/api/docs/json' },
  },
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
  },
})

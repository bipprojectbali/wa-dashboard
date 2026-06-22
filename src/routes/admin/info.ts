import { Elysia } from 'elysia'
import { adminDependenciesRouter } from './dependencies'
import { adminEnvMapRouter } from './env-map'
import { adminFileHealthRouter } from './file-health'
import { adminMigrationsRouter } from './migrations'
import { adminPresenceRouter } from './presence'
import { adminProjectStructureRouter } from './project-structure'
import { adminRoutesListRouter } from './routes-list'
import { adminSchemaRouter } from './schema-endpoint'
import { adminSessionsRouter } from './sessions'
import { adminTestCoverageRouter } from './test-coverage'

export const adminInfoRouter = new Elysia()
  .use(adminPresenceRouter)
  .use(adminSchemaRouter)
  .use(adminRoutesListRouter)
  .use(adminProjectStructureRouter)
  .use(adminEnvMapRouter)
  .use(adminTestCoverageRouter)
  .use(adminDependenciesRouter)
  .use(adminMigrationsRouter)
  .use(adminSessionsRouter)
  .use(adminFileHealthRouter)

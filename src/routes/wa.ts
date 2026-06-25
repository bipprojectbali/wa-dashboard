import { Elysia } from 'elysia'
import { waClientRouter } from './wa.client'
import { waPolicyRouter } from './wa.policy'
import { waSessionRouter } from './wa.session'
import { waVerifyAdminRouter } from './wa.verify.admin'
import { waVerifyLogsRouter } from './wa.verify.logs'
import { waVerifyPublicRouter } from './wa.verify.public'
import { waVerifySimRouter } from './wa.verify.sim'
import { waWsRouter } from './wa.ws'

export const waRouter = new Elysia()
  .use(waSessionRouter)
  .use(waClientRouter)
  .use(waPolicyRouter)
  .use(waWsRouter)
  .use(waVerifyPublicRouter)
  .use(waVerifyAdminRouter)
  .use(waVerifyLogsRouter)
  .use(waVerifySimRouter)

import { Elysia } from 'elysia'
import { adminLogsAppRouter } from './logs.app'
import { adminLogsAuditRouter } from './logs.audit'

export const adminLogsRouter = new Elysia().use(adminLogsAppRouter).use(adminLogsAuditRouter)

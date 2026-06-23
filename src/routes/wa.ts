import { Elysia } from 'elysia'
import { waClientRouter } from './wa.client'
import { waPolicyRouter } from './wa.policy'
import { waSessionRouter } from './wa.session'
import { waWsRouter } from './wa.ws'

export const waRouter = new Elysia().use(waSessionRouter).use(waClientRouter).use(waPolicyRouter).use(waWsRouter)

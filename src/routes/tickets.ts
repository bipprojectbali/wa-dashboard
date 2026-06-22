import { Elysia } from 'elysia'
import { ticketsReadRouter } from './tickets.read'
import { ticketsSubRouter } from './tickets.sub'
import { ticketsWriteRouter } from './tickets.write'

export const ticketsRouter = new Elysia().use(ticketsReadRouter).use(ticketsWriteRouter).use(ticketsSubRouter)

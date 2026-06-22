import { Elysia } from 'elysia'
import { adminUsersReadRouter } from './users.read'
import { adminUsersWriteRouter } from './users.write'

export const adminUsersRouter = new Elysia().use(adminUsersReadRouter).use(adminUsersWriteRouter)

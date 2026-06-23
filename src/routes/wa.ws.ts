import { Elysia } from 'elysia'
import { auth } from '../lib/auth'
import { subscribe, unsubscribe } from '../lib/wa-bridge'

// Browser-facing WS: relays container events for the user's own session only.
// Auth via session cookie; subscriberId = authenticated user's id.

export const waWsRouter = new Elysia().ws('/ws/wa', {
  async open(ws) {
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: ws.data.headers?.cookie ?? '' }),
    })
    if (!session) {
      ws.close(4001, 'Unauthorized')
      return
    }
    const user = session.user as { id: string; role: string; blocked?: boolean }
    if (user.blocked || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      ws.close(4003, 'Forbidden')
      return
    }
    ;(ws.data as unknown as { userId: string }).userId = user.id
    subscribe(user.id, ws as never)
  },
  close(ws) {
    const userId = (ws.data as unknown as { userId?: string }).userId
    if (userId) unsubscribe(userId, ws as never)
  },
  message() {},
})

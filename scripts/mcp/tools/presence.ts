import { z } from 'zod'
import { prisma } from '../../../src/lib/db'
import { getOnlineUserIds } from '../../../src/lib/presence'
import { jsonText, type ToolModule } from './shared'

export const presenceTools: ToolModule = {
  name: 'presence',
  scope: 'readonly',
  register(server) {
    server.registerTool(
      'presence_online',
      {
        title: 'Online users',
        description: 'List currently connected users (via WebSocket presence tracker)',
        inputSchema: z.object({}),
      },
      async () => {
        const ids = getOnlineUserIds()
        if (ids.length === 0) return jsonText({ count: 0, users: [] })
        const users = await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true, role: true },
        })
        return jsonText({ count: users.length, users })
      },
    )
  },
}

import type { ToolModule } from './shared'
import { registerReadTools } from './tickets.read'
import { registerWriteTools } from './tickets.write'

export const ticketTools: ToolModule = {
  name: 'tickets',
  scope: 'admin',
  register(server) {
    registerReadTools(server)
    registerWriteTools(server)
  },
}

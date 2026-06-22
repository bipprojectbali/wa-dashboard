import type { ToolModule } from './shared'
import { registerCompareTools } from './stg.compare'
import { registerInspectTools } from './stg.inspect'

export const stgTools: ToolModule = {
  name: 'stg',
  scope: 'admin',
  register(server) {
    registerInspectTools(server)
    registerCompareTools(server)
  },
}

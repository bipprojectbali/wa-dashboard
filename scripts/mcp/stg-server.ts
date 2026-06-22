import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { stgTools } from './tools/stg'

if (!process.env.BASE_URL) {
  process.stderr.write('ERROR: BASE_URL env var is required for debug-stg MCP server\n')
  process.exit(1)
}

if (!process.env.MCP_SECRET) {
  process.stderr.write('ERROR: MCP_SECRET env var is required for debug-stg MCP server\n')
  process.exit(1)
}

const server = new McpServer({
  name: 'debug-stg',
  version: '0.1.0',
})

stgTools.register(server)

const transport = new StdioServerTransport()
await server.connect(transport)

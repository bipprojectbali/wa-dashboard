import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export type McpScope = 'readonly' | 'admin'

export interface ToolModule {
  name: string
  scope: McpScope
  register(server: McpServer): void
}

export function jsonText(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  }
}

export function errText(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  }
}

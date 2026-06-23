import type { ServerWebSocket } from 'bun'
import { appLog } from './applog'
import { env } from './env'

// Bridge: dashboard backend is a WS *client* to the container (/ws/:userId),
// relaying events to that user's browser WS connections only.
// Graceful: if the container WS is unavailable (ENABLE_WEBSOCKET off), the
// bridge stays quiet and the frontend falls back to polling.

type BrowserWs = ServerWebSocket<{ userId: string }>

interface Bridge {
  client: WebSocket | null
  subscribers: Set<BrowserWs>
  retry: number
  closing: boolean
  timer: ReturnType<typeof setTimeout> | null
}

const bridges = new Map<string, Bridge>()
const MAX_BACKOFF_MS = 30_000

function wsUrl(userId: string): string {
  const base = env.WA_API_BASE_URL.replace(/^http/, 'ws')
  return `${base}/ws/${userId}`
}

function connect(userId: string, bridge: Bridge) {
  if (bridge.client || bridge.closing) return
  if (!env.WA_API_BASE_URL || !env.WA_API_KEY) return

  let client: WebSocket
  try {
    client = new WebSocket(wsUrl(userId), { headers: { 'x-api-key': env.WA_API_KEY } } as unknown as string[])
  } catch (e) {
    appLog('warn', `WA bridge connect failed for ${userId}: ${e instanceof Error ? e.message : String(e)}`)
    scheduleReconnect(userId, bridge)
    return
  }
  bridge.client = client

  client.onopen = () => {
    bridge.retry = 0
  }
  client.onmessage = (ev) => {
    relay(bridge, typeof ev.data === 'string' ? ev.data : String(ev.data))
  }
  client.onclose = () => {
    bridge.client = null
    if (!bridge.closing && bridge.subscribers.size > 0) scheduleReconnect(userId, bridge)
  }
  client.onerror = () => {
    // onclose follows; reconnect handled there.
  }
}

function scheduleReconnect(userId: string, bridge: Bridge) {
  if (bridge.timer || bridge.closing) return
  const delay = Math.min(1000 * 2 ** bridge.retry, MAX_BACKOFF_MS)
  bridge.retry += 1
  bridge.timer = setTimeout(() => {
    bridge.timer = null
    if (bridge.subscribers.size > 0) connect(userId, bridge)
  }, delay)
}

function relay(bridge: Bridge, data: string) {
  for (const ws of bridge.subscribers) {
    try {
      ws.send(data)
    } catch {}
  }
}

export function subscribe(userId: string, ws: BrowserWs) {
  let bridge = bridges.get(userId)
  if (!bridge) {
    bridge = { client: null, subscribers: new Set(), retry: 0, closing: false, timer: null }
    bridges.set(userId, bridge)
  }
  bridge.closing = false
  bridge.subscribers.add(ws)
  connect(userId, bridge)
}

export function unsubscribe(userId: string, ws: BrowserWs) {
  const bridge = bridges.get(userId)
  if (!bridge) return
  bridge.subscribers.delete(ws)
  if (bridge.subscribers.size === 0) {
    bridge.closing = true
    if (bridge.timer) {
      clearTimeout(bridge.timer)
      bridge.timer = null
    }
    bridge.client?.close()
    bridge.client = null
    bridges.delete(userId)
  }
}

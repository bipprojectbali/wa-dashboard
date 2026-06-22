import { useEffect, useRef, useState } from 'react'
import { useSession } from './useAuth'

interface PresenceMessage {
  type: 'presence'
  online: string[]
}

export function usePresence() {
  const { data } = useSession()
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!data?.user) return

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws/presence`)
      wsRef.current = ws

      ws.onmessage = (e: MessageEvent<string>) => {
        const msg = JSON.parse(e.data) as PresenceMessage
        if (msg.type === 'presence') {
          setOnlineUserIds(msg.online)
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        // Reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect on cleanup
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [data?.user?.id, data?.user])

  return { onlineUserIds }
}

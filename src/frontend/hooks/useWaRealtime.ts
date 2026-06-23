import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useSession } from './useAuth'

// Connects to the dashboard WS bridge (/ws/wa). On any container event,
// invalidate the WA status/qr queries. `wsReady` lets panels decide whether
// to fall back to polling (when the container WS is unavailable).

interface WaEvent {
  dataType?: string
  data?: unknown
  [key: string]: unknown
}

export function useWaRealtime() {
  const { data } = useSession()
  const qc = useQueryClient()
  const [wsReady, setWsReady] = useState(false)
  const [lastEvent, setLastEvent] = useState<WaEvent | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!data?.user) return

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws/wa`)
      wsRef.current = ws

      ws.onopen = () => setWsReady(true)

      ws.onmessage = (e: MessageEvent<string>) => {
        let msg: WaEvent
        try {
          msg = JSON.parse(e.data) as WaEvent
        } catch {
          return
        }
        setLastEvent(msg)
        qc.invalidateQueries({ queryKey: ['wa', 'status'] })
        qc.invalidateQueries({ queryKey: ['wa', 'qr'] })
      }

      ws.onclose = () => {
        wsRef.current = null
        setWsReady(false)
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [data?.user?.id, data?.user, qc])

  return { wsReady, lastEvent }
}

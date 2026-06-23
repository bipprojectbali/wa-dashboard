import { Avatar } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/frontend/lib/apiFetch'

interface AvatarResp {
  url: string | null
}

function initials(name?: string): string | undefined {
  const n = name?.trim()
  if (!n) return undefined
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

// Avatar di-fetch hanya saat baris masuk viewport — tabel kontak bisa ratusan
// baris dan tiap avatar = 1 panggilan upstream per nomor.
export function WaContactAvatar({ contactId, name }: { contactId: string; name?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: '100px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible])

  const { data } = useQuery({
    queryKey: ['wa', 'avatar', contactId],
    queryFn: () => apiFetch<AvatarResp>(`/api/wa/avatar?contactId=${encodeURIComponent(contactId)}`),
    enabled: visible && contactId.length > 0,
    staleTime: 30 * 60_000,
  })

  return (
    <div ref={ref}>
      <Avatar src={data?.url ?? undefined} radius="xl" size={32}>
        {initials(name)}
      </Avatar>
    </div>
  )
}

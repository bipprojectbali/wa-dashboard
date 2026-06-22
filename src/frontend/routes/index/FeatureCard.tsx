import { Text } from '@mantine/core'
import { FcGoogle } from 'react-icons/fc'
import { SiBun, SiPostgresql, SiPrisma, SiReact, SiRedis, SiVite } from 'react-icons/si'
import {
  TbBolt,
  TbDatabase,
  TbKey,
  TbShieldCheck,
  TbUsers,
  TbWifi,
} from 'react-icons/tb'
import { useEffect, useRef, useState } from 'react'

export const features = [
  {
    icon: TbShieldCheck,
    color: '#4f8ef7',
    title: 'Secure Auth',
    desc: 'Google OAuth + email/password. HttpOnly signed cookies, Redis sessions, blocked-user guard.',
  },
  {
    icon: TbBolt,
    color: '#f59e0b',
    title: 'Fast Backend',
    desc: 'Bun runtime + Elysia.js. End-to-end type safety, auto OpenAPI docs, zero-overhead routing.',
  },
  {
    icon: TbDatabase,
    color: '#22c55e',
    title: 'Type-Safe DB',
    desc: 'Prisma ORM + PostgreSQL. Auto-generated client, migrations, and type-safe queries.',
  },
  {
    icon: TbWifi,
    color: '#a855f7',
    title: 'Real-Time',
    desc: 'WebSocket presence tracking. Know who is online instantly across all connected clients.',
  },
  {
    icon: TbUsers,
    color: '#ec4899',
    title: 'Role Access',
    desc: 'Four roles: USER, QC, ADMIN, SUPER_ADMIN. Fine-grained route guards and permission layers.',
  },
  {
    icon: TbKey,
    color: '#f97316',
    title: 'Dev Console',
    desc: 'Built-in /dev panel: logs, DB schema, user management, MCP integration, file health.',
  },
]

export const tech = [
  { icon: SiBun, label: 'Bun', color: '#f5d5aa' },
  { icon: SiReact, label: 'React 19', color: '#61dafb' },
  { icon: SiVite, label: 'Vite 8', color: '#a855f7' },
  { icon: SiPrisma, label: 'Prisma', color: '#6366f1' },
  { icon: SiPostgresql, label: 'PostgreSQL', color: '#3d7ee8' },
  { icon: SiRedis, label: 'Redis', color: '#ff4438' },
  { icon: FcGoogle, label: 'Google Auth', color: '' },
]

export function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true)
      },
      { threshold: 0.15 },
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

export function FeatureCard({ icon: Icon, color, title, desc, delay }: (typeof features)[0] & { delay: number }) {
  const { ref, visible } = useScrollReveal()
  return (
    <div
      ref={ref}
      style={{
        background: 'rgba(255,255,255,0.032)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '28px 24px',
        transition: `opacity 0.6s ${delay}ms, transform 0.6s ${delay}ms, border-color 0.2s, background 0.2s`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.borderColor = `${color}55`
        el.style.background = `${color}0d`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.borderColor = 'rgba(255,255,255,0.07)'
        el.style.background = 'rgba(255,255,255,0.032)'
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon size={22} color={color} />
      </div>
      <Text fw={700} size="sm" c="white" mb={8}>
        {title}
      </Text>
      <Text size="sm" lh={1.65} style={{ color: 'rgba(255,255,255,0.48)' }}>
        {desc}
      </Text>
    </div>
  )
}

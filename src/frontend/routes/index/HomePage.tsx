import { Button, Group, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { SiBun } from 'react-icons/si'
import { TbArrowDown, TbArrowRight, TbBolt, TbLogin } from 'react-icons/tb'
import { Scene3D } from '@/frontend/components/landing/Scene3D'
import { ThemeToggle } from '@/frontend/components/ThemeToggle'
import { FeatureCard, features, tech, useScrollReveal } from './FeatureCard'

export function HomePage() {
  const { ref: ctaRef, visible: ctaVisible } = useScrollReveal()

  return (
    <>
      {/* Canvas fixed — tetap terlihat sepanjang scroll */}
      <Scene3D />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100dvh', fontFamily: 'system-ui, sans-serif' }}>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section style={{ height: '100dvh', position: 'relative' }}>
          {/* Vignette — perkuat kontras teks di atas canvas */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              background: [
                'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(9,9,15,0.45) 0%, transparent 60%)',
                'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(9,9,15,0.92) 100%)',
              ].join(','),
            }}
          />

          {/* Navbar */}
          <nav
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 48px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)',
              background: 'rgba(9,9,15,0.6)',
            }}
          >
            <Group gap="xs">
              <SiBun size={20} color="#f5d5aa" />
              <Text fw={700} size="sm" style={{ color: '#f8fafc', letterSpacing: '-0.02em' }}>
                WA Dashboard
              </Text>
            </Group>
            <Group gap="sm">
              <ThemeToggle size="sm" />
              <Button component={Link} to="/login" size="xs" leftSection={<TbLogin size={13} />} variant="filled">
                Sign In
              </Button>
            </Group>
          </nav>

          {/* Hero text overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 24px',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 14px',
                borderRadius: 99,
                background: 'rgba(79,142,247,0.12)',
                border: '1px solid rgba(79,142,247,0.28)',
                marginBottom: 28,
              }}
            >
              <TbBolt size={13} color="#4f8ef7" />
              <Text
                size="xs"
                fw={600}
                style={{ color: '#4f8ef7', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                Full-Stack Starter Template
              </Text>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(2.4rem, 6.5vw, 5rem)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1.06,
                color: '#f8fafc',
                maxWidth: 820,
              }}
            >
              Build production apps
              <span
                style={{
                  display: 'block',
                  background: 'linear-gradient(135deg, #4f8ef7, #a855f7)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                at lightning speed
              </span>
            </h1>

            <p
              style={{
                margin: '24px 0 0',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                lineHeight: 1.7,
                color: 'rgba(248,250,252,0.52)',
                maxWidth: 520,
              }}
            >
              Interact with the network above — drag nodes, hover to reveal connections, move your cursor to push them
              around.
            </p>

            <div
              style={{
                marginTop: 36,
                display: 'flex',
                gap: 12,
                pointerEvents: 'all',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <Button
                component={Link}
                to="/login"
                size="md"
                leftSection={<TbLogin size={16} />}
                rightSection={<TbArrowRight size={16} />}
                style={{ background: 'linear-gradient(135deg, #4f8ef7, #6366f1)', border: 'none', fontWeight: 700 }}
              >
                Get Started
              </Button>
              <Button
                component={Link}
                to="/dashboard"
                size="md"
                variant="subtle"
                style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                View Demo
              </Button>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              animation: 'bob 2s ease-in-out infinite',
            }}
          >
            <style>{`@keyframes bob { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} }`}</style>
            <TbArrowDown size={20} color="rgba(255,255,255,0.25)" />
          </div>
        </section>

        {/* ── Tech stack strip ─────────────────────────────── */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '20px 0',
            background: 'rgba(9,9,15,0.82)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap', padding: '0 24px' }}>
            {tech.map(({ icon: Icon, label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.6 }}>
                <Icon size={17} color={color || undefined} />
                <Text size="sm" fw={500} style={{ color: 'rgba(248,250,252,0.7)' }}>
                  {label}
                </Text>
              </div>
            ))}
          </div>
        </div>

        {/* ── Features grid ────────────────────────────────── */}
        <section
          style={{
            padding: 'clamp(48px,8vw,96px) clamp(16px,6vw,80px)',
            background: 'rgba(9,9,15,0.78)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <Text
              ta="center"
              size="xs"
              fw={700}
              style={{ color: '#4f8ef7', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}
            >
              Features
            </Text>
            <h2
              style={{
                margin: '0 0 12px',
                textAlign: 'center',
                fontSize: 'clamp(1.6rem,4vw,2.4rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#f8fafc',
              }}
            >
              Everything you need
            </h2>
            <p
              style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 48,
                maxWidth: 440,
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: 1.7,
              }}
            >
              Carefully selected tools proven in production. Skip boilerplate, focus on your product.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {features.map((f, i) => (
                <FeatureCard key={f.title} {...f} delay={i * 80} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section
          style={{
            padding: 'clamp(48px,8vw,80px) 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(9,9,15,0.88)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            ref={ctaRef}
            style={{
              maxWidth: 560,
              margin: '0 auto',
              textAlign: 'center',
              transition: 'opacity 0.7s, transform 0.7s',
              opacity: ctaVisible ? 1 : 0,
              transform: ctaVisible ? 'translateY(0)' : 'translateY(24px)',
            }}
          >
            <h2
              style={{
                margin: '0 0 12px',
                fontSize: 'clamp(1.4rem,3.5vw,2rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#f8fafc',
              }}
            >
              Ready to build something great?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 28, lineHeight: 1.7 }}>
              Sign in with Google or email and start shipping in seconds.
            </p>
            <Button
              component={Link}
              to="/login"
              size="md"
              leftSection={<TbLogin size={16} />}
              rightSection={<TbArrowRight size={16} />}
              style={{ background: 'linear-gradient(135deg, #4f8ef7, #6366f1)', border: 'none', fontWeight: 700 }}
            >
              Start Building
            </Button>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────── */}
        <footer
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '20px 48px',
            background: 'rgba(9,9,15,0.92)',
          }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
          >
            <Group gap="xs">
              <SiBun size={15} color="#f5d5aa" />
              <Text size="xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                WA Dashboard
              </Text>
            </Group>
            <Text size="xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Bun · Elysia · React · Prisma · Redis
            </Text>
          </div>
        </footer>
      </div>
    </>
  )
}

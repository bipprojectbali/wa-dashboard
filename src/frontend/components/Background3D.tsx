import { useEffect, useRef } from 'react'

const N = 75
const BOX = [9, 5, 3] as const
const THRESH_SQ = 3 * 3
const BG = '#0d1117'

// ── Canvas 2D particle network (zero external deps) ───────────────────
function useParticleCanvas(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let camX = 0,
      camY = 0,
      tCamX = 0,
      tCamY = 0

    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 1.5)
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const onMouse = (e: MouseEvent) => {
      tCamX = (e.clientX / innerWidth - 0.5) * 0.4
      tCamY = -(e.clientY / innerHeight - 0.5) * 0.25
    }
    let scrollOff = 0
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight)
      scrollOff = (window.scrollY / max) * 0.6
    }
    window.addEventListener('mousemove', onMouse)
    window.addEventListener('scroll', onScroll, { passive: true })

    const particles = Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * BOX[0] * 2,
      y: (Math.random() - 0.5) * BOX[1] * 2,
      z: (Math.random() - 0.5) * BOX[2] * 2,
      vx: (Math.random() - 0.5) * 0.004,
      vy: (Math.random() - 0.5) * 0.004,
      vz: (Math.random() - 0.5) * 0.002,
    }))

    const draw = () => {
      camX += (tCamX - camX) * 0.03
      camY += (tCamY - camY) * 0.03

      const W = canvas.width,
        H = canvas.height
      const cx = W / 2,
        cy = H / 2
      const fov = 6

      ctx.fillStyle = BG
      ctx.fillRect(0, 0, W, H)

      // Update + project particles
      const pts = particles.map((p) => {
        p.x += p.vx
        p.y += p.vy
        p.z += p.vz
        if (Math.abs(p.x) > BOX[0]) p.vx *= -1
        if (Math.abs(p.y) > BOX[1]) p.vy *= -1
        if (Math.abs(p.z) > BOX[2]) p.vz *= -1

        // Simple perspective
        const cY = Math.cos(camX + scrollOff),
          sY = Math.sin(camX + scrollOff)
        const cX = Math.cos(camY),
          sX = Math.sin(camY)
        const rx = p.x * cY - p.z * sY,
          rz0 = p.x * sY + p.z * cY
        const ry = p.y * cX - rz0 * sX,
          rz = p.y * sX + rz0 * cX
        const scale = fov / (fov + rz)
        return { sx: rx * scale * 80 + cx, sy: ry * scale * 80 + cy, scale }
      })

      // Lines
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const p = particles[i],
            q = particles[j]
          const dx = p.x - q.x,
            dy = p.y - q.y,
            dz = p.z - q.z
          if (dx * dx + dy * dy + dz * dz < THRESH_SQ) {
            ctx.beginPath()
            ctx.moveTo(pts[i].sx, pts[i].sy)
            ctx.lineTo(pts[j].sx, pts[j].sy)
            ctx.strokeStyle = 'rgba(59,130,246,0.14)'
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }

      // Points
      pts.forEach((p) => {
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, Math.max(1, 3 * p.scale), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(79,142,247,0.65)`
        ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('scroll', onScroll)
    }
  }, [ref])
}

// ── Wrapper component — wraps page content with canvas behind ─────────
export function Background3D({ children }: { children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useParticleCanvas(canvasRef)

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: BG }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
          display: 'block',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

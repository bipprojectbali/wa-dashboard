# Expanded Prompt — Base Template 10s Product Intro

## Style Block

| Token       | Value      | Usage                                 |
|-------------|------------|---------------------------------------|
| BG          | `#0D1321`  | Deep navy. All backgrounds.           |
| FG          | `#F0EBD8`  | Warm off-white. Primary title only.   |
| Accent-dim  | `#3E5C76`  | Steel blue. Rules, structural lines.  |
| Accent-glow | `#748CAB`  | Light steel. Glow, secondary text.    |
| Headline    | Bricolage Grotesque 800 | Display. Expressive variable grotesque. |
| Detail      | JetBrains Mono 400      | Tech stack, metadata. Monospace.       |
| Mood        | Criterion Collection titles · hardware spec sheet · observatory dashboard |

No pure black/white. No gradient text. No Inter/Roboto/Poppins.

---

## Rhythm Declaration

`SLOW-build → breathe → resolve`

Single scene, 10 seconds:
- **Build** (0–2.8s): structural elements materialize one by one
- **Breathe** (2.8–8.5s): full composition visible, ambient glow breathes
- **Resolve** (8.5–10s): fade to black — the only exit allowed

---

## Global Rules

- Background video: full-frame, muted, track 0, `bg.mp4` (user provides)
- Background audio: track 2, `music.mp3`, `data-volume="0.18"` (user provides)
- Dark overlay div always present — `#0D1321` at 55% opacity, keeps text legible over any video
- All GSAP tweens use `fromTo()` — deterministic, capture-safe (no `from()`)
- Ambient motion added to `tl` — no bare `gsap.to()`
- First animation at t=0.2 (never t=0)
- No `repeat: -1`. Ambient loops calculated: `repeat: Math.ceil(duration / cycle) - 1`

---

## Scene Beat: THE INTRO (0–10s)

**Concept:** A developer opens a blank project. The name appears out of darkness — precise, earned, unhurried. No marketing flourish. Just the stack, the name, the version. The viewer thinks: "this is the foundation I've been looking for."

**Mood direction:** Criterion Collection title cards. Precision instrument branding. A good API reference.

---

### Depth Layers (10 elements total)

#### BG — Decoratives

| # | Element | Spec |
|---|---------|------|
| 1 | Background video | `bg.mp4`, full-frame, muted, track 0. Fallback: `#0D1321` solid. |
| 2 | Video overlay | `div`, `#0D1321` at 55% opacity, `position:absolute, inset:0`. Always visible. |
| 3 | Radial glow | `#748CAB` at 18% opacity, 700px × 700px, `border-radius:50%`, positioned center-left. Ambient: `scale` 0.96→1.04, 5s, `sine.inOut`, `yoyo:true`, `repeat: 1` (10s / 5s = 2 cycles). Enters: `fromTo` opacity 0→0.18, 1.5s, `sine.out`, t=0.0. |
| 4 | Ghost text "BASE TEMPLATE" | 260px Bricolage Grotesque 800, `#F0EBD8` at 11% opacity, position center-right, `white-space:nowrap`, `overflow:hidden`. Ambient: slow x-drift, `fromTo` x:0→-40px over 10s, `none` ease — renders as continuous motion. |

#### MG — Content

| # | Element | Spec |
|---|---------|------|
| 5 | Left accent bar | `div`, 3px × 72px, `background:#748CAB`. Enters: `fromTo` scaleY:0→1, 0.35s, `expo.out`, t=0.2. `transform-origin: top`. |
| 6 | Main title "Base Template" | 104px Bricolage Grotesque 800, `#F0EBD8`, `letter-spacing:-0.04em`, `line-height:1`. Enters: `fromTo` y:70→0 + opacity:0→1, 0.85s, `expo.out`, t=0.7. |
| 7 | Tagline "Build full-stack apps at lightning speed" | 30px JetBrains Mono 400, `#748CAB`, `letter-spacing:0.01em`. Enters: `fromTo` x:-50→0 + opacity:0→1, 0.6s, `power3.out`, t=1.55. |
| 8 | Hairline rule | `div`, 220px × 1px, `background:#3E5C76`. Enters: `fromTo` scaleX:0→1, 0.5s, `power2.out`, t=2.0. `transform-origin: left`. |
| 9 | Tech stack "Bun · Elysia · React · Prisma" | 20px JetBrains Mono 400, `#748CAB` at 70% opacity. Enters: `fromTo` opacity:0→0.7, 0.45s, `sine.out`, t=2.5. |

#### FG — Accents

| # | Element | Spec |
|---|---------|------|
| 10 | Version label "v0.1.0 · 2026" | 15px JetBrains Mono, `#3E5C76` at 65% opacity, pinned top-right. Enters: `fromTo` opacity:0→0.65, 0.5s, `sine.out`, t=1.2. |

---

### Exit (final scene — exits allowed)

| t=8.5s | Title, tagline, rule, tech stack, version fade out | `fromTo` opacity:current→0, 0.7s, `power2.in` |
| t=8.8s | Accent bar scaleY→0 | `fromTo` scaleY:1→0, 0.4s, `power2.in`. `tl.set()` kill after. |
| t=9.0s | Glow + ghost text fade | `fromTo` opacity:current→0, 0.6s, `sine.in` |
| t=9.1s | Video overlay opacity 0.55→1.0 | Dark fill covers video |
| t=9.5s | `tl.set()` hard-kill all elements | Deterministic black frame |

---

## Recurring Motifs

- `#748CAB` — the "voice" of secondary information throughout
- JetBrains Mono — any element that is machine-generated or data-like
- Left-anchored layout — title and content zone pinned to left third of frame

## Negative Prompt

- ❌ No gradient text (`background-clip: text`)
- ❌ No pure `#000` or `#fff`
- ❌ No centered-and-floating layout
- ❌ No `repeat: -1` on any tween
- ❌ No bare `gsap.to()` outside the timeline
- ❌ No `from()` — use `fromTo()` for all tweens
- ❌ No glow larger than 25% opacity (compression artifact risk)

---

## Asset Requirements (user must provide)

- `intro/bg.mp4` — background video loop, ideally dark/abstract tech visuals (abstract code, particles, dark landscape, etc). 10s+ duration, no audio needed.
- `intro/music.mp3` — ambient background music, 10s+. Volume will be set to 0.18 (subtle). Royalty-free recommended.

If assets are not available, the composition renders correctly without them — `#0D1321` fallback background and silence.

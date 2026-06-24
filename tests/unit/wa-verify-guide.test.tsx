import { describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { WaVerifyGuide } from '../../src/frontend/components/wa/WaVerifyGuide'

const html = renderToStaticMarkup(
  <MantineProvider>
    <WaVerifyGuide />
  </MantineProvider>,
)

// Elemen block-level yang ilegal sebagai keturunan <p> (penyebab hydration error).
const BLOCK_TAGS = new Set(['div', 'p', 'ul', 'ol', 'li', 'section', 'table'])
const VOID_TAGS = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'svg', 'path', 'use'])

/** Cari pelanggaran nesting: tag block-level terbuka saat masih ada <p> di stack. */
function findBlockInsideParagraph(markup: string): string | null {
  const stack: string[] = []
  const tagRe = /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi
  for (const m of markup.matchAll(tagRe)) {
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    const selfClosed = m[3].trimEnd().endsWith('/') || VOID_TAGS.has(tag)
    if (closing) {
      const idx = stack.lastIndexOf(tag)
      if (idx !== -1) stack.splice(idx)
      continue
    }
    if (selfClosed) continue
    if (BLOCK_TAGS.has(tag) && stack.includes('p')) {
      return `<${tag}> bersarang di dalam <p> (stack: ${stack.join(' > ')} > ${tag})`
    }
    stack.push(tag)
  }
  return null
}

describe('WaVerifyGuide', () => {
  test('render menghasilkan markup non-kosong', () => {
    expect(html.length).toBeGreaterThan(100)
  })

  test('tidak ada elemen block-level bersarang di dalam <p> (anti hydration error)', () => {
    expect(findBlockInsideParagraph(html)).toBeNull()
  })

  test('badge VERIFIED ter-render sebagai bagian dari panduan', () => {
    expect(html).toContain('VERIFIED')
  })

  test('detektor nesting menangkap kasus <div> di dalam <p>', () => {
    expect(findBlockInsideParagraph('<p>teks <div>x</div></p>')).not.toBeNull()
    expect(findBlockInsideParagraph('<div>teks <span>x</span></div>')).toBeNull()
  })
})

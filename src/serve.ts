// Workaround: Bun 1.3.6 EADDRINUSE errno:0
// Dynamic import memberi waktu OS release port sebelum binding
import('./index.tsx')

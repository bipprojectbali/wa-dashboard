import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: process.cwd(),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react'
          if (id.includes('node_modules/@mantine')) return 'mantine'
          if (id.includes('node_modules/@tanstack')) return 'tanstack'
          if (id.includes('node_modules/react-icons')) return 'icons'
          if (id.includes('node_modules/@xyflow') || id.includes('node_modules/elkjs')) return 'xyflow'
          if (id.includes('node_modules/')) return 'vendor'
        },
      },
    },
  },
})

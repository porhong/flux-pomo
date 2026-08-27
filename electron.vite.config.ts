import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@resources': resolve('resources')
      }
    },
    server: {
      fs: {
        // Keep project root (renderer HTML/src) plus resources for sound assets.
        allow: [resolve('.'), resolve('resources')]
      }
    },
    assetsInclude: ['**/*.mp3', '**/*.webp'],
    plugins: [react()]
  }
})

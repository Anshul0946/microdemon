import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode || 'test', process.cwd(), '')
  // Also explicitly assign all loaded env vars into process.env
  Object.assign(process.env, env)

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      testTimeout: 20000,
      env,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  }
})

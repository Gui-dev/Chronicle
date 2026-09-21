import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/chronicle',
      BETTER_AUTH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
      BETTER_AUTH_URL: 'http://localhost:3000',
    },
  },
})

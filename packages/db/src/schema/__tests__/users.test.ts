import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { users } from '../users'

describe('Users Schema', () => {
  let db: ReturnType<typeof drizzle>

  beforeEach(() => {
    const sqlite = new Database(':memory:')
    db = drizzle(sqlite)

    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        email_verified INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
  })

  afterAll(() => {
    db.$client.close()
  })

  it('should insert a user', async () => {
    const now = new Date()
    const result = await db
      .insert(users)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('test@example.com')
    expect(result[0].name).toBe('Test User')
  })

  it('should enforce unique email constraint', async () => {
    const now = new Date()
    await db.insert(users).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: now,
      updatedAt: now,
    })

    await expect(
      db.insert(users).values({
        id: 'user-2',
        email: 'test@example.com',
        name: 'Another User',
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow()
  })

  it('should query user by email', async () => {
    const now = new Date()
    await db.insert(users).values({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: now,
      updatedAt: now,
    })

    const result = await db.select().from(users).where(eq(users.email, 'test@example.com'))

    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('test@example.com')
  })
})

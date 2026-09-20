import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { memories, users } from '../index'

describe('Memories Schema', () => {
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

    sqlite.exec(`
      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        memory_date INTEGER NOT NULL,
        location_name TEXT,
        location_lat REAL,
        location_lng REAL,
        weather_temp REAL,
        weather_desc TEXT,
        weather_icon TEXT,
        music_track TEXT,
        music_artist TEXT,
        music_url TEXT,
        music_cover TEXT,
        ai_narrative TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
  })

  afterAll(() => {
    db.$client.close()
  })

  it('should insert a memory', async () => {
    const now = new Date()
    // First insert a user
    const user = await db
      .insert(users)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    // Then insert a memory
    const result = await db
      .insert(memories)
      .values({
        id: 'memory-1',
        userId: user[0].id,
        title: 'Test Memory',
        content: 'This is a test memory',
        memoryDate: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Test Memory')
    expect(result[0].userId).toBe(user[0].id)
  })

  it('should enforce foreign key constraint', async () => {
    const now = new Date()
    await expect(
      db.insert(memories).values({
        id: 'memory-1',
        userId: 'non-existent-user-id',
        title: 'Test Memory',
        memoryDate: now,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow()
  })

  it('should query memories by user', async () => {
    const now = new Date()
    const user = await db
      .insert(users)
      .values({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    await db.insert(memories).values({
      id: 'memory-1',
      userId: user[0].id,
      title: 'Memory 1',
      memoryDate: now,
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(memories).values({
      id: 'memory-2',
      userId: user[0].id,
      title: 'Memory 2',
      memoryDate: now,
      createdAt: now,
      updatedAt: now,
    })

    const result = await db.select().from(memories).where(eq(memories.userId, user[0].id))

    expect(result).toHaveLength(2)
  })
})

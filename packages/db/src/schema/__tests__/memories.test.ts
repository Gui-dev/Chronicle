import { type PgTable, getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { memories, memoryPeople, memoryPhotos, memoryTags, users } from '../index'

describe('Memories Schema', () => {
  const cfg = getTableConfig(memories as never)

  it('has the correct table name', () => {
    expect(cfg.name).toBe('memories')
  })

  it('defines the memory columns', () => {
    const cols = cfg.columns.map((c) => ({
      name: c.name,
      type: c.columnType,
      notNull: c.notNull,
    }))
    const expected = [
      ['id', 'PgUUID', true],
      ['user_id', 'PgVarchar', true],
      ['title', 'PgVarchar', true],
      ['content', 'PgText', false],
      ['memory_date', 'PgTimestamp', true],
      ['location_name', 'PgVarchar', false],
      ['location_lat', 'PgNumeric', false],
      ['location_lng', 'PgNumeric', false],
      ['weather_temp', 'PgNumeric', false],
      ['weather_desc', 'PgVarchar', false],
      ['weather_icon', 'PgVarchar', false],
      ['music_track', 'PgVarchar', false],
      ['music_artist', 'PgVarchar', false],
      ['music_url', 'PgText', false],
      ['music_cover', 'PgText', false],
      ['is_public', 'PgBoolean', true],
      ['share_token', 'PgText', false],
      ['share_expires_at', 'PgTimestamp', false],
      ['ai_narrative', 'PgText', false],
      ['ai_mood', 'PgVarchar', false],
      ['ai_themes', 'PgArray', false],
      ['deleted_at', 'PgTimestamp', false],
      ['created_at', 'PgTimestamp', true],
      ['updated_at', 'PgTimestamp', true],
    ].map(([name, type, notNull]) => ({ name, type, notNull }))
    expect(cols).toEqual(expected)
  })

  it('references the users table with cascade delete', () => {
    expect(cfg.foreignKeys).toHaveLength(1)
    const fk = cfg.foreignKeys[0]
    expect(fk.onDelete).toBe('cascade')
    const ref = fk.reference()
    expect(ref.columns.map((c) => c.name)).toEqual(['user_id'])
    expect(ref.foreignColumns.map((c) => c.name)).toEqual(['id'])
    expect(ref.foreignColumns[0].table).toBe(users)
  })

  it('keeps the referenced users table in sync', () => {
    const userColumns = getTableConfig(users as never).columns
    const userId = userColumns.find((c) => c.name === 'id')
    expect(userId?.name).toBe('id')
    expect(userId?.primary).toBe(true)
  })
})

describe('Memories indexes', () => {
  // Assert the columns, not just the name. A name-only test passes with the
  // index on the wrong columns, which is the entire risk surface here: an index
  // on the right name in the wrong order is unusable by the query it serves.
  //
  // `config.columns` is typed `Partial<IndexedColumn | SQL>[]` and only the
  // former carries a name, so the `in` check narrows instead of casting. An
  // expression column would read as undefined and fail the assertion below,
  // which is the right outcome — these indexes are all on plain columns.
  const indexOn = (table: PgTable, name: string) => {
    const found = getTableConfig(table).indexes.find((index) => index.config.name === name)
    if (!found) return undefined
    return found.config.columns.map((column) => ('name' in column ? column.name : undefined))
  }

  it('indexes the owner timeline and the public feed, and not partially', () => {
    expect(indexOn(memories, 'memories_user_date_idx')).toEqual(['user_id', 'memory_date'])

    // Partial would read `WHERE is_public = true`, which the logged-in feed's
    // `is_public = true OR user_id = $1` cannot be proven to imply.
    const found = getTableConfig(memories).indexes.find(
      (index) => index.config.name === 'memories_public_date_idx',
    )
    expect(found?.config.where).toBeUndefined()
    expect(indexOn(memories, 'memories_public_date_idx')).toEqual(['is_public', 'memory_date'])
  })

  it('has a partial unique index on the share token', () => {
    // One active link per memory. Partial so the (common) no-link case is a
    // NULL that the unique constraint ignores — several memories without a
    // link all store NULL and must not collide.
    const found = getTableConfig(memories).indexes.find(
      (index) => index.config.name === 'memories_share_token_idx',
    )
    expect(found).toBeDefined()
    expect(found?.config.unique).toBe(true)
    expect(found?.config.where).toBeDefined()
    expect(indexOn(memories, 'memories_share_token_idx')).toEqual(['share_token'])
  })

  it('indexes every junction table by memory_id', () => {
    expect(indexOn(memoryPhotos, 'memory_photos_memory_idx')).toEqual(['memory_id'])
    expect(indexOn(memoryPeople, 'memory_people_memory_idx')).toEqual(['memory_id'])
    expect(indexOn(memoryTags, 'memory_tags_memory_idx')).toEqual(['memory_id'])
  })

  it('indexes tags by name for the #tag search', () => {
    expect(indexOn(memoryTags, 'memory_tags_name_idx')).toEqual(['name'])
  })
})

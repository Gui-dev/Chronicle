import { getTableConfig } from 'drizzle-orm/pg-core'
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
      ['ai_narrative', 'PgText', false],
      ['ai_mood', 'PgVarchar', false],
      ['ai_themes', 'PgArray', false],
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
  const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
    getTableConfig(table).indexes.map((index) => index.config.name)

  it('indexes the owner timeline and the public feed', () => {
    expect(indexNames(memories as never)).toEqual(
      expect.arrayContaining(['memories_user_date_idx', 'memories_public_date_idx']),
    )
  })

  it('indexes every junction table by memory_id', () => {
    expect(indexNames(memoryPhotos as never)).toContain('memory_photos_memory_idx')
    expect(indexNames(memoryPeople as never)).toContain('memory_people_memory_idx')
    expect(indexNames(memoryTags as never)).toContain('memory_tags_memory_idx')
  })

  it('indexes tags by name for the #tag search', () => {
    expect(indexNames(memoryTags as never)).toContain('memory_tags_name_idx')
  })
})

import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { users } from '../index'

describe('Users Schema', () => {
  const cfg = getTableConfig(users as never)

  it('has the correct table name', () => {
    expect(cfg.name).toBe('users')
  })

  it('defines the user columns', () => {
    const cols = cfg.columns.map((c) => ({
      name: c.name,
      type: c.columnType,
      notNull: c.notNull,
    }))
    const expected = [
      ['id', 'PgVarchar', true],
      ['email', 'PgVarchar', true],
      ['name', 'PgVarchar', true],
      ['image', 'PgVarchar', false],
      ['email_verified', 'PgBoolean', true],
      ['created_at', 'PgTimestamp', true],
      ['updated_at', 'PgTimestamp', true],
    ].map(([name, type, notNull]) => ({ name, type, notNull }))
    expect(cols).toEqual(expected)
  })

  it('uses a non-null id primary key', () => {
    const id = cfg.columns.find((c) => c.name === 'id')
    expect(id?.primary).toBe(true)
    expect(id?.notNull).toBe(true)
  })
})

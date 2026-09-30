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
      hasDefault: c.hasDefault,
    }))
    const expected = [
      ['id', 'PgVarchar', true, false],
      ['email', 'PgVarchar', true, false],
      ['name', 'PgVarchar', true, false],
      ['image', 'PgVarchar', false, false],
      ['email_verified', 'PgBoolean', true, true],
      ['created_at', 'PgTimestamp', true, true],
      ['updated_at', 'PgTimestamp', true, true],
      ['last_visit_at', 'PgTimestamp', false, false],
    ].map(([name, type, notNull, hasDefault]) => ({
      name,
      type,
      notNull,
      hasDefault,
    }))
    expect(cols).toEqual(expected)
  })

  it('uses a non-null id primary key', () => {
    const id = cfg.columns.find((c) => c.name === 'id')
    expect(id?.primary).toBe(true)
    expect(id?.notNull).toBe(true)
  })
})

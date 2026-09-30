import {
  and,
  asc,
  db,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  memories,
  memoryPeople,
  memoryTags,
  ne,
  sql,
  users,
} from '@chronicle/db'
import { memoriesService } from '../memories/memories.service'

export class RetrospectivesService {
  // Spec §2.1: `findAll({ mine, year: current−1, month: current })` builds
  // exactly the previous-year-this-month UTC window (dateRange is half-open
  // over `memory_date`), owner-scoped, soft-delete filtered, newest first.
  // The service only picks the parameters and wraps the items.
  async yearAgo(userId: string) {
    const now = new Date()
    const result = await memoriesService.findAll(
      {
        mine: true,
        year: now.getUTCFullYear() - 1,
        month: now.getUTCMonth() + 1,
        page: 1,
        limit: 3,
      },
      { userId },
    )
    return result.data
  }

  // Spec §2.2: read the visit first; only then count. A null stamp short-
  // circuits — "never visited" needs no count query and must not run one.
  async activity(userId: string) {
    const [row] = await db
      .select({ lastVisitAt: users.lastVisitAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const since = row?.lastVisitAt ?? null
    if (!since) {
      return { count: 0, since: null }
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(
        and(
          eq(memories.isPublic, true),
          ne(memories.userId, userId),
          gt(memories.createdAt, since),
          isNull(memories.deletedAt),
        ),
      )

    // int8 comes back as a string from postgres — callers compare numbers.
    return { count: Number(countRow.count), since: since.toISOString() }
  }

  async visit(userId: string) {
    await db.update(users).set({ lastVisitAt: new Date() }).where(eq(users.id, userId))
  }

  // Spec §2.4: period-scoped summary and recurrences, all-time years and map
  // places, everything owner-scoped. The range mirrors memories.service's
  // dateRange — half-open UTC bounds over the raw column (sargable).
  // The query order below is pinned by the queue mock in the spec; a new
  // query or a reordering fails that test on purpose.
  async overview(userId: string, year?: number, month?: number) {
    const effectiveYear = year ?? new Date().getUTCFullYear()
    const start = new Date(Date.UTC(effectiveYear, (month ?? 1) - 1, 1))
    const end = month
      ? new Date(Date.UTC(effectiveYear, month, 1))
      : new Date(Date.UTC(effectiveYear + 1, 0, 1))

    const owned = and(eq(memories.userId, userId), isNull(memories.deletedAt))
    const inPeriod = and(owned, gte(memories.memoryDate, start), lt(memories.memoryDate, end))

    const [memRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(inPeriod)

    const [peopleRow] = await db
      .select({ count: sql<number>`count(distinct ${memoryPeople.name})` })
      .from(memoryPeople)
      .innerJoin(memories, eq(memoryPeople.memoryId, memories.id))
      .where(inPeriod)

    const [placesRow] = await db
      .select({ count: sql<number>`count(distinct ${memories.locationName})` })
      .from(memories)
      .where(and(inPeriod, isNotNull(memories.locationName)))

    const topTagRows = await db
      .select({ name: memoryTags.name, count: sql<number>`count(*)` })
      .from(memoryTags)
      .innerJoin(memories, eq(memoryTags.memoryId, memories.id))
      .where(inPeriod)
      .groupBy(memoryTags.name)
      .orderBy(desc(sql`count(*)`), asc(memoryTags.name))
      .limit(3)

    const recPeopleRows = await db
      .select({ name: memoryPeople.name, count: sql<number>`count(*)` })
      .from(memoryPeople)
      .innerJoin(memories, eq(memoryPeople.memoryId, memories.id))
      .where(inPeriod)
      .groupBy(memoryPeople.name)
      .orderBy(desc(sql`count(*)`), asc(memoryPeople.name))
      .limit(5)

    const recPlacesRows = await db
      .select({ name: memories.locationName, count: sql<number>`count(*)` })
      .from(memories)
      .where(and(inPeriod, isNotNull(memories.locationName)))
      .groupBy(memories.locationName)
      .orderBy(desc(sql`count(*)`), asc(memories.locationName))
      .limit(5)

    const themeRows = await db
      .select({ aiThemes: memories.aiThemes })
      .from(memories)
      .where(inPeriod)

    // Flattened here instead of SQL `unnest`: same result set, no raw-SQL
    // construct, and the rows are one user's period (seq-scan scale, §10).
    const themeCounts = new Map<string, number>()
    for (const row of themeRows) {
      for (const theme of row.aiThemes ?? []) {
        themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1)
      }
    }
    const themes = [...themeCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      // count DESC, then name ASC by code unit — deterministic across locales
      // (localeCompare would follow the runtime's collation).
      .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .slice(0, 5)

    const yearRows = await db
      .selectDistinct({ year: sql<number>`extract(year from ${memories.memoryDate})` })
      .from(memories)
      .where(owned)

    const placeRows = await db
      .select({
        name: memories.locationName,
        lat: memories.locationLat,
        lng: memories.locationLng,
        count: sql<number>`count(*)`,
      })
      .from(memories)
      .where(and(owned, isNotNull(memories.locationName)))
      .groupBy(memories.locationName, memories.locationLat, memories.locationLng)
      .orderBy(desc(sql`count(*)`), asc(memories.locationName))

    return {
      period: { year: effectiveYear, month: month ?? null },
      years: [...new Set(yearRows.map((row) => Number(row.year)))].sort((a, b) => b - a),
      summary: {
        memories: Number(memRow.count),
        people: Number(peopleRow.count),
        places: Number(placesRow.count),
        topTags: topTagRows.map((row) => ({ name: row.name, count: Number(row.count) })),
      },
      recurrences: {
        people: recPeopleRows.map((row) => ({ name: row.name, count: Number(row.count) })),
        places: recPlacesRows.map((row) => ({ name: row.name, count: Number(row.count) })),
        themes,
      },
      places: placeRows.map((row) => ({
        // Non-null by the predicate above; the select cannot express it.
        name: row.name as string,
        lat: Number(row.lat),
        lng: Number(row.lng),
        count: Number(row.count),
      })),
    }
  }
}

export const retrospectivesService = new RetrospectivesService()

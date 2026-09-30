import { and, db, eq, gt, isNull, memories, ne, sql, users } from '@chronicle/db'
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
}

export const retrospectivesService = new RetrospectivesService()

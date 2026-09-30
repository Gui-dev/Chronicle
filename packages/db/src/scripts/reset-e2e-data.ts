import dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '../../.env' })

const E2E_EMAIL = 'deb@test.com'
const OTHER_EMAIL = 'other@test.com'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  const sql = postgres(url, { max: 1 })

  try {
    // The activity E2E signs in as a second user; its public memory would
    // satisfy next run's counter assertion, so it goes with the reset.
    const other = await sql<{ id: string }[]>`
      select id from users where email = ${OTHER_EMAIL}
    `
    let otherDeleted = 0
    if (other.length > 0) {
      const rows = await sql<{ id: string }[]>`
        delete from memories where user_id = ${other[0].id} returning id
      `
      otherDeleted = rows.length
    }

    const user = await sql<{ id: string }[]>`
      select id from users where email = ${E2E_EMAIL}
    `

    if (user.length === 0) {
      console.log(`[e2e-reset] no user ${E2E_EMAIL}, nothing to delete`)
      return
    }

    // cascades to memory_photos, memory_people and memory_tags
    const deleted = await sql<{ id: string }[]>`
      delete from memories where user_id = ${user[0].id} returning id
    `

    // The profile spec uploads and removes an avatar, and "Remover foto" only
    // renders when users.image is set. Leaving it behind would make the next
    // run start with an avatar it did not upload.
    // Also clear last_visit_at so the activity counter starts fresh each run.
    const [cleared] = await sql<{ image: string | null }[]>`
      update users set image = null, last_visit_at = null
      where id = ${user[0].id} returning image
    `

    const avatarNote = cleared?.image ? ', cleared avatar' : ''

    console.log(
      `[e2e-reset] deleted ${deleted.length} memories owned by ${E2E_EMAIL}${avatarNote}, ` +
        `cleared last_visit_at, deleted ${otherDeleted} memories owned by ${OTHER_EMAIL}`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('[e2e-reset] failed:', err)
  process.exit(1)
})

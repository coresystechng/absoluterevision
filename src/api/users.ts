import { addDays, formatISO } from "date-fns"

import { initDb, query } from "@/lib/db"
import { toIsoDateTime } from "@/lib/date-values"
import type { AuthUser, UserProfile } from "@/types"

type UserRow = {
  id: string
  email: string
  display_name: string | null
  created_at: Date | string
}

function mapUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: toIsoDateTime(row.created_at),
  }
}

async function seedAssignments(userId: string) {
  const today = new Date()
  await query(
    `INSERT INTO assignments
      (user_id, title, category, priority, status, progress_stage, due_date, progress, notes)
     VALUES
      ($1, 'Outline research essay', 'Writing', 'high', 'ongoing', 'ai-draft', $2, 15, 'Draft thesis and source list before the next study session.'),
      ($1, 'Complete calculus problem set', 'Mathematics', 'medium', 'not-started', 'ai-draft', $3, 0, 'Focus on integration by parts and applications.'),
      ($1, 'Review biology flashcards', 'Science', 'low', 'completed', 'final-review', $4, 100, 'Photosynthesis and cell respiration review complete.')`,
    [
      userId,
      formatISO(addDays(today, 2), { representation: "date" }),
      formatISO(addDays(today, 5), { representation: "date" }),
      formatISO(addDays(today, -1), { representation: "date" }),
    ],
  )
}

export async function getOrCreateUser(user: AuthUser) {
  try {
    await initDb()
    const inserted = await query<UserRow>(
      `INSERT INTO users (id, email, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [user.id, user.email, user.displayName],
    )

    if (inserted.length > 0) {
      await seedAssignments(user.id)
      return mapUser(inserted[0])
    }

    const existing = await query<UserRow>("SELECT * FROM users WHERE id = $1 LIMIT 1", [
      user.id,
    ])
    const [row] = existing
    return mapUser(row)
  } catch (error) {
    console.error("Failed to get or create user", error)
    throw error
  }
}

export async function updateProfile(userId: string, displayName: string | null) {
  try {
    await initDb()
    const rows = await query<UserRow>(
      `UPDATE users
       SET display_name = $2
       WHERE id = $1
       RETURNING *`,
      [userId, displayName?.trim() || null],
    )
    return mapUser(rows[0])
  } catch (error) {
    console.error("Failed to update profile", error)
    throw error
  }
}

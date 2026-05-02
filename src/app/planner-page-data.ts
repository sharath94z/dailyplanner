import "server-only"

import { headers } from "next/headers"

import { resolveMockUserId } from "../lib/auth"
import { getTodayDateStringInTimeZone } from "../lib/planner-time"
import { getUserTimeZone } from "../lib/user-timezone"
import { timelineQuerySchema } from "../lib/validators/timeline"

function normalizeSelectedDate(rawDate: string | string[] | undefined, fallbackDate: string): string {
  const candidate = typeof rawDate === "string" ? rawDate : undefined
  const parsed = timelineQuerySchema.safeParse({
    date: candidate ?? fallbackDate
  })

  return parsed.success ? parsed.data.date : fallbackDate
}

export async function getPlannerPageContext(searchParams?: { date?: string | string[] }) {
  const headerStore = await headers()
  const userId = await resolveMockUserId(headerStore.get("x-mock-user-id"))
  const timeZone = await getUserTimeZone(userId)
  const selectedDate = normalizeSelectedDate(
    searchParams?.date,
    getTodayDateStringInTimeZone(timeZone)
  )

  return {
    userId,
    timeZone,
    selectedDate
  }
}

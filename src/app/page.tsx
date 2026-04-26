import { headers } from "next/headers";

import { TimelineView } from "../features/timeline/timeline-view";
import { resolveMockUserId } from "../lib/auth";
import { getTodayDateStringInTimeZone } from "../lib/planner-time";
import { getUserTimeZone } from "../lib/user-timezone";
import { timelineQuerySchema } from "../lib/validators/timeline";
import { getTimelineForDate } from "../services/timeline/timeline.service";

export const dynamic = "force-dynamic";

function normalizeSelectedDate(rawDate: string | string[] | undefined, fallbackDate: string): string {
  const candidate = typeof rawDate === "string" ? rawDate : undefined;
  const parsed = timelineQuerySchema.safeParse({
    date: candidate ?? fallbackDate
  });

  return parsed.success ? parsed.data.date : fallbackDate;
}

type HomePageProps = {
  searchParams?: Promise<{
    date?: string | string[];
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const headerStore = await headers();
  const userId = await resolveMockUserId(headerStore.get("x-mock-user-id"));
  const timeZone = await getUserTimeZone(userId);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedDate = normalizeSelectedDate(
    resolvedSearchParams?.date,
    getTodayDateStringInTimeZone(timeZone)
  );
  const timeline = await getTimelineForDate(userId, {
    date: selectedDate,
    includeSuggestions: true,
    includeCalendar: true
  });

  return <TimelineView timeline={timeline} mockUserId={userId} timeZone={timeZone} />;
}

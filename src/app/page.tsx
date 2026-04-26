import { headers } from "next/headers";

import { TimelineView } from "../features/timeline/timeline-view";
import { resolveMockUserId } from "../lib/auth";
import { timelineQuerySchema } from "../lib/validators/timeline";
import { getTimelineForDate } from "../services/timeline/timeline.service";

export const dynamic = "force-dynamic";

function getTodayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeSelectedDate(rawDate: string | string[] | undefined): string {
  const candidate = typeof rawDate === "string" ? rawDate : undefined;
  const fallbackDate = getTodayDateString();
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
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedDate = normalizeSelectedDate(resolvedSearchParams?.date);
  const headerStore = await headers();
  const userId = await resolveMockUserId(headerStore.get("x-mock-user-id"));
  const timeline = await getTimelineForDate(userId, {
    date: selectedDate,
    includeSuggestions: true,
    includeCalendar: true
  });

  return <TimelineView timeline={timeline} mockUserId={userId} />;
}

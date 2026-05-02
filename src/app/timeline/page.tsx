import { TimelineView } from "../../features/timeline/timeline-view"
import { getTaskAggregates } from "../../services/tasks/task.service"
import { getTimelineForDate } from "../../services/timeline/timeline.service"
import { getPlannerPageContext } from "../planner-page-data"

export const dynamic = "force-dynamic"

type TimelinePageProps = {
  searchParams?: Promise<{
    date?: string | string[]
  }>
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const { userId, timeZone, selectedDate } = await getPlannerPageContext(resolvedSearchParams)
  const [timeline, aggregates] = await Promise.all([
    getTimelineForDate(userId, {
      date: selectedDate,
      includeSuggestions: true,
      includeCalendar: true
    }),
    getTaskAggregates(userId)
  ])

  return (
    <TimelineView
      timeline={timeline}
      openTaskCount={aggregates.openTaskCount}
      mockUserId={userId}
      selectedDate={selectedDate}
      timeZone={timeZone}
      unscheduledDurationMinutes={aggregates.unscheduledDurationMinutes}
    />
  )
}

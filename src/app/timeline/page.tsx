import { TimelineView } from "../../features/timeline/timeline-view"
import { listTasks } from "../../services/tasks/task.service"
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
  const [timeline, tasks] = await Promise.all([
    getTimelineForDate(userId, {
      date: selectedDate,
      includeSuggestions: true,
      includeCalendar: true
    }),
    listTasks(userId, {
      limit: 200,
      includeArchived: false
    })
  ])

  return (
    <TimelineView
      timeline={timeline}
      tasks={tasks.tasks}
      mockUserId={userId}
      selectedDate={selectedDate}
      timeZone={timeZone}
    />
  )
}

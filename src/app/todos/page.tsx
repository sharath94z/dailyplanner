import { TodoView } from "../../features/todos/todo-view"
import { listTasks } from "../../services/tasks/task.service"
import { getPlannerPageContext } from "../planner-page-data"

export const dynamic = "force-dynamic"

type TodoPageProps = {
  searchParams?: Promise<{
    date?: string | string[]
  }>
}

export default async function TodoPage({ searchParams }: TodoPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const { userId, selectedDate } = await getPlannerPageContext(resolvedSearchParams)
  const tasks = await listTasks(userId, {
    limit: 200,
    includeArchived: false
  })

  return (
    <TodoView
      tasks={tasks.tasks}
      mockUserId={userId}
      selectedDate={selectedDate}
    />
  )
}

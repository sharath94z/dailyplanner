import type { CSSProperties, ReactNode } from "react"

import { TaskStatus, type Priority } from "@prisma/client"

import { AppNav } from "../navigation/app-nav"
import { TaskCreateForm } from "../tasks/task-create-form"
import type { SerializedTask } from "../../services/tasks/task.service"

type TodoViewProps = {
  tasks: SerializedTask[]
  mockUserId: string
  selectedDate: string
}

const PAGE_CONTAINER_STYLE = {
  margin: "0 auto",
  maxWidth: "42rem",
  padding: "1rem 0.9rem 6rem",
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#0f172a"
} as const

const SURFACE_STYLE = {
  border: "1px solid #e7e5e4",
  borderRadius: "1.35rem",
  backgroundColor: "#ffffff",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.06)"
} as const

const PRIORITY_ORDER: Record<Priority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2
}

function isCompletedTask(task: SerializedTask) {
  return task.status === TaskStatus.COMPLETED
}

function getDueTime(value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  return new Date(value).getTime()
}

function sortTasks(tasks: SerializedTask[]) {
  return [...tasks].sort((left, right) => {
    const leftCompleted = isCompletedTask(left)
    const rightCompleted = isCompletedTask(right)

    if (leftCompleted !== rightCompleted) {
      return leftCompleted ? 1 : -1
    }

    const priorityDiff = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]

    if (priorityDiff !== 0) {
      return priorityDiff
    }

    const dueDiff = getDueTime(left.deadline) - getDueTime(right.deadline)

    if (dueDiff !== 0) {
      return dueDiff
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  })
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value))
}

function priorityTint(priority: Priority, muted: boolean) {
  if (muted) {
    return {
      backgroundColor: "#f5f5f4",
      color: "#78716c",
      border: "1px solid #e7e5e4"
    }
  }

  if (priority === "HIGH") {
    return {
      backgroundColor: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fecaca"
    }
  }

  if (priority === "MEDIUM") {
    return {
      backgroundColor: "#fff7ed",
      color: "#c2410c",
      border: "1px solid #fdba74"
    }
  }

  return {
    backgroundColor: "#f0fdf4",
    color: "#15803d",
    border: "1px solid #bbf7d0"
  }
}

function metaPill(children: ReactNode, tint?: CSSProperties) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        padding: "0.24rem 0.58rem",
        fontSize: "0.73rem",
        fontWeight: 700,
        letterSpacing: "0.03em",
        ...tint
      }}
    >
      {children}
    </span>
  )
}

export function TodoView({ tasks, mockUserId, selectedDate }: TodoViewProps) {
  const visibleTasks = tasks.filter((task) => task.status !== TaskStatus.ARCHIVED)
  const sortedTasks = sortTasks(visibleTasks)

  return (
    <main style={PAGE_CONTAINER_STYLE}>
      <section
        style={{
          ...SURFACE_STYLE,
          padding: "1rem",
          marginBottom: "1rem",
          background:
            "linear-gradient(180deg, rgba(255,251,235,0.98) 0%, rgba(255,255,255,1) 100%)"
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#9a3412"
          }}
        >
          Task management
        </p>
        <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.8rem", lineHeight: 1.05 }}>Todo</h1>
        <p style={{ margin: "0.45rem 0 0", fontSize: "0.92rem", color: "#57534e" }}>
          Capture what needs doing, then move to Timeline when it has a time.
        </p>
      </section>

      <div style={{ marginBottom: "1rem" }}>
        <TaskCreateForm mockUserId={mockUserId} />
      </div>

      <section
        style={{
          ...SURFACE_STYLE,
          padding: "1rem"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.8rem",
            marginBottom: "0.95rem"
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1rem" }}>All tasks</h2>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.84rem", color: "#6b7280" }}>
              Incomplete tasks stay on top. Completed tasks remain visible at the bottom.
            </p>
          </div>
          <span
            style={{
              borderRadius: "999px",
              border: "1px solid #e7e5e4",
              backgroundColor: "#fafaf9",
              padding: "0.3rem 0.65rem",
              fontSize: "0.8rem",
              color: "#57534e"
            }}
          >
            {sortedTasks.length}
          </span>
        </div>

        {sortedTasks.length === 0 ? (
          <div
            style={{
              border: "1px dashed #d6d3d1",
              borderRadius: "1rem",
              padding: "1rem",
              backgroundColor: "#fafaf9",
              color: "#57534e",
              fontSize: "0.94rem"
            }}
          >
            No tasks yet. Add something here, then plan it when you want time on the calendar.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {sortedTasks.map((task) => {
              const completed = isCompletedTask(task)
              const tint = priorityTint(task.priority, completed)

              return (
                <article
                  key={task.id}
                  style={{
                    border: "1px solid #ece7e1",
                    borderRadius: "1rem",
                    padding: "0.9rem",
                    backgroundColor: completed ? "#fafaf9" : "#fffefc",
                    opacity: completed ? 0.64 : 1
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4rem 1fr",
                      gap: "0.75rem",
                      alignItems: "start"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={completed}
                      disabled
                      aria-label={completed ? "Completed task" : "Incomplete task"}
                      style={{
                        marginTop: "0.18rem",
                        width: "1rem",
                        height: "1rem",
                        accentColor: "#0f766e"
                      }}
                    />

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "0.75rem"
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "1rem",
                              fontWeight: 700,
                              lineHeight: 1.25,
                              textDecoration: completed ? "line-through" : "none",
                              color: completed ? "#78716c" : "#111827",
                              wordBreak: "break-word"
                            }}
                          >
                            {task.title}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.45rem",
                              marginTop: "0.65rem"
                            }}
                          >
                            {metaPill(task.priority, tint)}
                            {task.deadline ? metaPill(`Due ${formatDueDate(task.deadline)}`, {
                              backgroundColor: completed ? "#f5f5f4" : "#f8fafc",
                              color: completed ? "#78716c" : "#475569",
                              border: completed ? "1px solid #e7e5e4" : "1px solid #dbeafe"
                            }) : null}
                            {task.durationMinutes ? metaPill(`${task.durationMinutes}m`, {
                              backgroundColor: completed ? "#f5f5f4" : "#f8fafc",
                              color: completed ? "#78716c" : "#475569",
                              border: completed ? "1px solid #e7e5e4" : "1px solid #e2e8f0"
                            }) : null}
                          </div>
                        </div>

                        <span
                          style={{
                            flexShrink: 0,
                            borderRadius: "999px",
                            backgroundColor: completed ? "#f5f5f4" : "#f8fafc",
                            border: "1px solid #e2e8f0",
                            padding: "0.22rem 0.55rem",
                            fontSize: "0.72rem",
                            color: completed ? "#78716c" : "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em"
                          }}
                        >
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <AppNav selectedDate={selectedDate} />
    </main>
  )
}

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
  minHeight: "100vh",
  padding: "1.1rem 0.95rem 9rem",
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#111827",
  backgroundColor: "#f7f3ef"
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
      backgroundColor: "#fff1f2",
      color: "#be123c",
      border: "1px solid #fecdd3"
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
        padding: "0.26rem 0.62rem",
        fontSize: "0.74rem",
        fontWeight: 700,
        letterSpacing: "0.02em",
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
      <section style={{ marginBottom: "1rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#d9485f"
          }}
        >
          Todo
        </p>
        <h1
          style={{
            margin: "0.35rem 0 0",
            fontSize: "2.1rem",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: "#111827"
          }}
        >
          Todo
        </h1>
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.92rem", color: "#78716c" }}>
          Add tasks here, then schedule them on your timeline.
        </p>
      </section>

      <div style={{ marginBottom: "1rem" }}>
        <TaskCreateForm mockUserId={mockUserId} />
      </div>

      {sortedTasks.length === 0 ? (
        <section
          style={{
            border: "1px dashed #ddd6ce",
            borderRadius: "1.3rem",
            padding: "1.1rem",
            backgroundColor: "#fffdfb",
            color: "#57534e",
            fontSize: "0.95rem"
          }}
        >
          <div style={{ fontWeight: 700, color: "#111827" }}>No tasks yet</div>
          <div style={{ marginTop: "0.3rem" }}>Add tasks here, then schedule them on your timeline.</div>
        </section>
      ) : (
        <section style={{ display: "grid", gap: "0.8rem" }}>
          {sortedTasks.map((task) => {
            const completed = isCompletedTask(task)
            const tint = priorityTint(task.priority, completed)

            return (
              <article
                key={task.id}
                style={{
                  border: "1px solid #ece7e1",
                  borderRadius: "1.35rem",
                  padding: "0.95rem",
                  backgroundColor: "#fffdfb",
                  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.04)",
                  opacity: completed ? 0.62 : 1
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.1rem 1fr",
                    gap: "0.8rem",
                    alignItems: "start"
                  }}
                >
                  <div
                    style={{
                      width: "2.1rem",
                      height: "2.1rem",
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: completed ? "#f5f5f4" : "#fff1f2",
                      border: completed ? "1px solid #e7e5e4" : "1px solid #fecdd3",
                      color: completed ? "#78716c" : "#d9485f",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      marginTop: "0.12rem"
                    }}
                    aria-hidden="true"
                  >
                    {completed ? "v" : "+"}
                  </div>

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
                            lineHeight: 1.28,
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
                            marginTop: "0.68rem"
                          }}
                        >
                          {metaPill(task.priority, tint)}
                          {task.deadline
                            ? metaPill(`Due ${formatDueDate(task.deadline)}`, {
                                backgroundColor: completed ? "#f5f5f4" : "#faf7f3",
                                color: completed ? "#78716c" : "#57534e",
                                border: "1px solid #ece7e1"
                              })
                            : null}
                          {task.durationMinutes
                            ? metaPill(`${task.durationMinutes}m`, {
                                backgroundColor: completed ? "#f5f5f4" : "#faf7f3",
                                color: completed ? "#78716c" : "#57534e",
                                border: "1px solid #ece7e1"
                              })
                            : null}
                        </div>
                      </div>

                      <span
                        style={{
                          flexShrink: 0,
                          borderRadius: "999px",
                          backgroundColor: completed ? "#f5f5f4" : "#ffffff",
                          border: "1px solid #ece7e1",
                          padding: "0.22rem 0.55rem",
                          fontSize: "0.7rem",
                          color: completed ? "#78716c" : "#78716c",
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
        </section>
      )}

      <AppNav selectedDate={selectedDate} />
    </main>
  )
}

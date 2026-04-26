# ARCHITECTURE.md

# AI Daily Planner — System Architecture

## 1. Purpose

This document defines the technical architecture for the AI Daily Planner MVP.

It is intended for:
- engineers implementing the product
- AI coding agents (for example, Codex) that need clear system boundaries
- future contributors who need to understand the system structure and design decisions

This architecture is optimized for:
- fast MVP delivery
- predictable scheduling behavior
- mobile-first user experience
- maintainable separation between UI, business logic, and AI-assisted functions

---

## 2. Product Summary

AI Daily Planner is a mobile-first planner that converts tasks into scheduled time blocks on a timeline.

Key product behaviors:
- users capture tasks
- the system suggests time blocks for unscheduled tasks
- users can accept, move, retry, or dismiss suggestions
- missed tasks are replanned
- the scheduler is deterministic first, AI-assisted second

Core UX concepts:
- scheduled tasks = solid blocks
- suggested tasks = ghost blocks
- timeline combines calendar events, scheduled tasks, and suggestions

---

## 3. Architecture Goals

### Primary goals
- support a mobile-first PWA
- keep scheduling logic deterministic and testable
- separate AI interpretation from scheduling execution
- keep the system easy to iterate on during MVP
- enable gradual rollout of more advanced AI and personalization later

### Non-goals for MVP
- real-time multi-user collaboration
- complex microservices architecture
- event streaming infrastructure
- full offline-first sync engine
- native mobile app-specific architecture

---

## 4. High-Level Architecture

The MVP should use a modular monolith architecture.

### Recommended stack
- **Frontend:** Next.js or React + TypeScript
- **UI State:** Zustand
- **Server/API:** Next.js API routes or Node.js with Express/Fastify
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** Clerk / NextAuth / Supabase Auth
- **Queue/Jobs:** simple job runner or cron-based worker for MVP
- **Caching:** optional Redis later, not required for MVP
- **AI layer:** LLM API only for metadata inference and explanations
- **Hosting:** Vercel + managed PostgreSQL, or equivalent

### High-level components
1. Frontend PWA
2. Backend API
3. Scheduling Engine
4. AI Service
5. Database
6. Notification/Reminder Service
7. Calendar Integration Service

## 5. System Components

## 5.1 Frontend Application

### Responsibilities
- render timeline UI
- capture and edit tasks
- display scheduled and suggested task blocks
- allow drag/drop and resize
- request scheduling actions from backend
- show explanations for suggestions
- support installable PWA behavior
- cache basic UI assets and recent data for resilience

### Key frontend modules
- `timeline`
- `task-capture`
- `task-detail`
- `suggestion-actions`
- `calendar-view`
- `settings`
- `notifications`

### Frontend state categories
- auth/session state
- current day timeline state
- task list state
- suggestion state
- optimistic UI state for drag/drop
- local settings state

---

## 5.2 Backend API

### Responsibilities
- expose CRUD endpoints for tasks and routines
- provide timeline data for a date range
- trigger scheduling and replanning
- persist suggestions and task states
- coordinate with calendar integration
- call AI service for metadata inference and explanations
- manage user preferences and working hours

### Architectural rule
The backend API is the source of truth for:
- task state
- suggestion state
- scheduling decisions
- timeline composition

---

## 5.3 Scheduling Engine

### Responsibilities
- generate free slots from user availability and calendar data
- evaluate unscheduled tasks
- produce top suggestions
- replan missed tasks
- enforce scheduling constraints
- remain deterministic and testable

### Important rule
The scheduling engine must **not** depend directly on the LLM for final slot assignment.

LLM usage is limited to:
- duration estimation
- task category classification
- task splitting suggestions
- explanation generation

### Internal scheduler phases
1. load inputs
2. normalize task metadata
3. generate candidate slots
4. apply hard constraints
5. score task-slot combinations
6. select top suggestions
7. persist results

---

## 5.4 AI Service

### Responsibilities
- infer missing task duration
- classify task type
- determine whether task is splittable
- generate human-readable explanation text
- optionally suggest subtask breakdown later

### Constraints
- AI outputs must be treated as advisory, not authoritative
- outputs must be normalized into structured fields before use
- backend must define fallback defaults if AI fails or times out

### Example AI-assisted outputs
- duration estimate: 30 minutes
- task type: admin / deep work / routine
- splittable: true
- explanation: "Suggested at 4:00 PM because you have a 45-minute gap after your meetings."

---

## 5.5 Database

### Responsibilities
- persist all product state
- support timeline queries by date
- support scheduling and replanning workflows
- support future analytics and personalization

### Storage requirements
- tasks
- task schedules
- suggestions
- routines
- calendar connections
- calendar events
- user preferences
- scheduling history
- task completion history

---

## 5.6 Notification Service

### Responsibilities
- send reminders for scheduled tasks
- notify user about upcoming accepted tasks
- optionally notify user that new suggestions are available

### MVP recommendation
Use browser/PWA notifications only after install and permission grant.

Do not build complex notification logic at MVP stage.
Use simple reminder triggers from accepted/scheduled tasks.

---

## 5.7 Calendar Integration Service

### Responsibilities
- connect user calendar provider
- import busy events
- sync event updates on a reasonable schedule
- expose normalized busy/free event data to scheduling engine

### MVP recommendation
Start with Google Calendar integration only.

Use calendar data as:
- busy blocks
- event titles for timeline display
- no automatic calendar write-back in v1 unless explicitly desired

## 6. Recommended Folder Structure

```text
docs/
  PRD.md
  ARCHITECTURE.md
  SCHEDULER_SPEC.md

apps/
  web/
    src/
      app/
      components/
      features/
        timeline/
        tasks/
        suggestions/
        routines/
        settings/
      lib/
      services/
      store/
      types/

packages/
  ui/
  shared/
  scheduler/
  ai/
  db/

prisma/
  schema.prisma
```

### Notes
- keep scheduler in its own package/module
- keep AI integration isolated from scheduler core
- shared types should be centralized
- avoid burying business logic inside UI components

---

## 7. Domain Model

## 7.1 Core Entities

### User
Represents an account owner.

Fields:
- `id`
- `email`
- `name`
- `timezone`
- `createdAt`
- `updatedAt`

### UserPreferences
Defines user planning preferences.

Fields:
- `userId`
- `workDayStart`
- `workDayEnd`
- `sleepStart`
- `sleepEnd`
- `defaultTaskDuration`
- `maxDailyPlannedMinutes`
- `autoSuggestOnTaskCreate`
- `suggestionLimit`
- `createdAt`
- `updatedAt`

### Task
Represents a user-created task.

Fields:
- `id`
- `userId`
- `title`
- `notes`
- `status`
- `priority`
- `deadline`
- `durationMinutes`
- `estimatedByAI`
- `effortLevel`
- `taskType`
- `splittable`
- `source`
- `createdAt`
- `updatedAt`

### TaskSchedule
Represents an accepted or confirmed scheduled block.

Fields:
- `id`
- `taskId`
- `userId`
- `startAt`
- `endAt`
- `date`
- `isLocked`
- `completionStatus`
- `createdAt`
- `updatedAt`

### TaskSuggestion
Represents a ghost block suggestion.

Fields:
- `id`
- `taskId`
- `userId`
- `startAt`
- `endAt`
- `date`
- `rank`
- `score`
- `status`
- `reasonSummary`
- `generatedAt`
- `expiresAt`

### Routine
Represents recurring routines.

Fields:
- `id`
- `userId`
- `title`
- `durationMinutes`
- `rrule`
- `preferredTimeWindow`
- `isEnabled`
- `createdAt`
- `updatedAt`

### CalendarConnection
Represents a linked calendar account.

Fields:
- `id`
- `userId`
- `provider`
- `providerAccountId`
- `accessTokenEncrypted`
- `refreshTokenEncrypted`
- `syncStatus`
- `lastSyncedAt`

### CalendarEvent
Represents a normalized external event.

Fields:
- `id`
- `userId`
- `externalId`
- `provider`
- `title`
- `startAt`
- `endAt`
- `isAllDay`
- `busyStatus`
- `lastSyncedAt`

### SchedulingRun
Represents a scheduler execution.

Fields:
- `id`
- `userId`
- `triggerType`
- `dateRangeStart`
- `dateRangeEnd`
- `status`
- `summary`
- `createdAt`

### TaskHistory
Represents task lifecycle events.

Fields:
- `id`
- `taskId`
- `userId`
- `eventType`
- `metadata`
- `createdAt`

## 8. State Model

## 8.1 Task States

Recommended enum:
- `UNSCHEDULED`
- `SUGGESTED`
- `SCHEDULED`
- `COMPLETED`
- `MISSED`
- `ARCHIVED`

## 8.2 Suggestion States

Recommended enum:
- `ACTIVE`
- `ACCEPTED`
- `DISMISSED`
- `EXPIRED`
- `REPLACED`

## 8.3 Task Lifecycle

1. user creates task
2. task starts as `UNSCHEDULED`
3. scheduler may create `SUGGESTED` block(s)
4. user accepts or drags suggestion
5. accepted suggestion becomes `SCHEDULED`
6. after scheduled time:
   - if completed → `COMPLETED`
   - if not completed → `MISSED`
7. replanning may create new suggestion or schedule

---

## 9. Timeline Composition

The timeline for a given day is built from three sources:

1. calendar events
2. accepted/scheduled task blocks
3. active suggestion blocks

### Ordering rules
- sort by start time
- if overlapping:
  - calendar events always display as fixed busy blocks
  - scheduled tasks display next
  - suggestion blocks must never overlap accepted scheduled tasks
- suggestion blocks should be visually lighter than scheduled tasks

### Frontend rendering distinction
- calendar event = neutral/fixed block
- scheduled task = solid block
- suggestion = ghost block with action affordances

---

## 10. Scheduling Architecture

## 10.1 Scheduler Inputs
- user preferences
- user working hours and sleep hours
- tasks eligible for planning
- accepted scheduled tasks
- active routines
- external calendar events
- date range to evaluate

## 10.2 Scheduler Outputs
- top ranked `TaskSuggestion` records
- optional updated task metadata
- scheduling run summary

## 10.3 Hard Constraints
- no overlap with calendar busy events
- no overlap with accepted scheduled tasks
- no placement outside allowed planning hours
- no placement after hard deadline
- respect task minimum required duration
- if unsplittable, slot must fully fit

## 10.4 Soft Constraints
- prefer earlier valid slots
- prefer high-effort tasks in stronger focus windows
- prefer short tasks in fragmented gaps
- avoid overloading a day
- avoid too many simultaneous ghost suggestions

## 10.5 Scheduler Rule
Scheduler should generally only surface top 3–5 suggestions at once.

Unselected tasks remain unscheduled.

## 11. AI Integration Architecture

## 11.1 AI Use Cases in MVP
- infer `durationMinutes` when missing
- infer `taskType`
- infer `effortLevel`
- infer `splittable`
- generate explanation text for suggestions

## 11.2 AI Call Pattern
1. task created or updated
2. backend checks missing metadata
3. AI service returns structured inference
4. backend persists normalized values
5. scheduler uses normalized values

## 11.3 Failure Handling
If AI fails:
- use default duration from user settings
- set generic task type
- mark explanation unavailable or use template explanation
- do not block scheduling

## 11.4 AI Safety Rule
AI must not write directly to scheduling tables without backend validation.

---

## 12. API Design

## 12.1 Tasks

### `POST /api/tasks`
Create task.

Request:
```json
{
  "title": "Prepare design review",
  "notes": "",
  "priority": "HIGH",
  "deadline": "2026-04-20T18:00:00.000Z",
  "durationMinutes": null
}
```

Response:
```json
{
  "task": {
    "id": "task_123",
    "status": "UNSCHEDULED"
  }
}
```

### `GET /api/tasks`
List tasks.

### `GET /api/tasks/:id`
Get task details.

### `PATCH /api/tasks/:id`
Update task.

### `DELETE /api/tasks/:id`
Archive/delete task.

---

## 12.2 Timeline

### `GET /api/timeline?date=YYYY-MM-DD`
Return timeline items for a single day.

Response should contain:
- calendar events
- scheduled tasks
- suggestion blocks

Example:
```json
{
  "date": "2026-04-18",
  "items": [
    {
      "type": "calendar_event",
      "id": "evt_1",
      "title": "Standup",
      "startAt": "2026-04-18T09:00:00.000Z",
      "endAt": "2026-04-18T09:30:00.000Z"
    },
    {
      "type": "task_suggestion",
      "id": "sug_1",
      "taskId": "task_123",
      "title": "Prepare design review",
      "startAt": "2026-04-18T10:00:00.000Z",
      "endAt": "2026-04-18T10:45:00.000Z",
      "state": "ACTIVE"
    }
  ]
}
```

---

## 12.3 Suggestions

### `POST /api/suggestions/plan-day`
Trigger planning for current day or provided range.

Request:
```json
{
  "date": "2026-04-18"
}
```

### `POST /api/suggestions/refresh`
Refresh suggestions.

### `POST /api/suggestions/:id/accept`
Accept suggestion and create scheduled block.

### `POST /api/suggestions/:id/retry`
Generate alternative suggestion for same task.

### `POST /api/suggestions/:id/dismiss`
Dismiss suggestion.

### `GET /api/suggestions/:id/explanation`
Return explanation text and structured reasoning.

---

## 12.4 Schedules

### `PATCH /api/schedules/:id`
Move or resize accepted schedule.

### `POST /api/schedules/:id/complete`
Mark scheduled block complete.

### `POST /api/schedules/:id/missed`
Mark scheduled block missed.

---

## 12.5 Calendar

### `POST /api/calendar/connect`
Initiate integration.

### `POST /api/calendar/sync`
Sync events.

### `GET /api/calendar/events?date=YYYY-MM-DD`
Get normalized calendar events.

## 13. Background Jobs

## 13.1 Suggested MVP jobs
- calendar sync job
- stale suggestion expiration job
- reminder notification job
- missed task evaluation job

## 13.2 Job execution recommendation
For MVP:
- scheduled cron jobs
- lightweight background worker
- avoid distributed job orchestration complexity

---

## 14. PWA Architecture

## 14.1 PWA Requirements
- installable on supported devices
- service worker for static asset caching
- offline fallback page
- basic recent timeline cache
- manifest with app icons and theme colors

## 14.2 Offline Behavior
MVP offline behavior should be limited to:
- viewing recently loaded data if cached
- graceful failure for writes if offline
- queued write-sync can be added later

Do not attempt full offline-first synchronization in v1.

---

## 15. Security Architecture

### Requirements
- authenticate all API routes
- authorize all records by `userId`
- encrypt calendar provider tokens at rest
- avoid exposing AI provider secrets to frontend
- validate all API payloads server-side
- sanitize user-entered text before rendering rich content

### Recommendation
Use:
- Zod for request validation
- server-only secret access
- encrypted secrets in hosting platform

---

## 16. Observability

### Required telemetry for MVP
- API error logs
- scheduler run logs
- AI inference failures
- timeline load latency
- suggestion accept / dismiss / retry events

### Recommendation
Track at least:
- suggestion acceptance rate
- task completion after scheduling
- retry frequency
- dismissal frequency
- scheduler failure rate

This telemetry is important for product iteration, not just debugging.

---

## 17. Testing Strategy

## 17.1 Unit Tests
Must cover:
- scheduler slot generation
- task prioritization
- task state transitions
- suggestion acceptance / dismissal rules
- AI output normalization

## 17.2 Integration Tests
Must cover:
- create task → infer metadata → generate suggestion
- accept suggestion → create scheduled block
- missed task → replanning
- calendar event sync → timeline conflict handling

## 17.3 End-to-End Tests
Must cover:
- install and launch PWA
- add task from mobile UI
- plan day
- accept suggestion
- move scheduled task
- mark task complete

### Important rule
The scheduler package should be heavily unit tested because it is the core product behavior engine.

---

## 18. Scalability and Evolution

## MVP posture
Optimize for correctness and speed of iteration, not hyperscale.

### Expected future evolution
- add personalization layer
- add routine intelligence
- add stronger explanation system
- add write-back to external calendars
- add native mobile app if justified
- add analytics-driven scheduling optimization

### Architectural recommendation
Keep these interfaces isolated now:
- scheduler engine
- AI service
- calendar integration
- notification delivery

This will make later refactoring easier.

---

## 19. Engineering Principles

1. Keep the scheduler deterministic.
2. Keep AI advisory, not authoritative.
3. Keep state transitions explicit.
4. Keep timeline rendering simple and stable.
5. Keep business logic outside UI components.
6. Prefer boring, testable architecture over clever abstractions.
7. Optimize for maintainability and product iteration speed.

---

## 20. Recommended Implementation Order

### Phase 1
- auth
- task CRUD
- timeline UI skeleton
- database schema
- timeline API

### Phase 2
- scheduler package
- suggestion generation
- accept / dismiss / retry actions
- solid vs ghost rendering

### Phase 3
- AI duration estimation
- explanation endpoint
- calendar integration

### Phase 4
- missed-task replanning
- reminders
- telemetry and analytics hooks

---

## 21. Open Technical Questions

- Should accepted scheduled tasks write back to external calendar in MVP?
- Should drag on suggestion auto-accept, or require confirmation?
- How long should active suggestions remain valid before expiration?
- Should retry generate only one alternative or multiple ranked alternatives?
- What degree of optimistic UI should be used for timeline interactions?
- Should routines be generated into timeline as fixed instances or dynamic suggestions?

---

## 22. Final Recommendation

Build the MVP as a mobile-first PWA with:
- React/Next.js
- PostgreSQL + Prisma
- deterministic scheduling engine
- limited AI assist for metadata and explanations
- modular monolith backend

This provides the fastest path to validating the real product risk:
**whether users trust and follow AI-assisted scheduling enough to form a habit.**

# API_SPEC.md

# AI Daily Planner — API Specification

## 1. Purpose

This document defines the backend API contracts for the AI Daily Planner MVP.

It is intended to:
- provide implementation-ready endpoint definitions for engineering
- give AI coding agents a deterministic contract to build against
- align frontend, backend, and scheduler behavior
- reduce ambiguity around request/response shapes and side effects

This spec should be read with:
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/SCHEDULER_SPEC.md`
- `docs/DATA_MODEL.md`

---

## 2. API Principles

1. **REST-first**
   - simple JSON-based HTTP APIs
   - predictable resource naming

2. **Backend as source of truth**
   - timeline, suggestion, and scheduling decisions are persisted server-side

3. **Explicit state transitions**
   - state-changing operations use dedicated endpoints where appropriate
   - accept / dismiss / retry / complete / missed are explicit actions

4. **Deterministic responses**
   - no hidden side effects beyond documented behavior

5. **Auth required**
   - all endpoints require authenticated user context
   - data access is always scoped by `userId`

---

## 3. Conventions

## 3.1 Base Path

Recommended base path:

`/api`

Examples:
- `/api/tasks`
- `/api/timeline`
- `/api/suggestions/plan-day`

## 3.2 Content Type

Requests and responses use:

`Content-Type: application/json`

## 3.3 Time Format

All timestamps must be ISO 8601 UTC strings.

Example:
`2026-04-18T10:00:00.000Z`

## 3.4 Date Format

Date-only query parameters use:

`YYYY-MM-DD`

Example:
`2026-04-18`

## 3.5 Authentication

Authentication is handled by the app auth provider.

Backend extracts authenticated user identity and resolves `userId` from session/token.

The API must not accept `userId` from frontend payloads for normal user-scoped operations.

## 3.6 Error Envelope

All non-2xx responses should follow this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "durationMinutes must be greater than 0",
    "details": {
      "field": "durationMinutes"
    }
  }
}
```

## 3.7 Success Envelope

For consistency, responses should use resource-oriented JSON objects.

Examples:
- `{ "task": { ... } }`
- `{ "tasks": [ ... ] }`
- `{ "timeline": { ... } }`

---

## 4. Enums

These enums must remain aligned with the database layer.

### TaskStatus
- `UNSCHEDULED`
- `SUGGESTED`
- `SCHEDULED`
- `COMPLETED`
- `MISSED`
- `ARCHIVED`

### Priority
- `LOW`
- `MEDIUM`
- `HIGH`

### EffortLevel
- `LOW`
- `MEDIUM`
- `HIGH`

### TaskType
- `DEEP_WORK`
- `ADMIN`
- `ROUTINE`
- `ERRAND`
- `GENERIC`

### SuggestionStatus
- `ACTIVE`
- `ACCEPTED`
- `DISMISSED`
- `EXPIRED`
- `REPLACED`

### CompletionStatus
- `PENDING`
- `COMPLETED`
- `MISSED`

---

## 5. Resource Shapes

## 5.1 Task

```json
{
  "id": "task_123",
  "title": "Prepare design review",
  "notes": "",
  "status": "UNSCHEDULED",
  "priority": "HIGH",
  "deadline": "2026-04-20T18:00:00.000Z",
  "durationMinutes": 45,
  "estimatedByAI": true,
  "effortLevel": "MEDIUM",
  "taskType": "DEEP_WORK",
  "splittable": false,
  "source": "manual",
  "createdAt": "2026-04-18T08:00:00.000Z",
  "updatedAt": "2026-04-18T08:00:00.000Z"
}
```

## 5.2 TaskSchedule

```json
{
  "id": "sch_123",
  "taskId": "task_123",
  "startAt": "2026-04-18T10:00:00.000Z",
  "endAt": "2026-04-18T10:45:00.000Z",
  "date": "2026-04-18T00:00:00.000Z",
  "isLocked": false,
  "completionStatus": "PENDING",
  "createdAt": "2026-04-18T08:05:00.000Z",
  "updatedAt": "2026-04-18T08:05:00.000Z"
}
```

## 5.3 TaskSuggestion

```json
{
  "id": "sug_123",
  "taskId": "task_123",
  "startAt": "2026-04-18T10:00:00.000Z",
  "endAt": "2026-04-18T10:45:00.000Z",
  "date": "2026-04-18T00:00:00.000Z",
  "rank": 1,
  "score": 0.88,
  "status": "ACTIVE",
  "reasonSummary": {
    "slotFit": true,
    "deadlineUrgency": "due_tomorrow",
    "timeOfDayMatch": "good",
    "context": "after_meetings_gap"
  },
  "generatedAt": "2026-04-18T08:06:00.000Z",
  "expiresAt": "2026-04-18T23:59:59.000Z"
}
```

## 5.4 CalendarEvent

```json
{
  "id": "evt_123",
  "externalId": "google_abc",
  "title": "Standup",
  "startAt": "2026-04-18T09:00:00.000Z",
  "endAt": "2026-04-18T09:30:00.000Z",
  "isAllDay": false,
  "busyStatus": "busy",
  "lastSyncedAt": "2026-04-18T07:50:00.000Z"
}
```

## 5.5 TimelineItem

Timeline responses should normalize mixed resource types into a single item list.

```json
{
  "type": "task_suggestion",
  "id": "sug_123",
  "taskId": "task_123",
  "title": "Prepare design review",
  "startAt": "2026-04-18T10:00:00.000Z",
  "endAt": "2026-04-18T10:45:00.000Z",
  "state": "ACTIVE"
}
```

Allowed `type` values:
- `calendar_event`
- `task_schedule`
- `task_suggestion`
- `routine_instance` (future or optional)

---

## 6. Tasks API

## 6.1 Create Task

### Endpoint
`POST /api/tasks`

### Description
Create a new task.

If `durationMinutes`, `effortLevel`, `taskType`, or `splittable` are missing, backend may trigger async or inline metadata inference.

A task-create trigger may also generate one suggestion for the created task if enabled by user preferences.

### Request Body

```json
{
  "title": "Prepare design review",
  "notes": "",
  "priority": "HIGH",
  "deadline": "2026-04-20T18:00:00.000Z",
  "durationMinutes": null,
  "effortLevel": null,
  "taskType": null,
  "splittable": null
}
```

### Validation Rules
- `title` is required
- `title` must be non-empty
- `durationMinutes` if provided must be > 0
- `priority` must be one of allowed enum values

### Response

```json
{
  "task": {
    "id": "task_123",
    "title": "Prepare design review",
    "status": "UNSCHEDULED"
  },
  "suggestion": {
    "id": "sug_123",
    "status": "ACTIVE"
  }
}
```

### Notes
- `suggestion` is optional and may be omitted if no valid slot exists
- backend should not reshuffle existing active suggestions on this endpoint

### Errors
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `INTERNAL_ERROR`

---

## 6.2 List Tasks

### Endpoint
`GET /api/tasks`

### Description
Return tasks for current user.

### Query Parameters
- `status` (optional)
- `priority` (optional)
- `limit` (optional)
- `cursor` (optional for pagination)
- `includeArchived` (optional boolean, default false)

### Example
`GET /api/tasks?status=UNSCHEDULED&limit=20`

### Response

```json
{
  "tasks": [
    {
      "id": "task_123",
      "title": "Prepare design review",
      "status": "UNSCHEDULED",
      "priority": "HIGH",
      "durationMinutes": 45
    }
  ],
  "pageInfo": {
    "nextCursor": null
  }
}
```

---

## 6.3 Get Task

### Endpoint
`GET /api/tasks/:taskId`

### Description
Return full task details, optionally including latest schedule and suggestion data.

### Query Parameters
- `includeSchedules` (optional boolean)
- `includeSuggestions` (optional boolean)
- `includeHistory` (optional boolean)

### Response

```json
{
  "task": {
    "id": "task_123",
    "title": "Prepare design review",
    "status": "SUGGESTED"
  },
  "schedules": [],
  "suggestions": [
    {
      "id": "sug_123",
      "status": "ACTIVE"
    }
  ]
}
```

### Errors
- `NOT_FOUND`
- `UNAUTHORIZED`

---

## 6.4 Update Task

### Endpoint
`PATCH /api/tasks/:taskId`

### Description
Update task metadata.

Updating deadline, priority, duration, or task properties may mark plan as stale but should not silently reshuffle active suggestions unless explicit refresh is triggered.

### Request Body

```json
{
  "title": "Prepare design review v2",
  "notes": "Focus on metrics section",
  "priority": "HIGH",
  "deadline": "2026-04-19T18:00:00.000Z",
  "durationMinutes": 60,
  "effortLevel": "HIGH",
  "taskType": "DEEP_WORK",
  "splittable": true
}
```

### Response

```json
{
  "task": {
    "id": "task_123",
    "title": "Prepare design review v2",
    "status": "UNSCHEDULED"
  },
  "planStatus": {
    "isStale": true,
    "message": "Plan may need updating"
  }
}
```

---

## 6.5 Archive Task

### Endpoint
`DELETE /api/tasks/:taskId`

### Description
Soft-archive a task.

### Behavior
- set task status to `ARCHIVED`
- expire active suggestions for task
- future schedules may either remain or be removed based on product rule
- MVP recommendation: archive should remove future active suggestions and accepted schedules for unsafely dangling tasks only if not already completed

### Response

```json
{
  "success": true
}
```

---

## 7. Timeline API

## 7.1 Get Timeline for Day

### Endpoint
`GET /api/timeline?date=YYYY-MM-DD`

### Description
Return composed timeline items for a specific day.

Timeline includes:
- calendar events
- accepted scheduled tasks
- active suggestion blocks

### Query Parameters
- `date` (required)
- `includeSuggestions` (optional, default true)
- `includeCalendar` (optional, default true)

### Response

```json
{
  "timeline": {
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
    ],
    "summary": {
      "busyMinutes": 90,
      "scheduledMinutes": 45,
      "suggestedMinutes": 45,
      "freeMinutes": 180
    }
  }
}
```

### Errors
- `VALIDATION_ERROR`
- `UNAUTHORIZED`

---

## 8. Suggestions API

## 8.1 Plan Day

### Endpoint
`POST /api/suggestions/plan-day`

### Description
Run scheduler for a specific day.

This is the main explicit planning trigger.

### Request Body

```json
{
  "date": "2026-04-18"
}
```

### Behavior
- evaluate eligible tasks
- generate top-ranked suggestions for given date horizon
- replace existing active suggestions for date if full planning run
- preserve accepted scheduled tasks

### Response

```json
{
  "suggestions": [
    {
      "id": "sug_123",
      "taskId": "task_123",
      "startAt": "2026-04-18T10:00:00.000Z",
      "endAt": "2026-04-18T10:45:00.000Z",
      "rank": 1,
      "score": 0.88,
      "status": "ACTIVE"
    }
  ],
  "runSummary": {
    "triggerType": "PLAN_DAY",
    "eligibleTaskCount": 8,
    "suggestionCount": 3,
    "unscheduledTaskCount": 5
  }
}
```

---

## 8.2 Refresh Suggestions

### Endpoint
`POST /api/suggestions/refresh`

### Description
Explicitly refresh suggestions for a given day or date range.

### Request Body

```json
{
  "date": "2026-04-18"
}
```

### Behavior
- may replace active suggestions
- must preserve accepted scheduled tasks
- should return updated plan status

### Response

```json
{
  "suggestions": [
    {
      "id": "sug_456",
      "taskId": "task_123",
      "status": "ACTIVE"
    }
  ],
  "runSummary": {
    "triggerType": "REFRESH"
  }
}
```

---

## 8.3 Accept Suggestion

### Endpoint
`POST /api/suggestions/:suggestionId/accept`

### Description
Accept a suggestion and convert it into a scheduled block.

### Request Body
No body required.

### Behavior
- mark suggestion as `ACCEPTED`
- create `TaskSchedule`
- set task status to `SCHEDULED`
- expire or replace competing active suggestions for same task

### Response

```json
{
  "schedule": {
    "id": "sch_123",
    "taskId": "task_123",
    "startAt": "2026-04-18T10:00:00.000Z",
    "endAt": "2026-04-18T10:45:00.000Z",
    "completionStatus": "PENDING"
  },
  "task": {
    "id": "task_123",
    "status": "SCHEDULED"
  }
}
```

### Errors
- `NOT_FOUND`
- `INVALID_STATE`
- `CONFLICT`
- `UNAUTHORIZED`

---

## 8.4 Retry Suggestion

### Endpoint
`POST /api/suggestions/:suggestionId/retry`

### Description
Generate an alternative suggestion for the same task.

### Behavior
- mark current suggestion as `REPLACED`
- blacklist prior slot or slot neighborhood for this retry run
- compute next-best valid slot
- if no alternative exists, return no suggestion

### Response (replacement exists)

```json
{
  "suggestion": {
    "id": "sug_789",
    "taskId": "task_123",
    "startAt": "2026-04-18T14:00:00.000Z",
    "endAt": "2026-04-18T14:45:00.000Z",
    "status": "ACTIVE"
  }
}
```

### Response (no alternative)

```json
{
  "suggestion": null,
  "message": "No better time available today"
}
```

---

## 8.5 Dismiss Suggestion

### Endpoint
`POST /api/suggestions/:suggestionId/dismiss`

### Description
Dismiss an active suggestion.

### Behavior
- mark suggestion as `DISMISSED`
- leave task `UNSCHEDULED`
- do not immediately regenerate a new suggestion

### Response

```json
{
  "success": true,
  "task": {
    "id": "task_123",
    "status": "UNSCHEDULED"
  }
}
```

---

## 8.6 Get Suggestion Explanation

### Endpoint
`GET /api/suggestions/:suggestionId/explanation`

### Description
Return human-readable explanation plus structured reason fields for why the suggestion was made.

### Response

```json
{
  "explanation": {
    "text": "Suggested at 10:00 AM because you have a 45-minute free gap after your morning meeting and this task is due tomorrow.",
    "reasonSummary": {
      "slotFit": true,
      "deadlineUrgency": "due_tomorrow",
      "timeOfDayMatch": "good",
      "context": "after_meetings_gap"
    }
  }
}
```

### Errors
- `NOT_FOUND`
- `UNAUTHORIZED`

---

## 9. Schedules API

## 9.1 Update Schedule (Move / Resize)

### Endpoint
`PATCH /api/schedules/:scheduleId`

### Description
Move or resize an accepted scheduled task.

### Request Body

```json
{
  "startAt": "2026-04-18T11:00:00.000Z",
  "endAt": "2026-04-18T11:45:00.000Z"
}
```

### Validation
- new range must not overlap calendar busy events
- new range must not overlap other accepted schedules
- new range must fall in valid planning window
- `endAt` must be after `startAt`

### Behavior
- update schedule
- leave task status as `SCHEDULED`
- record task history event

### Response

```json
{
  "schedule": {
    "id": "sch_123",
    "startAt": "2026-04-18T11:00:00.000Z",
    "endAt": "2026-04-18T11:45:00.000Z"
  }
}
```

### Errors
- `CONFLICT`
- `VALIDATION_ERROR`
- `NOT_FOUND`

---

## 9.2 Complete Scheduled Task

### Endpoint
`POST /api/schedules/:scheduleId/complete`

### Description
Mark scheduled block complete.

### Behavior
- set schedule `completionStatus` to `COMPLETED`
- set task status to `COMPLETED`
- expire active suggestions for same task

### Response

```json
{
  "success": true,
  "task": {
    "id": "task_123",
    "status": "COMPLETED"
  },
  "schedule": {
    "id": "sch_123",
    "completionStatus": "COMPLETED"
  }
}
```

---

## 9.3 Mark Scheduled Task Missed

### Endpoint
`POST /api/schedules/:scheduleId/missed`

### Description
Mark scheduled block missed and optionally trigger replanning.

### Request Body

```json
{
  "triggerReplan": true
}
```

### Behavior
- set schedule `completionStatus` to `MISSED`
- set task status to `MISSED`
- if `triggerReplan` true:
  - run missed-task replanning flow
  - may create replacement suggestion

### Response

```json
{
  "task": {
    "id": "task_123",
    "status": "MISSED"
  },
  "schedule": {
    "id": "sch_123",
    "completionStatus": "MISSED"
  },
  "suggestion": {
    "id": "sug_replan_1",
    "status": "ACTIVE"
  }
}
```

### Notes
- `suggestion` may be null if no valid slot exists

---

## 10. Calendar API

## 10.1 Connect Calendar

### Endpoint
`POST /api/calendar/connect`

### Description
Initiate calendar connection flow.

### MVP recommendation
OAuth flow handled by auth/integration framework; this endpoint may return a redirect URL or simply reflect connected status depending on chosen integration pattern.

### Response

```json
{
  "connectUrl": "https://provider.example.com/oauth/authorize"
}
```

---

## 10.2 Sync Calendar

### Endpoint
`POST /api/calendar/sync`

### Description
Trigger calendar synchronization.

### Behavior
- fetch latest events from provider
- upsert normalized calendar events
- update connection sync metadata

### Response

```json
{
  "success": true,
  "sync": {
    "provider": "GOOGLE",
    "eventCount": 12,
    "lastSyncedAt": "2026-04-18T07:50:00.000Z"
  }
}
```

---

## 10.3 Get Calendar Events

### Endpoint
`GET /api/calendar/events?date=YYYY-MM-DD`

### Description
Return normalized calendar events for a day.

### Response

```json
{
  "events": [
    {
      "id": "evt_123",
      "title": "Standup",
      "startAt": "2026-04-18T09:00:00.000Z",
      "endAt": "2026-04-18T09:30:00.000Z",
      "isAllDay": false,
      "busyStatus": "busy"
    }
  ]
}
```

---

## 11. Preferences API

## 11.1 Get Preferences

### Endpoint
`GET /api/preferences`

### Response

```json
{
  "preferences": {
    "workDayStart": "09:00",
    "workDayEnd": "18:00",
    "sleepStart": "23:00",
    "sleepEnd": "07:00",
    "defaultTaskDuration": 30,
    "maxDailyPlannedMinutes": 360,
    "autoSuggestOnTaskCreate": true,
    "suggestionLimit": 5
  }
}
```

---

## 11.2 Update Preferences

### Endpoint
`PATCH /api/preferences`

### Request Body

```json
{
  "workDayStart": "08:30",
  "workDayEnd": "18:30",
  "defaultTaskDuration": 45,
  "maxDailyPlannedMinutes": 300,
  "autoSuggestOnTaskCreate": true,
  "suggestionLimit": 3
}
```

### Response

```json
{
  "preferences": {
    "workDayStart": "08:30",
    "workDayEnd": "18:30",
    "defaultTaskDuration": 45,
    "maxDailyPlannedMinutes": 300,
    "autoSuggestOnTaskCreate": true,
    "suggestionLimit": 3
  }
}
```

### Notes
Changing preferences may return plan stale status but should not auto-refresh existing suggestions unless explicitly requested.

---

## 12. Health API

## 12.1 Health Check

### Endpoint
`GET /api/health`

### Description
Simple service health endpoint for uptime and deploy validation.

### Response

```json
{
  "ok": true,
  "timestamp": "2026-04-18T08:00:00.000Z"
}
```

---

## 13. Error Codes

Recommended top-level error codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `INVALID_STATE`
- `RATE_LIMITED`
- `INTERNAL_ERROR`
- `DEPENDENCY_ERROR`

### Examples

#### Validation Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title is required"
  }
}
```

#### Conflict Error
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Schedule overlaps an existing busy block"
  }
}
```

#### Invalid State
```json
{
  "error": {
    "code": "INVALID_STATE",
    "message": "Suggestion is not active"
  }
}
```

---

## 14. Side Effects and State Transitions

## 14.1 Task Create
May produce:
- task row
- optional AI metadata inference
- optional new suggestion
- task history event

## 14.2 Suggestion Accept
Produces:
- suggestion status update
- schedule row
- task status transition to `SCHEDULED`
- task history event

## 14.3 Suggestion Dismiss
Produces:
- suggestion status update to `DISMISSED`
- task remains `UNSCHEDULED`
- task history event

## 14.4 Schedule Complete
Produces:
- schedule completion update
- task status transition to `COMPLETED`
- active suggestion cleanup if any

## 14.5 Schedule Missed
Produces:
- schedule completion update
- task status transition to `MISSED`
- optional replan suggestion

---

## 15. Idempotency Guidance

For MVP, dedicated idempotency keys are optional, but these endpoints should be written defensively:

- suggestion accept
- schedule complete
- schedule missed
- suggestion dismiss

Recommended behavior:
- repeated action on already-finalized resource should return current resource state or `INVALID_STATE`

---

## 16. Pagination Guidance

Use cursor-based pagination for:
- task lists
- task history lists
- future analytics lists

MVP may initially use simple `limit` + `cursor`.

---

## 17. Validation Guidance

Use server-side schema validation for all write endpoints.

Recommended validation library:
- Zod

Validation should include:
- enum validation
- timestamp parsing
- required field checks
- positive duration checks
- logical range checks (`startAt < endAt`)

---

## 18. Authorization Rules

All resources are user-scoped.

The API must ensure:
- users can only read/write their own tasks
- users can only read/write their own suggestions
- users can only read/write their own schedules
- users can only read/write their own preferences
- calendar events and connections are user-owned

Any cross-user access should return:
- `NOT_FOUND` or `FORBIDDEN`

Recommended MVP approach:
- prefer `NOT_FOUND` for resources not owned by current user

---

## 19. Observability Requirements

Each state-changing endpoint should log:
- authenticated user ID
- endpoint name
- target resource ID
- state transition performed
- execution duration
- scheduler run ID if applicable
- errors/failures

Important endpoints to instrument:
- task create
- plan day
- suggestion accept
- suggestion retry
- suggestion dismiss
- schedule complete
- schedule missed
- calendar sync

---

## 20. Testing Requirements

API integration tests should cover:

### Tasks
- create valid task
- reject invalid task
- update task
- archive task

### Timeline
- returns mixed normalized items
- hides other users’ data

### Suggestions
- plan day creates top suggestions
- accept suggestion creates schedule
- dismiss suggestion leaves task unscheduled
- retry suggestion creates alternative or null

### Schedules
- move schedule rejects overlap
- complete schedule marks task complete
- missed schedule creates replan suggestion when possible

### Preferences
- get preferences
- update preferences
- invalid preference ranges rejected

### Calendar
- sync stores events
- timeline includes calendar events

---

## 21. Future API Extensions

Potential future additions:
- `POST /api/tasks/:id/split`
- `POST /api/tasks/:id/boost`
- `GET /api/analytics/summary`
- `POST /api/routines`
- `GET /api/plans/week`
- `POST /api/calendar/writeback`

These are out of MVP scope.

---

## 22. Final Recommendation

Implement the API as a thin orchestration layer over:
- persistence services
- scheduler domain module
- AI inference service
- calendar integration service

Keep business rules out of controllers wherever possible.

Controllers should:
- validate input
- load auth context
- call service layer
- return normalized response shapes

This will make the backend easier to test, maintain, and extend.

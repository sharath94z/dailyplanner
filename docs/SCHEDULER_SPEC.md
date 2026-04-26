# SCHEDULER_SPEC.md

# AI Daily Planner — Scheduler Specification

## 1. Purpose

This document defines the scheduling engine behavior for the AI Daily Planner MVP.

It is intended to:
- specify how tasks are converted into timeline suggestions
- define deterministic scheduling rules for engineering implementation
- constrain AI usage to assistive roles only
- provide a predictable foundation for future personalization

This document should be read together with:
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`

---

## 2. Scheduler Design Principles

The scheduler must optimize for:

1. **Completion likelihood**
   - prefer schedules the user is likely to follow
   - do not maximize calendar utilization at the expense of realism

2. **Determinism**
   - same inputs should produce the same outputs
   - avoid opaque end-to-end LLM scheduling in MVP

3. **Stability**
   - suggestions should not constantly move without explicit refresh
   - preserve user trust by reducing plan volatility

4. **User control**
   - scheduler suggests
   - user accepts, drags, retries, or dismisses

5. **Conservative planning**
   - do not fill 100% of available time
   - leave breathing room and buffers

---

## 3. Scope of MVP Scheduler

The MVP scheduler is responsible for:
- generating suggested task blocks (ghost blocks)
- selecting top 3–5 suggestions for a day
- prioritizing unscheduled tasks
- replanning missed tasks
- respecting user availability and calendar conflicts

The MVP scheduler is not responsible for:
- full personality/energy personalization
- probabilistic habit prediction
- full project decomposition
- collaborative/team scheduling
- multi-objective optimization beyond deterministic scoring

---

## 4. Inputs

## 4.1 Required Inputs

### User Preferences
- timezone
- work day start
- work day end
- sleep start
- sleep end
- max daily planned minutes
- suggestion limit
- default task duration
- auto-suggest on create flag

### Calendar State
- external busy events
- accepted scheduled task blocks
- recurring routine instances for evaluated range

### Candidate Tasks
Each task should provide or derive:
- `id`
- `title`
- `priority`
- `deadline`
- `durationMinutes`
- `effortLevel`
- `taskType`
- `splittable`
- `status`
- `createdAt`
- `updatedAt`

### Scheduler Trigger Context
- trigger type
- evaluated date or date range
- optionally task ID if triggered by task creation/update

---

## 4.2 Optional Inputs

These are optional in MVP and may be added later:
- preferred time of day
- user behavioral history
- completion rate by slot/time
- location/context constraints
- energy pattern model

---

## 5. Outputs

The scheduler outputs:

1. zero or more `TaskSuggestion` records
2. optional normalized metadata updates for tasks
3. a `SchedulingRun` summary

Each suggestion must include:
- `taskId`
- `startAt`
- `endAt`
- `date`
- `rank`
- `score`
- `reasonSummary`
- `status`

---

## 6. Scheduler Triggers

## 6.1 Primary Trigger — Plan Day
User explicitly requests planning for a day.

Expected behavior:
- evaluate all eligible unscheduled tasks for the date window
- produce top ranked suggestions
- preserve accepted scheduled tasks
- replace prior active suggestions for that date window if full refresh

Trigger type:
- `PLAN_DAY`

---

## 6.2 Soft Trigger — Task Create
User creates a new task.

Expected behavior:
- evaluate only the newly created task
- attempt to create at most one suggestion for that task
- do not reshuffle existing active suggestions
- if no good slot exists, leave task unscheduled

Trigger type:
- `TASK_CREATED`

---

## 6.3 Refresh Trigger
Used when plan may be outdated.

Example causes:
- calendar changed
- new high-priority task created
- user explicitly taps refresh

Expected behavior:
- rerun scheduler for relevant day or range
- active suggestions may be replaced
- accepted scheduled tasks must remain fixed

Trigger type:
- `REFRESH`

---

## 6.4 Replanning Trigger
Used when a scheduled task is missed.

Expected behavior:
- evaluate remaining day capacity first
- if not feasible, try next valid day
- if repeatedly missed, reduce confidence and consider split recommendation

Trigger type:
- `MISSED_TASK_REPLAN`

---

## 7. Eligibility Rules

A task is eligible for suggestion generation when:
- task status is `UNSCHEDULED` or `MISSED`
- task is not archived or completed
- task is not already represented by an active suggestion for same evaluated date unless refresh
- task deadline has not already passed
- task has enough metadata to be scheduled or can be defaulted

A task is not eligible when:
- task is completed
- task is archived
- task is locked to another future schedule
- task is already accepted and scheduled
- task deadline is expired and policy is to hide expired tasks

---

## 8. Date Window Strategy

For MVP, scheduler should default to a short planning horizon.

### Recommended horizon
- primary: today
- optional secondary: tomorrow if overflow is necessary
- do not schedule far into future automatically in MVP unless deadline requires it

### Rule
If a task does not fit today:
- attempt tomorrow only if:
  - task is urgent
  - task is high priority
  - user explicitly used refresh/plan across range

---

## 9. Free Slot Generation

## 9.1 Objective
Generate a set of valid candidate time windows where tasks may be scheduled.

## 9.2 Sources of Occupied Time
Occupied time includes:
- calendar busy events
- accepted scheduled task blocks
- fixed routine instances
- optional fixed buffers if configured

## 9.3 Base Availability Window
Availability for a day is:

`[workDayStart, workDayEnd]` by default

Optionally extended later for personal tasks, but MVP should use explicit preference bounds.

## 9.4 Slot Generation Process
For each evaluated day:
1. gather occupied intervals
2. sort intervals by start time
3. merge overlapping occupied intervals
4. subtract occupied intervals from base availability
5. produce free intervals
6. discard intervals shorter than minimum useful duration

## 9.5 Minimum Useful Duration
Recommended default:
- 15 minutes

Free slots shorter than minimum useful duration are ignored.

## 9.6 Capacity Rule
Do not schedule tasks into all free time.

Recommended policy:
- maximum planner utilization = 70% of discretionary minutes for the day

This prevents overpacking and preserves trust.

---

## 10. Task Normalization

Before scoring, every candidate task must be normalized.

## 10.1 Required Normalization Fields
- `durationMinutes`
- `priority`
- `deadlineBucket`
- `effortLevel`
- `taskType`
- `splittable`

## 10.2 Defaults
If values are missing:
- `durationMinutes` = user default duration, or 30 minutes
- `priority` = medium
- `effortLevel` = medium
- `taskType` = generic
- `splittable` = false unless AI or rules suggest otherwise

## 10.3 AI-Assisted Normalization
AI may be used to infer:
- duration
- task type
- effort
- splittable

Backend must validate and normalize these outputs.

---

## 11. Task Classification

The scheduler should use task categories for scoring.

### Recommended MVP task types
- `DEEP_WORK`
- `ADMIN`
- `ROUTINE`
- `ERRAND`
- `GENERIC`

### Effort levels
- `LOW`
- `MEDIUM`
- `HIGH`

### Suggested task-type assumptions
- `DEEP_WORK`: longer uninterrupted slots preferred
- `ADMIN`: short fragmented slots acceptable
- `ROUTINE`: preferred consistent windows
- `ERRAND`: may prefer business hours
- `GENERIC`: neutral behavior

---

## 12. Hard Constraints

Hard constraints exclude a task-slot match entirely.

A candidate assignment is invalid if any of the below are true:

1. overlaps external busy calendar event
2. overlaps accepted scheduled task
3. falls outside allowed planning window
4. ends after hard deadline when deadline is strict
5. slot duration is shorter than required duration for unsplittable task
6. slot is too short for minimum useful work
7. suggestion limit for day has already been reached and task is lower-ranked
8. task is locked elsewhere
9. task is already represented by accepted schedule

---

## 13. Soft Constraints

Soft constraints influence scoring.

Soft preferences:
- earlier valid slots are slightly preferred
- high-effort tasks prefer stronger focus windows
- short tasks fit fragmented gaps better
- low-priority tasks should not occupy prime deep-work windows
- overload should be penalized
- excessive fragmentation should be penalized

---

## 14. Priority Model

The scheduler must choose which tasks deserve scarce slots first.

## 14.1 Priority Sources
Priority is influenced by:
- explicit user priority
- deadline urgency
- backlog age
- missed count

## 14.2 Recommended ordering
Rank by:
1. deadline urgency
2. explicit priority
3. missed count / stale age
4. shorter duration tie-breaker when needed

## 14.3 Deadline Urgency Buckets
Suggested buckets:
- overdue
- due today
- due tomorrow
- due within 3 days
- due later
- no deadline

Overdue tasks may either:
- be prioritized for rescue
- or hidden based on product decision
For MVP, prioritize rescue.

---

## 15. Time-of-Day Heuristics

MVP should use light deterministic heuristics.

### Recommended assumptions
- morning: better for high-effort / deep work
- afternoon: acceptable for medium effort
- fragmented windows: better for admin/low-effort tasks
- evening: acceptable for routines if user allows

These heuristics should be configurable later, but may be static in MVP.

---

## 16. Scoring Model

## 16.1 Overview
For each eligible task and valid slot pair, compute a score.

Higher score = better suggestion candidate.

## 16.2 Score Components

Suggested components:
- `durationFitScore`
- `effortTimeMatchScore`
- `deadlineUrgencyScore`
- `priorityScore`
- `slotQualityScore`
- `fragmentationPenalty`
- `dayOverloadPenalty`
- `stabilityAdjustment`
- `retryPenalty` (if similar slot already dismissed repeatedly)

## 16.3 Example Weighted Formula

```text
finalScore =
  0.20 * durationFitScore +
  0.20 * effortTimeMatchScore +
  0.20 * deadlineUrgencyScore +
  0.15 * priorityScore +
  0.10 * slotQualityScore +
  0.05 * staleTaskBoost +
  0.05 * continuityBonus -
  0.03 * fragmentationPenalty -
  0.02 * dayOverloadPenalty
```

Weights may be tuned later but should be deterministic constants in MVP.

## 16.4 Component Definitions

### durationFitScore
How well slot length matches task length.

Examples:
- exact fit or slightly larger = high score
- far larger slot for short task = lower score
- too small = invalid for unsplittable task

### effortTimeMatchScore
How suitable task effort is for slot time of day.

Examples:
- deep work at 9:00 AM = high
- deep work at 5:45 PM = lower
- admin at 2:15 PM = acceptable

### deadlineUrgencyScore
Higher when task deadline is near.

### priorityScore
Maps explicit priority to normalized score.

### slotQualityScore
Rewards:
- uninterrupted blocks
- lower context switching
- reasonable placement relative to surrounding events

### staleTaskBoost
Slight boost for old ignored tasks to prevent backlog rot.

### continuityBonus
Rewards placement into uninterrupted blocks for longer or deep tasks.

### fragmentationPenalty
Penalizes awkward small gaps around the slot.

### dayOverloadPenalty
Penalizes placing task into a day already near utilization threshold.

---

## 17. Suggestion Selection

## 17.1 Candidate Generation
For each eligible task:
- compute valid slot candidates
- score each candidate
- keep best candidate(s)

## 17.2 Day-Level Ranking
After candidates are generated:
- combine all candidate suggestions
- sort by score descending
- enforce per-day suggestion limit
- keep top 3–5 suggestions

## 17.3 No Duplicate Active Suggestions
Do not show multiple active suggestions for the same task on the same day in MVP.

Retry may replace existing suggestion, not create several parallel ghosts.

---

## 18. Stability Rules

Stability is critical for trust.

### Rules
1. existing active suggestions should not move automatically on soft triggers
2. task-create trigger should only suggest for the new task
3. full refresh may replace suggestions
4. accepted scheduled tasks are fixed and never silently moved by scheduler
5. if suggestion is still valid, prefer preserving it instead of generating a new slot on every recomputation

---

## 19. Retry Logic

When user selects “Try another time” for a suggestion:

1. mark current suggestion as `REPLACED`
2. blacklist the prior slot (or narrow time neighborhood) for that task in current run
3. recompute next-best slot for same task
4. create replacement suggestion if valid
5. if no good alternative exists, return no suggestion and leave task unscheduled

### Retry guardrail
Do not loop forever generating poor alternatives.
Recommended:
- maximum 2 retries per task per day in MVP

---

## 20. Dismiss Logic

When user dismisses a suggestion:

1. mark suggestion as `DISMISSED`
2. keep task as `UNSCHEDULED`
3. do not immediately regenerate a new suggestion unless user explicitly retries or refreshes
4. store dismissal event in task history

### Future learning hint
Dismissals should later influence personalization, but MVP may only record them.

---

## 21. Accept Logic

When user accepts a suggestion:

1. mark suggestion as `ACCEPTED`
2. create `TaskSchedule`
3. set task status to `SCHEDULED`
4. expire competing active suggestion for same task
5. include block in future occupancy for scheduling runs

---

## 22. Drag / Move Logic

## 22.1 Dragging a Suggestion
Recommended MVP behavior:
- dragging a suggestion implies acceptance
- dropped position becomes accepted scheduled block if valid
- if dropped into invalid slot, reject move and snap back

## 22.2 Dragging a Scheduled Task
Allowed if:
- destination does not violate hard constraints
- new time remains within valid planning window

If moved:
- update `TaskSchedule`
- record history event
- do not regenerate automatically unless conflicts emerge later

---

## 23. Replanning Missed Tasks

## 23.1 When a Task Becomes Missed
A task becomes missed when:
- scheduled block end time passes
- task has not been marked complete
- optional grace window has elapsed

Suggested grace window:
- 15 minutes

## 23.2 Replanning Rules
When missed:
1. check remaining capacity today
2. if suitable slot exists and day is not overloaded, generate new suggestion later today
3. else evaluate next day
4. increase missed count
5. if missed count >= 3, surface recommendation:
   - split task
   - reduce scope
   - defer intentionally

## 23.3 Zombie Task Protection
Do not endlessly reschedule the same large task unchanged.

If repeated misses occur:
- apply retry penalty
- consider split hint
- reduce rescue priority after repeated failures unless deadline is urgent

---

## 24. Task Splitting Rules

Task splitting is limited in MVP.

## 24.1 When splitting should be suggested
Consider split recommendation when:
- duration > 60–90 minutes
- no valid continuous slot exists
- task has been missed repeatedly
- task appears splittable from AI/rule inference

## 24.2 MVP implementation guidance
For MVP:
- do not auto-create child tasks unless explicitly chosen
- allow AI or UI to suggest that task be split
- actual subtask creation may be deferred to future iteration

---

## 25. Overloaded Day Handling

When the evaluated day lacks sufficient realistic capacity:

1. do not force-fit all tasks
2. prioritize urgent/high-value tasks
3. leave lower-priority tasks unscheduled
4. return summary such as:
   - “Not everything fits today”
   - “2 lower-priority tasks were deferred”

### Policy
Truthful under-planning is better than fake complete planning.

---

## 26. No Valid Slot Handling

If no valid slot exists for a task:
- do not generate a poor suggestion
- leave task unscheduled
- optionally recommend tomorrow or next valid day if planning horizon allows

This is preferred over violating trust with unrealistic placements.

---

## 27. Suggestion Reason Summary

Each suggestion should store a short structured reason summary for explanation UX.

Suggested reason fields:
- free slot fit
- deadline pressure
- task length suitability
- low conflict placement
- future personalization hint

Example:
```json
{
  "slotFit": true,
  "deadlineUrgency": "due_tomorrow",
  "timeOfDayMatch": "good",
  "context": "after_meetings_gap"
}
```

Human-readable explanation may be generated from this later.

---

## 28. Pseudocode

## 28.1 Main Scheduling Run

```text
function runScheduler(input):
    load user preferences
    load date range
    load busy intervals
    load accepted schedules
    load routine instances
    load eligible tasks

    normalizedTasks = normalizeTasks(tasks)

    freeSlotsByDay = buildFreeSlots(dateRange, preferences, busyIntervals, acceptedSchedules, routines)

    candidates = []

    for each task in normalizedTasks:
        validSlots = findValidSlots(task, freeSlotsByDay, preferences)
        scoredCandidates = []

        for each slot in validSlots:
            score = scoreTaskSlot(task, slot, preferences, dateRange)
            scoredCandidates.append({ task, slot, score })

        bestCandidate = selectBestCandidate(scoredCandidates)

        if bestCandidate exists:
            candidates.append(bestCandidate)

    ranked = sort candidates by score desc
    limited = enforceSuggestionLimit(ranked, preferences.suggestionLimit)

    persistSchedulingRun()
    persistSuggestions(limited)

    return limited
```

## 28.2 Soft Trigger on Task Create

```text
function suggestForNewTask(taskId):
    task = loadTask(taskId)
    if task not eligible:
        return no suggestion

    normalize task metadata
    load active suggestions for day
    do not modify existing active suggestions

    freeSlots = buildFreeSlotsForRelevantDay()
    validSlots = findValidSlots(task, freeSlots)

    if none:
        return no suggestion

    best = selectBestCandidate(score all valid slots)
    persist suggestion
    return suggestion
```

## 28.3 Retry Suggestion

```text
function retrySuggestion(suggestionId):
    suggestion = loadSuggestion(suggestionId)
    task = loadTask(suggestion.taskId)

    mark suggestion replaced
    blacklist old slot neighborhood

    validSlots = recomputeValidSlotsExcludingBlacklisted(task)
    if none:
        return no replacement

    replacement = best scored candidate
    persist replacement
    return replacement
```

## 28.4 Replan Missed Task

```text
function replanMissedTask(taskId):
    task = loadTask(taskId)
    increment missed count

    todaySlots = remainingFreeSlotsToday()
    candidateToday = best valid slot if day capacity allows

    if candidateToday exists:
        create suggestion for today
        return

    nextDaySlots = freeSlotsTomorrow()
    candidateTomorrow = best valid slot

    if candidateTomorrow exists:
        create suggestion for tomorrow
        return

    leave task unscheduled
    if missed count >= 3:
        add split recommendation
```

---

## 29. Logging Requirements

Each scheduler run should log:
- run ID
- trigger type
- evaluated range
- number of eligible tasks
- number of generated candidates
- number of persisted suggestions
- tasks with no valid slot
- errors/fallback usage

This is useful for both debugging and product analytics.

---

## 30. Metrics

Track:
- suggestions generated
- suggestions accepted
- suggestions dismissed
- suggestions retried
- accepted suggestions later completed
- accepted suggestions later missed
- tasks with no valid slot
- average time from task creation to suggestion
- average time from suggestion to acceptance

These metrics are required to improve scheduler quality.

---

## 31. Test Cases

The scheduler package should include at least these test categories.

## 31.1 Free Slot Generation
- no calendar events
- overlapping calendar events
- schedules and routines mixed
- minimum slot filtering

## 31.2 Eligibility
- completed tasks excluded
- archived tasks excluded
- missed tasks included
- existing scheduled tasks excluded

## 31.3 Hard Constraints
- overlapping event invalid
- outside working hours invalid
- missed deadline invalid
- insufficient slot length invalid

## 31.4 Scoring
- urgent task outranks low priority
- deep work prefers better focus windows
- short task prefers fragmented slot over prime deep-work block

## 31.5 Stability
- task-create trigger does not reshuffle existing suggestions
- refresh trigger may replace suggestions
- accepted schedule remains fixed

## 31.6 Retry / Dismiss / Accept
- retry replaces prior suggestion
- dismiss leaves task unscheduled
- accept creates schedule and closes competing suggestions

## 31.7 Replanning
- missed task tries today first
- overflow moves to tomorrow
- repeated misses produce split recommendation flag

---

## 32. Future Extensions

The scheduler should be designed so these can be added later without major rewrite:
- personalized time-of-day preferences
- confidence scores exposed in UI
- multi-day planning horizon
- automatic task splitting
- learning from accept/move/dismiss behavior
- richer context constraints
- calendar write-back logic

---

## 33. Non-Goals for MVP

The MVP scheduler should not:
- use unconstrained LLM planning end-to-end
- automatically schedule dozens of tasks far into future
- silently reshuffle accepted user plans
- optimize for perfect calendar packing
- generate multiple competing ghost blocks per task by default

---

## 34. Final Recommendation

Implement the scheduler as a pure deterministic domain module with:
- explicit inputs
- explicit outputs
- strongly typed task and slot models
- isolated scoring functions
- thorough unit tests

Use AI only for metadata inference and explanation generation.

This design best supports the core product goal:
**help every task find a realistic time without sacrificing user trust.**

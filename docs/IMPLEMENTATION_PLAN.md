# IMPLEMENTATION_PLAN.md

# AI Daily Planner — Implementation Plan

## 1. Purpose

This document defines the recommended implementation sequence for the AI Daily Planner MVP.

It is intended to:
- guide engineering execution in a predictable order
- help AI coding agents implement features in manageable phases
- reduce architecture drift
- ensure that the most critical product risks are addressed first

This plan should be read with:
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/SCHEDULER_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/API_SPEC.md`

---

## 2. Implementation Strategy

The implementation should follow these principles:

1. **Build core product loop first**
   - task capture
   - planning
   - suggestion display
   - accept / dismiss / retry
   - completion / missed flow

2. **De-risk scheduler before polish**
   - the core product risk is scheduler quality and trust
   - build deterministic logic before advanced UI polish

3. **Keep vertical slices functional**
   - each phase should produce something testable in the app
   - avoid building isolated backend or frontend only for too long

4. **Delay non-essential integrations**
   - AI metadata inference and calendar sync should come after the core manual loop works

5. **Prefer boring implementation over premature abstraction**
   - MVP should be modular and clean, but not over-engineered

---

## 3. Recommended Milestones

### Milestone 1 — Project Foundation
Goal:
- establish repo structure, database, auth, and app shell

### Milestone 2 — Core Task Management
Goal:
- allow users to create, edit, view, and archive tasks

### Milestone 3 — Timeline + Scheduling Basics
Goal:
- render daily timeline and show scheduled/suggested task blocks

### Milestone 4 — Deterministic Scheduler
Goal:
- implement slot generation, scoring, and suggestion generation

### Milestone 5 — Suggestion Interaction Loop
Goal:
- accept, dismiss, retry, drag, and complete task flow

### Milestone 6 — Missed Task Replanning
Goal:
- handle missed tasks and re-suggest intelligently

### Milestone 7 — AI Assist Layer
Goal:
- add AI duration estimation, classification, and explanation generation

### Milestone 8 — Calendar Integration
Goal:
- sync busy events and reflect them in planning

### Milestone 9 — Production Readiness
Goal:
- improve observability, testing, error handling, and deploy readiness

---

## 4. Phase-by-Phase Plan

## Phase 0 — Repository Setup

### Objectives
- initialize repo structure
- set up package manager and monorepo structure if desired
- configure TypeScript, linting, formatting, env handling

### Deliverables
- working repository
- `docs/` folder with architecture/spec files
- base app scaffold
- CI for lint/test/build
- `.env.example`

### Tasks
- create app folder structure
- configure Next.js app
- set up TypeScript
- configure ESLint + Prettier
- configure Prisma
- add basic health route
- add CI workflow

### Acceptance Criteria
- app boots locally
- lint passes
- test command runs
- Prisma can connect to local DB

---

## Phase 1 — Database and Auth Foundation

### Objectives
- implement schema
- configure auth/session
- establish user-scoped persistence

### Deliverables
- Prisma schema migrated
- auth provider integrated
- user and preferences created on sign-in

### Tasks
- add `schema.prisma`
- create migrations
- set up auth integration
- create user bootstrap logic
- create preferences bootstrap logic

### Acceptance Criteria
- authenticated user can sign in
- user record is created
- user preferences record is created
- protected API routes can resolve current user

### Dependencies
- Phase 0 complete

---

## Phase 2 — Core Task API

### Objectives
- support task CRUD
- expose task APIs aligned with spec

### Deliverables
- `/api/tasks` endpoints
- task validation
- user-scoped task persistence

### Tasks
- implement create task
- implement list tasks
- implement get task
- implement update task
- implement archive task
- add Zod request validation
- add integration tests

### Acceptance Criteria
- user can create task
- task persists to DB
- invalid payloads fail with proper errors
- user cannot access another user's tasks

### Dependencies
- Phase 1 complete

---

## Phase 3 — Basic Timeline UI and Timeline API

### Objectives
- create minimal timeline UI
- expose timeline endpoint
- show tasks on a day view

### Deliverables
- mobile-first day timeline screen
- `GET /api/timeline`
- frontend timeline rendering primitives

### Tasks
- build day timeline layout
- build time grid
- build timeline item renderer
- implement timeline API returning:
  - scheduled tasks
  - suggestions
  - calendar items placeholder or empty set
- create task block component
- create ghost block component

### Acceptance Criteria
- timeline loads current day
- timeline displays items in chronological order
- ghost and solid states are visually distinct

### Dependencies
- Phase 2 complete

---

## Phase 4 — Scheduler Core Domain Module

### Objectives
- implement deterministic scheduling logic as isolated package/module

### Deliverables
- pure scheduling module
- slot generation
- task normalization
- scoring logic
- suggestion selection

### Tasks
- implement free slot generation
- implement hard constraint checks
- implement task normalization defaults
- implement scoring functions
- implement candidate ranking
- implement suggestion limit logic
- write unit tests for scheduler package

### Acceptance Criteria
- scheduler produces same output for same input
- scheduler respects working hours and conflicts
- scheduler limits suggestions to configured max
- scheduler never overlaps accepted schedules or calendar busy blocks

### Dependencies
- Phase 1 complete
- Phase 2 complete

---

## Phase 5 — Suggestion Generation Endpoints

### Objectives
- connect scheduler to backend APIs
- persist suggestion records

### Deliverables
- `POST /api/suggestions/plan-day`
- `POST /api/suggestions/refresh`
- task-create soft suggestion generation

### Tasks
- implement scheduling run service
- implement suggestion persistence
- implement run summaries
- connect create-task flow to optional suggestion generation
- enforce stability rule:
  - no reshuffle on task-create trigger
- add integration tests

### Acceptance Criteria
- user can click plan day and receive suggestions
- suggestions persist as `TaskSuggestion`
- creating a new task can produce a single suggestion without reshuffling existing ones
- refresh can replace active suggestions

### Dependencies
- Phase 4 complete
- Phase 3 complete

---

## Phase 6 — Suggestion Interaction Loop

### Objectives
- support accept / dismiss / retry / drag interactions

### Deliverables
- accept suggestion flow
- dismiss suggestion flow
- retry suggestion flow
- schedule move flow

### Tasks
- implement `POST /api/suggestions/:id/accept`
- implement `POST /api/suggestions/:id/dismiss`
- implement `POST /api/suggestions/:id/retry`
- implement `PATCH /api/schedules/:id`
- wire frontend actions to timeline
- implement drag-to-accept for ghost blocks
- handle invalid drag destinations

### Acceptance Criteria
- accepting a suggestion creates a schedule
- dismissing leaves task unscheduled
- retry creates alternative suggestion or returns null
- dragging a suggestion into a valid slot creates scheduled block
- dragging into invalid slot fails gracefully

### Dependencies
- Phase 5 complete

---

## Phase 7 — Task Completion and Missed Logic

### Objectives
- support task completion flow
- support missed task state transitions
- enable replanning entry point

### Deliverables
- complete endpoint
- missed endpoint
- frontend action affordances
- task history persistence

### Tasks
- implement `POST /api/schedules/:id/complete`
- implement `POST /api/schedules/:id/missed`
- add grace-window logic if desired
- update task state transitions
- expire suggestion leftovers when completed
- add task history events

### Acceptance Criteria
- completed tasks move to `COMPLETED`
- missed tasks move to `MISSED`
- task history reflects state changes
- completed tasks no longer appear as active suggestions

### Dependencies
- Phase 6 complete

---

## Phase 8 — Replanning Engine

### Objectives
- re-suggest missed tasks
- prevent zombie task loops

### Deliverables
- missed task replan flow
- missed count tracking
- split recommendation hook

### Tasks
- implement missed-task replanning logic
- check remaining day capacity first
- fallback to tomorrow if needed
- record missed count in task history or metadata
- add repeated-failure threshold behavior
- expose summary message in API response

### Acceptance Criteria
- missed task can generate same-day replan if capacity exists
- otherwise moves to next valid day suggestion
- repeated failures do not create infinite low-quality loops

### Dependencies
- Phase 7 complete

---

## Phase 9 — Preferences API and Settings UI

### Objectives
- allow user to configure planning boundaries and defaults

### Deliverables
- preferences endpoints
- settings screen

### Tasks
- implement `GET /api/preferences`
- implement `PATCH /api/preferences`
- build settings form
- support:
  - workDayStart
  - workDayEnd
  - defaultTaskDuration
  - maxDailyPlannedMinutes
  - suggestionLimit
  - autoSuggestOnTaskCreate

### Acceptance Criteria
- settings persist correctly
- scheduler uses updated values
- changing settings may mark plan stale but does not auto-refresh unless triggered

### Dependencies
- Phase 1 complete
- scheduler integrated

---

## Phase 10 — AI Assist Layer

### Objectives
- improve task normalization and explanation UX

### Deliverables
- duration inference
- task classification inference
- explanation generation endpoint

### Tasks
- implement AI service wrapper
- add structured prompts for:
  - duration estimate
  - task type
  - effort level
  - splittable
- implement fallback behavior
- implement explanation generation or template generation
- implement `GET /api/suggestions/:id/explanation`

### Acceptance Criteria
- missing duration can be inferred
- AI failure does not block task creation or scheduling
- explanation endpoint returns useful reasoning text
- AI outputs are normalized and validated before use

### Dependencies
- core scheduler complete
- task APIs complete

---

## Phase 11 — Calendar Integration

### Objectives
- import busy events and reflect them in scheduling

### Deliverables
- calendar connection
- sync endpoint
- normalized calendar event storage
- timeline inclusion

### Tasks
- implement Google Calendar auth/integration flow
- implement sync job/service
- persist normalized events
- include calendar events in timeline
- ensure scheduler treats them as occupied time

### Acceptance Criteria
- calendar sync stores events
- timeline shows calendar events
- scheduler never places suggestions over busy events

### Dependencies
- Phase 4 complete
- auth foundation complete

---

## Phase 12 — Notifications

### Objectives
- support reminders for scheduled tasks

### Deliverables
- notification permission flow
- reminder scheduling strategy
- simple upcoming task reminders

### Tasks
- add PWA notification support
- request permission intentionally
- create reminder job or client reminder scheduling logic
- notify for accepted scheduled tasks only

### Acceptance Criteria
- installed app can receive reminders
- reminder scheduling does not trigger for dismissed or unscheduled tasks

### Dependencies
- accepted scheduling flow complete
- PWA setup complete

---

## Phase 13 — Observability and Analytics Hooks

### Objectives
- instrument key user and scheduler events
- support debugging and product evaluation

### Deliverables
- structured logs
- analytics event hooks
- scheduler run metrics

### Tasks
- log API errors
- log scheduler runs
- track accept/dismiss/retry/complete/missed events
- track suggestion acceptance rate
- track no-valid-slot events
- create admin/debug inspection logs if needed

### Acceptance Criteria
- scheduler runs can be diagnosed from logs
- product metrics can be derived from events
- errors are searchable

### Dependencies
- main product loop complete

---

## Phase 14 — Hardening and Launch Prep

### Objectives
- improve reliability
- close obvious UX and backend gaps
- prepare for pilot users

### Deliverables
- API cleanup
- improved validation and error messaging
- performance tuning
- seed/demo data if useful
- deploy-ready environment config

### Tasks
- resolve API inconsistencies
- improve loading states and failure states
- harden auth and authorization checks
- test with realistic task sets and calendar loads
- verify mobile layout and installability
- verify time zone correctness

### Acceptance Criteria
- core loop works reliably end-to-end
- app can be demoed to users without manual intervention
- no critical known blockers remain

### Dependencies
- all core product phases complete

---

## 5. Recommended Delivery Order by User Value

If implementation must be aggressively prioritized, use this order:

1. task CRUD
2. timeline UI
3. scheduler module
4. plan day endpoint
5. ghost blocks rendering
6. accept / dismiss / retry
7. complete / missed
8. replanning
9. preferences
10. AI assist
11. calendar integration
12. notifications
13. analytics / hardening

---

## 6. Engineering Workstreams

The project can be broken into parallel workstreams.

### Workstream A — Frontend
- timeline view
- task capture
- ghost/solid block rendering
- settings
- action affordances

### Workstream B — Backend APIs
- task endpoints
- timeline endpoint
- suggestion endpoints
- schedule endpoints
- preferences endpoints

### Workstream C — Scheduler Domain
- slot generation
- scoring
- ranking
- replanning

### Workstream D — Integrations
- AI service
- calendar service
- notifications

### Workstream E — Platform
- auth
- database
- migrations
- deployment
- observability

---

## 7. Suggested Branch / PR Strategy

Use small, testable pull requests.

Recommended PR sequence:
1. project scaffold
2. Prisma schema + migration
3. auth integration
4. task CRUD API
5. timeline UI scaffold
6. scheduler package basics
7. plan day endpoint
8. suggestion rendering
9. accept / dismiss / retry
10. complete / missed
11. replanning
12. preferences
13. AI assist
14. calendar sync
15. notifications
16. analytics and cleanup

### Rule
Avoid giant PRs that mix:
- schema changes
- scheduler changes
- major UI changes
- integrations

---

## 8. Definition of Done for MVP

The MVP is complete when all of the following are true:

1. user can sign in
2. user can create tasks
3. user can see tasks on a mobile-first day timeline
4. user can click “Plan My Day” and receive top suggestions
5. user can accept, retry, dismiss, or drag suggestions
6. accepted suggestions become solid scheduled blocks
7. user can mark scheduled tasks complete or missed
8. missed tasks can be replanned
9. scheduler respects calendar busy events and working hours
10. key flows are tested and stable
11. AI assist works as a non-blocking enhancement
12. app is deployable as a PWA

---

## 9. Critical Risks During Implementation

### Risk 1 — Scheduler feels wrong
Mitigation:
- write strong unit tests
- keep scoring simple and inspectable
- add run summaries and logs

### Risk 2 — Timeline interaction becomes fragile
Mitigation:
- build robust block primitives
- validate drag destinations server-side
- use optimistic UI carefully

### Risk 3 — Too much AI dependency
Mitigation:
- keep AI optional
- always provide deterministic fallbacks

### Risk 4 — Calendar integration delays MVP
Mitigation:
- do not block core loop on calendar integration
- build planner without it first

### Risk 5 — Scope creep
Mitigation:
- stick to documented endpoints and states
- defer routines, analytics dashboards, and advanced personalization if needed

---

## 10. Immediate Next Tasks

If starting implementation now, the first concrete tasks should be:

1. commit all docs to repo:
   - PRD
   - ARCHITECTURE
   - SCHEDULER_SPEC
   - DATA_MODEL
   - API_SPEC
   - IMPLEMENTATION_PLAN

2. set up:
   - Next.js app
   - Prisma
   - PostgreSQL
   - auth

3. generate and apply initial Prisma migration

4. implement:
   - `/api/health`
   - `/api/tasks` create/list/update/delete

5. build:
   - minimal day timeline UI
   - task capture UI

6. implement scheduler package skeleton with:
   - free slot generation
   - basic scoring
   - output interface

7. implement:
   - `POST /api/suggestions/plan-day`

---

## 11. Final Recommendation

The implementation should prioritize validating the **core habit loop** over feature completeness.

That loop is:

1. capture task
2. receive suggestion
3. accept or adjust
4. complete task
5. return next day

Everything in the plan should be evaluated against one question:

**Does this help us validate whether users trust AI-assisted scheduling enough to use the planner repeatedly?**

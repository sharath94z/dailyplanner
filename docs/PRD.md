# 🧠 AI Daily Planner — Product Requirements Document (PRD)

## 1. Overview

AI-powered daily planner that converts tasks into scheduled time blocks on a timeline.

Unlike traditional todo apps, this system ensures:
- every task gets a time
- planning is automated but user-controlled
- backlog is actively managed

---

## 2. Core Principle

> Tasks are more likely to be completed when they are scheduled at the right time with realistic expectations.

---

## 3. Target User

- Knowledge workers (engineers, PMs, designers)
- Already use calendar + todo tools
- Struggle with:
  - unscheduled tasks
  - backlog accumulation
  - decision fatigue

---

## 4. Core Features (MVP)

### 4.1 Timeline View
- Vertical timeline of day
- Displays:
  - calendar events
  - scheduled tasks (solid blocks)
  - suggested tasks (ghost blocks)

---

### 4.2 Task Capture
- Input: title (required)
- Optional:
  - duration
  - priority
- If missing duration → AI estimates

---

### 4.3 AI Scheduling Suggestions
- System generates suggested time blocks (ghost blocks)
- Max 3–5 suggestions at a time

---

### 4.4 Task Interaction

Each suggested task supports:

- Accept → becomes solid block
- Drag → reschedule (auto-accept)
- “Why this time?” → explanation
- “Try another time” → regenerate suggestion
- Dismiss → remove suggestion

---

### 4.5 Replanning
- If task is missed:
  - reschedule to next available slot
  - if repeated failures → prompt user or split task

---

## 5. State Model

### Task States

- UNSCHEDULED
- SUGGESTED (ghost)
- SCHEDULED (solid)
- MISSED
- RESCHEDULED

---

### State Transitions

- UNSCHEDULED → SUGGESTED (AI)
- SUGGESTED → SCHEDULED (accept/drag)
- SUGGESTED → UNSCHEDULED (dismiss)
- SCHEDULED → MISSED (not completed)
- MISSED → RESCHEDULED (AI)

---

## 6. Behavior & Decision System

### Scheduling Philosophy

- Optimize for completion likelihood
- Do not exceed 70% of available time
- Avoid stacking high-effort tasks
- Prefer short tasks in small gaps

---

### Task Prioritization Order

1. Deadline urgency
2. Priority
3. Task age
4. Duration

---

### Task Rules

- Tasks > 60–90 mins → can be split
- Missing duration → estimate
- Low priority tasks → not forced into full days

---

### Replanning Rules

If task is missed:
1. Try next slot today
2. Else move to next day
3. If missed 3+ times:
   - suggest split
   - or ask user to drop

---

## 7. AI System Design

### Inputs

- Calendar events
- Task metadata
- Free time slots

---

### Outputs

- Suggested task:
  - start_time
  - duration

---

### Decision Rules

- Match duration to slot
- Match effort to time of day
- Respect constraints (calendar, working hours)

---

### Fallback Behavior

- No slot → suggest next day
- Overloaded day → defer tasks

---

## 8. Trigger & Update System

### Primary Trigger

- User clicks: "Plan My Day"
→ generate suggestions

---

### Soft Trigger

- On task creation:
→ generate suggestion ONLY for that task

---

### Refresh Trigger

Triggered when:
- high priority task added
- calendar changes
- user taps refresh

---

### Stability Rule

- Suggestions remain stable
- No auto-reordering unless refresh triggered

---

## 9. Trust & Interaction Model

### Suggestion System

- Show max 3–5 ghost blocks
- Do not overload timeline

---

### User Controls

- Accept
- Move (drag)
- Retry suggestion
- Dismiss

---

### Explanation System

When user clicks "Why this time?":

System explains based on:
- free time availability
- task duration fit
- meeting gaps
- (future) user behavior patterns

---

## 10. Edge Case Handling

### Overloaded Day
- Show message: "Not everything fits today"
- Defer lower priority tasks

---

### No Valid Slot
- Suggest scheduling on next available day

---

### Repeated Failure
- Suggest splitting task
- Ask user for decision

---

### Too Many Tasks
- Limit suggestions to top priority tasks
- Keep rest in backlog

---

## 11. User Flow

### First Use
1. Add tasks
2. Click "Plan My Day"
3. See ghost suggestions
4. Accept / adjust

---

### Daily Flow
1. Open app
2. View timeline
3. Complete tasks
4. Missed tasks → rescheduled

---

## 12. Success Metrics

### Primary
- % scheduled tasks completed

### Secondary
- suggestion acceptance rate
- task completion rate
- reschedule frequency

---

## 13. Retention Loop

1. Capture task
2. AI suggests time
3. User completes task
4. Feels progress
5. Returns next day

---

## 14. Non-Goals (MVP)

- No team collaboration
- No project management
- No complex habit tracking
- No desktop-first experience

---

## 15. Open Questions

- Should scheduling be auto or manual-first?
- When should tasks be auto-split?
- How to detect user energy patterns?
- How aggressive should backlog scheduling be?

---

## 16. Notes for Engineering / Codex

- Scheduling engine should be deterministic (rule-based first)
- LLM should be used ONLY for:
  - duration estimation
  - task classification
  - explanation generation
- Avoid full LLM-based scheduling in MVP
- Keep scheduling logic testable and predictable

---

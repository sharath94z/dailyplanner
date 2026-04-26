# DATA_MODEL.md

# AI Daily Planner — Data Model

## 1. Overview

This document defines the database schema and data model for the AI Daily Planner MVP.

It is designed to:
- support scheduling engine requirements
- ensure clear task lifecycle management
- enable future analytics and personalization

Database: PostgreSQL  
ORM: Prisma (recommended)

---

## 2. Core Entities

### 2.1 User

Represents a system user.

Fields:
- id (string, PK)
- email (string, unique)
- name (string)
- timezone (string)
- createdAt (timestamp)
- updatedAt (timestamp)

---

### 2.2 UserPreferences

Stores user-specific planning preferences.

Fields:
- id (string, PK)
- userId (FK -> User.id)
- workDayStart (time)
- workDayEnd (time)
- sleepStart (time)
- sleepEnd (time)
- defaultTaskDuration (int)
- maxDailyPlannedMinutes (int)
- suggestionLimit (int)
- createdAt (timestamp)
- updatedAt (timestamp)

---

### 2.3 Task

Represents a user-created task.

Fields:
- id (string, PK)
- userId (FK)
- title (string)
- notes (text)
- status (enum)
- priority (enum)
- deadline (timestamp, nullable)
- durationMinutes (int, nullable)
- estimatedByAI (boolean)
- effortLevel (enum)
- taskType (enum)
- splittable (boolean)
- createdAt (timestamp)
- updatedAt (timestamp)

---

### 2.4 TaskSchedule

Represents an accepted scheduled block.

Fields:
- id (string, PK)
- taskId (FK)
- userId (FK)
- startAt (timestamp)
- endAt (timestamp)
- date (date)
- completionStatus (enum)
- createdAt (timestamp)
- updatedAt (timestamp)

---

### 2.5 TaskSuggestion

Represents AI-generated suggestion (ghost block).

Fields:
- id (string, PK)
- taskId (FK)
- userId (FK)
- startAt (timestamp)
- endAt (timestamp)
- date (date)
- score (float)
- rank (int)
- status (enum)
- reasonSummary (json)
- createdAt (timestamp)

---

### 2.6 CalendarEvent

External calendar events.

Fields:
- id (string, PK)
- userId (FK)
- title (string)
- startAt (timestamp)
- endAt (timestamp)
- isAllDay (boolean)

---

### 2.7 Routine

Recurring tasks.

Fields:
- id (string, PK)
- userId (FK)
- title (string)
- durationMinutes (int)
- rrule (string)
- createdAt (timestamp)

---

## 3. Enums

### TaskStatus
- UNSCHEDULED
- SUGGESTED
- SCHEDULED
- COMPLETED
- MISSED
- ARCHIVED

### Priority
- LOW
- MEDIUM
- HIGH

### EffortLevel
- LOW
- MEDIUM
- HIGH

### TaskType
- DEEP_WORK
- ADMIN
- ROUTINE
- GENERIC

### SuggestionStatus
- ACTIVE
- ACCEPTED
- DISMISSED
- EXPIRED

### CompletionStatus
- PENDING
- COMPLETED
- MISSED

---

## 4. Relationships

User → Tasks (1:N)  
Task → TaskSchedule (1:N)  
Task → TaskSuggestion (1:N)  
User → CalendarEvents (1:N)  

---

## 5. Indexing

Recommended indexes:
- Task(userId, status)
- TaskSchedule(userId, date)
- TaskSuggestion(userId, date)
- CalendarEvent(userId, startAt)

---

## 6. Constraints

- startAt < endAt
- no overlapping TaskSchedule for same user
- TaskSuggestion should not overlap TaskSchedule
- durationMinutes > 0

---

## 7. Notes

- Keep scheduler logic independent of DB
- Use migrations via Prisma
- Store timestamps in UTC

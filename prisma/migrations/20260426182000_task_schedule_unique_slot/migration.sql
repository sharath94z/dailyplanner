CREATE UNIQUE INDEX "TaskSchedule_userId_taskId_startAt_endAt_key"
ON "TaskSchedule"("userId", "taskId", "startAt", "endAt");

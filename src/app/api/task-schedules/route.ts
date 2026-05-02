import { NextRequest, NextResponse } from "next/server";

import { routeErrorResponse, validationErrorFromZod } from "../../../lib/api-errors";
import { getCurrentUserId } from "../../../lib/auth";
import { createTaskScheduleSchema } from "../../../lib/validators/task-schedule";
import { createTaskSchedule } from "../../../services/schedules/schedule.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = createTaskScheduleSchema.safeParse(payload);

    if (!parsed.success) {
      return validationErrorFromZod(parsed.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await createTaskSchedule(userId, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

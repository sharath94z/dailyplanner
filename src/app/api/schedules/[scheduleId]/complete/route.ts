import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { routeErrorResponse, validationErrorFromZod } from "../../../../../lib/api-errors";
import { getCurrentUserId } from "../../../../../lib/auth";
import { completeSchedule } from "../../../../../services/schedules/schedule.service";

export const runtime = "nodejs";

const scheduleIdSchema = z.object({
  scheduleId: z.string().trim().min(1)
});

export async function POST(
  request: NextRequest,
  context: { params: { scheduleId: string } | Promise<{ scheduleId: string }> }
) {
  try {
    const { scheduleId } = await context.params;
    const parsedId = scheduleIdSchema.safeParse({ scheduleId });

    if (!parsedId.success) {
      return validationErrorFromZod(parsedId.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await completeSchedule(userId, parsedId.data.scheduleId);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

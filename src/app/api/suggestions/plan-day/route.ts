import { NextRequest, NextResponse } from "next/server";

import { routeErrorResponse, validationErrorFromZod } from "../../../../lib/api-errors";
import { getCurrentUserId } from "../../../../lib/auth";
import { planDaySchema } from "../../../../lib/validators/suggestions";
import { planDay } from "../../../../services/scheduler/scheduler.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = planDaySchema.safeParse(payload);

    if (!parsed.success) {
      return validationErrorFromZod(parsed.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await planDay(userId, parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

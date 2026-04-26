import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "../../../lib/auth";
import { routeErrorResponse, validationErrorFromZod } from "../../../lib/api-errors";
import { timelineQuerySchema } from "../../../lib/validators/timeline";
import { getTimelineForDate } from "../../../services/timeline/timeline.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const parsed = timelineQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (!parsed.success) {
      return validationErrorFromZod(parsed.error);
    }

    const userId = await getCurrentUserId(request);
    const timeline = await getTimelineForDate(userId, parsed.data);

    return NextResponse.json({ timeline });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

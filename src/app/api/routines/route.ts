import { NextRequest, NextResponse } from "next/server";

import { routeErrorResponse, validationErrorFromZod } from "../../../lib/api-errors";
import { getCurrentUserId } from "../../../lib/auth";
import { createRoutineSchema } from "../../../lib/validators/routine";
import { createRoutine } from "../../../services/routines/routine.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = createRoutineSchema.safeParse(payload);

    if (!parsed.success) {
      return validationErrorFromZod(parsed.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await createRoutine(userId, parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

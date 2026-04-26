import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { routeErrorResponse, validationErrorFromZod } from "../../../../../lib/api-errors";
import { getCurrentUserId } from "../../../../../lib/auth";
import { acceptSuggestion } from "../../../../../services/scheduler/scheduler.service";

export const runtime = "nodejs";

const suggestionIdSchema = z.object({
  suggestionId: z.string().trim().min(1)
});

export async function POST(
  request: NextRequest,
  context: { params: { suggestionId: string } | Promise<{ suggestionId: string }> }
) {
  try {
    const { suggestionId } = await context.params;
    const parsedId = suggestionIdSchema.safeParse({ suggestionId });

    if (!parsedId.success) {
      return validationErrorFromZod(parsedId.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await acceptSuggestion(userId, parsedId.data.suggestionId);

    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

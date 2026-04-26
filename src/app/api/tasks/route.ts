import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserId } from "../../../lib/auth";
import { routeErrorResponse, validationErrorFromZod } from "../../../lib/api-errors";
import { taskCreateSchema, taskListQuerySchema } from "../../../lib/validators/task";
import { createTask, listTasks } from "../../../services/tasks/task.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const parsed = taskCreateSchema.safeParse(payload);

    if (!parsed.success) {
      return validationErrorFromZod(parsed.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await createTask(userId, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = taskListQuerySchema.safeParse(query);

    if (!parsed.success) {
      return validationErrorFromZod(parsed.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await listTasks(userId, parsed.data);
    return NextResponse.json({
      tasks: result.tasks,
      pageInfo: {
        nextCursor: result.nextCursor
      }
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

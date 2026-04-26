import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "../../../../lib/auth";
import { routeErrorResponse, validationErrorFromZod } from "../../../../lib/api-errors";
import { taskGetQuerySchema, taskUpdateSchema } from "../../../../lib/validators/task";
import { archiveTask, getTask, updateTask } from "../../../../services/tasks/task.service";

export const runtime = "nodejs";

const taskIdSchema = z.object({
  taskId: z.string().trim().min(1)
});

export async function GET(
  request: NextRequest,
  context: { params: { taskId: string } | Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await context.params;
    const parsedId = taskIdSchema.safeParse({ taskId });
    const parsedQuery = taskGetQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (!parsedId.success) {
      return validationErrorFromZod(parsedId.error);
    }

    if (!parsedQuery.success) {
      return validationErrorFromZod(parsedQuery.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await getTask(userId, parsedId.data.taskId, parsedQuery.data);
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { taskId: string } | Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await context.params;
    const parsedId = taskIdSchema.safeParse({ taskId });
    const payload = await request.json().catch(() => null);
    const parsedBody = taskUpdateSchema.safeParse(payload);

    if (!parsedId.success) {
      return validationErrorFromZod(parsedId.error);
    }

    if (!parsedBody.success) {
      return validationErrorFromZod(parsedBody.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await updateTask(userId, parsedId.data.taskId, parsedBody.data);
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { taskId: string } | Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await context.params;
    const parsedId = taskIdSchema.safeParse({ taskId });

    if (!parsedId.success) {
      return validationErrorFromZod(parsedId.error);
    }

    const userId = await getCurrentUserId(request);
    const result = await archiveTask(userId, parsedId.data.taskId);
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

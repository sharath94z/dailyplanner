import "server-only";

import { prisma } from "./db";

const DEFAULT_TIME_ZONE = "Asia/Tokyo";

export async function getUserTimeZone(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      timezone: true
    }
  });

  return user?.timezone ?? DEFAULT_TIME_ZONE;
}

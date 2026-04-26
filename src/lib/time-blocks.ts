export type TimeBlock = {
  startAt: Date;
  endAt: Date;
};

export function getBlockDurationMinutes(startAt: Date, endAt: Date) {
  return Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
}

export function mergeTimeBlocks(blocks: TimeBlock[]): TimeBlock[] {
  if (blocks.length === 0) {
    return [];
  }

  const sortedBlocks = [...blocks]
    .map((block) => ({
      startAt: new Date(block.startAt),
      endAt: new Date(block.endAt)
    }))
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
  const merged: TimeBlock[] = [sortedBlocks[0]];

  for (const block of sortedBlocks.slice(1)) {
    const current = merged[merged.length - 1];

    if (block.startAt.getTime() <= current.endAt.getTime()) {
      if (block.endAt.getTime() > current.endAt.getTime()) {
        current.endAt = block.endAt;
      }
      continue;
    }

    merged.push(block);
  }

  return merged;
}

export function getMergedBlockDurationMinutes(blocks: TimeBlock[]) {
  return mergeTimeBlocks(blocks).reduce(
    (total, block) => total + getBlockDurationMinutes(block.startAt, block.endAt),
    0
  );
}

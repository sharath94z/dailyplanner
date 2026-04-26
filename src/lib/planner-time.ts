const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_ONLY_REGEX = /^(\d{2}):(\d{2})$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export type DayWindow = {
  date: string;
  timeZone: string;
  dayStartUtc: Date;
  dayEndUtc: Date;
};

function getFormatter(timeZone: string) {
  const cacheKey = timeZone;
  const cached = formatterCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  formatterCache.set(cacheKey, formatter);
  return formatter;
}

function parseDateString(date: string) {
  const match = DATE_ONLY_REGEX.exec(date);

  if (!match) {
    throw new Error(`Invalid date string: ${date}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function parseTimeString(time: string) {
  const match = TIME_ONLY_REGEX.exec(time);

  if (!match) {
    throw new Error(`Invalid time string: ${time}`);
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2])
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateString(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const resolved = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0
  };

  for (const part of parts) {
    if (part.type === "year") {
      resolved.year = Number(part.value);
    } else if (part.type === "month") {
      resolved.month = Number(part.value);
    } else if (part.type === "day") {
      resolved.day = Number(part.value);
    } else if (part.type === "hour") {
      resolved.hour = Number(part.value);
    } else if (part.type === "minute") {
      resolved.minute = Number(part.value);
    } else if (part.type === "second") {
      resolved.second = Number(part.value);
    }
  }

  return resolved;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );

  return asUtc - date.getTime();
}

export function shiftDateString(date: string, days: number) {
  const parsed = parseDateString(date);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));

  return formatDateString(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate()
  );
}

export function getTodayDateStringInTimeZone(timeZone: string, now: Date = new Date()) {
  const parts = getTimeZoneParts(now, timeZone);
  return formatDateString(parts.year, parts.month, parts.day);
}

export function getDateStringForInstantInTimeZone(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  return formatDateString(parts.year, parts.month, parts.day);
}

export function getUtcInstantForLocalTime(date: string, time: string, timeZone: string) {
  const parsedDate = parseDateString(date);
  const parsedTime = parseTimeString(time);
  const naiveUtc = Date.UTC(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    parsedTime.hours,
    parsedTime.minutes,
    0,
    0
  );

  let candidate = naiveUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = getTimeZoneOffsetMs(new Date(candidate), timeZone);
    const nextCandidate = naiveUtc - offset;

    if (nextCandidate === candidate) {
      break;
    }

    candidate = nextCandidate;
  }

  return new Date(candidate);
}

export function getDayWindowForDate(date: string, timeZone: string): DayWindow {
  const dayStartUtc = getUtcInstantForLocalTime(date, "00:00", timeZone);
  const dayEndUtc = getUtcInstantForLocalTime(shiftDateString(date, 1), "00:00", timeZone);

  return {
    date,
    timeZone,
    dayStartUtc,
    dayEndUtc
  };
}

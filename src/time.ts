import { DateTime, Duration } from 'luxon';
import { randomUUID } from 'node:crypto';

export const ID = () => randomUUID();

// parse "20.08.2025-10:00" -> DateTime in Europe/Berlin
export function parseEventDate(input: string): DateTime {
  const dt = DateTime.fromFormat(input.trim(), 'dd.MM.yyyy-HH:mm', {
    zone: 'Europe/Berlin',
  });
  return dt.isValid ? dt : DateTime.invalid('BadFormat');
}

// parse "12:00:00h", "12h", "36:00m", "00:30:00" -> Duration (ms)
export function parseInterval(input: string): Duration {
  const raw = input.trim().toLowerCase();

  const simple = raw.match(/^(\d+)\s*([hms])$/);
  if (simple) {
    // @ts-ignore
    const n = parseInt(simple[1], 10);
    const u = simple[2];
    return Duration.fromObject(
      u === 'h' ? { hours: n } : u === 'm' ? { minutes: n } : { seconds: n }
    );
  }

  const hhmmssH = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})h?$/);
  if (hhmmssH) {
    const [_, hh, mm, ss] = hhmmssH;
    // @ts-ignore
    return Duration.fromObject({ hours: +hh, minutes: +mm, seconds: +ss });
  }

  const hhmm = raw.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (hhmm) {
    const [_, h, m, s] = hhmm;
    // @ts-ignore
    return Duration.fromObject({ hours: +h, minutes: +m, seconds: s ? +s : 0 });
  }

  throw new Error(
    'Ungültiges Interval-Format. Beispiele: 12h, 30m, 45s, 12:00:00h, 01:30:00'
  );
}

export function computeInitialPlan(
  eventUtcMs: number,
  intervalMs: number,
  nowMs: number
) {
  if (eventUtcMs <= nowMs) return { remaining: 0, next: null as number | null };
  const diff = eventUtcMs - nowMs;
  const remaining = Math.floor(diff / intervalMs);
  if (remaining <= 0) return { remaining: 0, next: null as number | null };
  const next = eventUtcMs - remaining * intervalMs;
  return { remaining, next };
}

export function formatRelHours(ms: number) {
  const h = Math.round(ms / (60 * 60 * 1000));
  return `${h}h`;
}

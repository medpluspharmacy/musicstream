/** Day-of-week scheduling in the station's time zone. */

export const DEFAULT_DAY = 7;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The local date ("2026-11-18"), weekday, and when that local day began, for an instant. */
export function zoned(ms: number, tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", weekday: "short",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatters.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const y = Number(p.year), m = Number(p.month), d = Number(p.day);
  const wall = Date.UTC(y, m - 1, d, Number(p.hour), Number(p.minute), Number(p.second));
  const offset = wall - (ms - (((ms % 1000) + 1000) % 1000));
  return {
    key: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAY[p.weekday as string] ?? 0,
    dayStart: Date.UTC(y, m - 1, d) - offset,
  };
}

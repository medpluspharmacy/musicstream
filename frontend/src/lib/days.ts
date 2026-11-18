/** Days as the schedule stores them: 0 = Sunday ... 6 = Saturday, 7 = the default queue. */
export const DEFAULT_DAY = 7;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Display order: the default queue, then Monday to Sunday. */
export const DAY_ORDER = [DEFAULT_DAY, 1, 2, 3, 4, 5, 6, 0];
export const dayLabel = (d: number) => (d === DEFAULT_DAY ? "Default" : DAY_NAMES[d]);
export const shortDay = (d: number) => (d === DEFAULT_DAY ? "Default" : DAY_NAMES[d].slice(0, 3));

/** Common choices; any other zone the server accepts also works. */
export const TIMEZONES = [
  "Africa/Lagos", "Africa/Accra", "Africa/Johannesburg", "Africa/Nairobi", "Africa/Cairo",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "UTC",
];

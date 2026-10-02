/** YYYY-MM-DD in the user's local timezone. toISOString() is UTC and rolls the date over at 07:00 in UTC+7. */
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

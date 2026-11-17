// Study reminders without a server: an in-app banner when today has no study yet, and a daily calendar event (.ics)
// that the phone's own calendar app turns into a notification.
import { localDateKey } from "./date";
import { getSessions, getSessionsForDate } from "./sessions";
import { computeStreak } from "./streak";
import { getWordsForReview, getLearnedWords } from "./storage";

export const REMINDER_SNOOZE_KEY = "studyReminderSnoozedOn";

export interface StudyNudge {
  dueWords: number;
  streak: number;
}

/** Returns what to say when the learner has words saved, has finished no study session today, and it is past the reminder time. */
export function studyNudge(reminderTime: string, now = new Date()): StudyNudge | null {
  if (getLearnedWords().length === 0) return null;
  if (localStorage.getItem(REMINDER_SNOOZE_KEY) === localDateKey(now)) return null;
  const [h, m] = reminderTime.split(":").map(Number);
  if (Number.isFinite(h) && Number.isFinite(m) && now.getHours() * 60 + now.getMinutes() < h * 60 + m) return null;
  const studiedToday = getSessionsForDate(localDateKey(now)).some((s) => s.finishedAt);
  if (studiedToday) return null;
  return { dueWords: getWordsForReview().length, streak: computeStreak(getSessions(), now).currentStreak };
}

export function snoozeStudyNudge(now = new Date()): void {
  localStorage.setItem(REMINDER_SNOOZE_KEY, localDateKey(now));
}

const pad = (n: number) => String(n).padStart(2, "0");
const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** A daily repeating calendar event at `time` (local, floating time) starting tomorrow, with an alert at start. */
export function buildReminderIcs(time: string, appUrl: string, now = new Date()): string {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h || 20, m || 0);
  const local = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${pad(start.getHours())}${pad(start.getMinutes())}00`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const description = escapeText(`Mở English Study để ôn từ đến hạn và làm kế hoạch hôm nay: ${appUrl}`);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//English Study//Nhac hoc//VI",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:english-study-daily-reminder",
    `DTSTAMP:${stamp}`,
    `DTSTART:${local}`,
    "DURATION:PT15M",
    "RRULE:FREQ=DAILY",
    `SUMMARY:${escapeText("Học tiếng Anh")}`,
    `DESCRIPTION:${description}`,
    `URL:${appUrl}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:PT0M",
    `DESCRIPTION:${escapeText("Đến giờ học tiếng Anh")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

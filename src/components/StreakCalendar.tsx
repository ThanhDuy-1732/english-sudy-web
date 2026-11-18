"use client";

import type { CalendarDay } from "@/lib/stats";

const LEVEL_COLORS = ["bg-ink/10", "bg-primary/30", "bg-primary/60", "bg-primary"] as const;
const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function StreakCalendar({ data }: { data: CalendarDay[] }) {
  const firstDate = data[0] ? new Date(`${data[0].date}T12:00:00`) : null;
  const leadingEmptyDays = firstDate?.getDay() ?? 0;
  const cells: (CalendarDay | null)[] = [...Array.from({ length: leadingEmptyDays }, () => null), ...data];
  const weeks: (CalendarDay | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));

  return <section aria-labelledby="streak-calendar-title">
    <h2 id="streak-calendar-title" className="mb-3 text-base font-semibold text-ink">Lịch học tập</h2>
    <div className="overflow-x-auto pb-1" tabIndex={0} aria-label="Lịch đóng góp học tập">
      <div className="flex min-w-max gap-1">
        <div className="mr-1 flex flex-col gap-1"><div className="h-3 w-8" />{DAY_LABELS.map((label) => <div key={label} className="flex h-3 w-8 items-center text-[10px] text-muted">{label}</div>)}</div>
        {weeks.map((week, weekIndex) => {
          const firstDay = week.find((day): day is CalendarDay => day !== null);
          const monthLabel = weekIndex === 0 || firstDay?.date.slice(8) === "01" ? new Date(`${firstDay?.date}T12:00:00`).toLocaleDateString("vi-VN", { month: "short" }) : "";
          return <div key={`${firstDay?.date ?? weekIndex}`} className="flex flex-col gap-1"><div className="h-3 text-[10px] text-muted">{monthLabel}</div>{week.map((day, dayIndex) => day ? <div key={day.date} title={`${day.date}: ${day.count} từ`} aria-label={`${day.date}: ${day.count} từ`} className={`h-3 w-3 rounded-full ${LEVEL_COLORS[day.level]}`} /> : <div key={`empty-${weekIndex}-${dayIndex}`} className="h-3 w-3" aria-hidden="true" />)}</div>;
        })}
      </div>
    </div>
    <div className="mt-2 flex items-center gap-1 text-xs text-muted"><span>Ít</span>{LEVEL_COLORS.map((color, index) => <span key={index} aria-label={`Mức ${index}`} className={`h-3 w-3 rounded-full ${color}`} />)}<span>Nhiều</span></div>
  </section>;
}

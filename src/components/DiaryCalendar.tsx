"use client";

import type { CalendarDay } from "@/lib/stats";

const LEVEL_COLORS = [
  "bg-gray-100",
  "bg-primary-soft",
  "bg-primary-soft",
  "bg-primary",
] as const;

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface DiaryCalendarProps {
  data: CalendarDay[];
  studyTimeByDate: Record<string, number>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export default function DiaryCalendar({ data, studyTimeByDate, selectedDate, onSelectDate }: DiaryCalendarProps) {
  const firstDate = data[0] ? new Date(`${data[0].date}T12:00:00`) : null;
  const leadingEmptyDays = firstDate?.getDay() ?? 0;
  const cells: (CalendarDay | null)[] = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...data,
  ];
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <section aria-labelledby="diary-calendar-title">
      <h2 id="diary-calendar-title" className="mb-3 font-semibold text-gray-700">
        Lịch học tập
      </h2>
      <div className="overflow-x-auto pb-1" tabIndex={0} aria-label="Lịch nhật ký học tập">
        <div className="flex min-w-max gap-1">
          <div className="mr-1 flex flex-col gap-1">
            <div className="h-3 w-8" />
            {DAY_LABELS.map((label) => (
              <div key={label} className="flex h-3 w-8 items-center text-[10px] text-gray-500">
                {label}
              </div>
            ))}
          </div>
          {weeks.map((week, weekIndex) => {
            const firstDay = week.find((d): d is CalendarDay => d !== null);
            const monthLabel =
              weekIndex === 0 || firstDay?.date.slice(8) === "01"
                ? new Date(`${firstDay?.date}T12:00:00`).toLocaleDateString("vi-VN", { month: "short" })
                : "";
            return (
              <div key={firstDay?.date ?? weekIndex} className="flex flex-col gap-1">
                <div className="h-3 text-[10px] text-gray-500">{monthLabel}</div>
                {week.map((day, dayIndex) =>
                  day ? (
                    <button
                      data-dense
                      key={day.date}
                      type="button"
                      title={`${day.date}: ${day.count} từ · ${studyTimeByDate[day.date] ?? 0} phút`}
                      aria-label={`${day.date}: ${day.count} từ, ${studyTimeByDate[day.date] ?? 0} phút`}
                      onClick={() => onSelectDate(day.date)}
                      className={[
                        "h-3 w-3 rounded-sm transition-opacity hover:opacity-80",
                        LEVEL_COLORS[day.level],
                        selectedDate === day.date ? "ring-2 ring-primary ring-offset-1" : "",
                      ].join(" ")}
                    />
                  ) : (
                    <div key={`empty-${weekIndex}-${dayIndex}`} className="h-3 w-3" aria-hidden="true" />
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
        <span>Ít</span>
        {LEVEL_COLORS.map((color, i) => (
          <span key={i} aria-label={`Mức ${i}`} className={`h-3 w-3 rounded-sm ${color}`} />
        ))}
        <span>Nhiều</span>
      </div>
    </section>
  );
}

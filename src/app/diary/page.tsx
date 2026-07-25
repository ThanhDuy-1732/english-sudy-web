"use client";

import { useCallback, useEffect, useState } from "react";
import DiaryCalendar from "@/components/DiaryCalendar";
import DayDrawer from "@/components/DayDrawer";
import {
  getCalendarData,
  getStudyTimePerDay,
  getWordsForDate,
  type CalendarDay,
} from "@/lib/stats";
import type { LearnedWord } from "@/lib/storage";

export default function DiaryPage() {
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [studyTimeByDate, setStudyTimeByDate] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerWords, setDrawerWords] = useState<LearnedWord[]>([]);
  const [drawerMinutes, setDrawerMinutes] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setCalendarData(getCalendarData(26));
    const studyDays = getStudyTimePerDay(26 * 7);
    const byDate: Record<string, number> = {};
    for (const d of studyDays) byDate[d.date] = d.minutes;
    setStudyTimeByDate(byDate);
  }, []);

  const openDay = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setDrawerWords(getWordsForDate(date));
      setDrawerMinutes(studyTimeByDate[date] ?? 0);
      setIsDrawerOpen(true);
    },
    [studyTimeByDate]
  );

  function handleNavigate(date: string) {
    openDay(date);
  }

  function handleClose() {
    setIsDrawerOpen(false);
  }

  return (
    <main className="min-h-full min-w-0 bg-[#f7f4ff] px-4 py-10 text-[#2c1f4a] sm:px-6 lg:py-14">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">
            Nhật ký học tập
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Lộ trình học</h1>
          <p className="mt-2 text-sm text-[#6b6384]">
            Click vào một ngày để xem chi tiết hôm đó học gì.
          </p>
        </div>

        <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
          <DiaryCalendar
            data={calendarData}
            studyTimeByDate={studyTimeByDate}
            selectedDate={selectedDate}
            onSelectDate={openDay}
          />
        </section>
      </div>

      <DayDrawer
        date={selectedDate}
        words={drawerWords}
        studyMinutes={drawerMinutes}
        isOpen={isDrawerOpen}
        onClose={handleClose}
        onNavigate={handleNavigate}
      />
    </main>
  );
}

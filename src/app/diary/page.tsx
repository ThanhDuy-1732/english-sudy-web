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
    <main className="page-wide">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="mb-8">
          <h1 className="page-title">Nhật ký học</h1>
          <p className="page-lead">
            Chọn một ngày để xem hôm đó bạn học những từ nào và học bao lâu.
          </p>
        </div>

        <section className="panel p-5 sm:p-6">
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

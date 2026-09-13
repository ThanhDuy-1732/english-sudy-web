"use client";

import { useEffect, useState } from "react";
import StreakCalendar from "@/components/StreakCalendar";
import StudyTimeChart from "@/components/charts/StudyTimeChart";
import TopicDistributionChart from "@/components/charts/TopicDistributionChart";
import WordsPerDayChart from "@/components/charts/WordsPerDayChart";
import { useTimer } from "@/contexts/TimerContext";
import {
  getCalendarData,
  getStudyTimePerDay,
  getTopicDistribution,
  getWordsPerDay,
  type CalendarDay,
  type DailyStudyTime,
  type DailyWordCount,
} from "@/lib/stats";
import { getLearnedWords } from "@/lib/storage";
import { getAttempts } from "@/lib/exam/exam-storage";
import ExamAccuracyChart from "@/components/charts/ExamAccuracyChart";
import WeaknessRadar from "@/components/charts/WeaknessRadar";
import type { ExamAttempt } from "@/lib/exam/types";

export default function StatsPage() {
  const { todaySeconds } = useTimer();
  const [wordsPerDay, setWordsPerDay] = useState<DailyWordCount[]>([]);
  const [topicDistribution, setTopicDistribution] = useState<{ topic: string; count: number }[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [studyTimePerDay, setStudyTimePerDay] = useState<DailyStudyTime[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  const [averageMastery, setAverageMastery] = useState(0);

  useEffect(() => {
    const daily = getWordsPerDay(30);
    const learned = getLearnedWords();
    setWordsPerDay(daily);
    setTopicDistribution(getTopicDistribution());
    setCalendarData(getCalendarData(26));
    setStudyTimePerDay(getStudyTimePerDay(30));
    setExamAttempts(getAttempts());
    setTotalWords(learned.length);
    setActiveDays(daily.filter((day) => day.count > 0).length);
    setAverageMastery(
      learned.length
        ? Math.round((learned.reduce((total, word) => total + (word.mastery ?? 0), 0) / learned.length) * 10) / 10
        : 0
    );
  }, []);

  const todayMinutes = Math.round(todaySeconds / 60);

  return (
    <main className="min-h-full min-w-0 bg-[#f7f4ff] px-4 py-10 text-[#2c1f4a] sm:px-6 lg:py-14">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">Learning analytics</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Thống kê học tập</h1>
          <p className="mt-2 text-sm text-[#6b6384]">Theo dõi nhịp học, chủ đề và tiến bộ mastery của bạn.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-display text-3xl font-bold">{totalWords}</p>
            <p className="mt-1 text-sm text-[#6b6384]">Từ đã học</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-display text-3xl font-bold">{activeDays}</p>
            <p className="mt-1 text-sm text-[#6b6384]">Ngày học trong 30 ngày</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-display text-3xl font-bold">{averageMastery}/5</p>
            <p className="mt-1 text-sm text-[#6b6384]">Mastery trung bình</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="font-display text-3xl font-bold">{todayMinutes} phút</p>
            <p className="mt-1 text-sm text-[#6b6384]">Hôm nay</p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="min-w-0 overflow-hidden rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
            <WordsPerDayChart data={wordsPerDay} />
          </section>
          <section className="min-w-0 overflow-hidden rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
            <StudyTimeChart data={studyTimePerDay} />
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
              <TopicDistributionChart data={topicDistribution} />
            </section>
            <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="mb-3 font-semibold text-gray-700">Tóm tắt theo chủ đề</h2>
              {topicDistribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Chưa có dữ liệu</p>
              ) : (
                <ul className="space-y-3">
                  {topicDistribution.map((item) => (
                    <li key={item.topic} className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm last:border-0">
                      <span className="text-gray-600">{item.topic}</span>
                      <span className="font-semibold text-[#2c1f4a]">{item.count} từ</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
            <StreakCalendar data={calendarData} />
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
              <ExamAccuracyChart attempts={examAttempts} />
            </section>
            <section className="rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
              <WeaknessRadar attempts={examAttempts} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

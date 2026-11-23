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
import { getSessions } from "@/lib/sessions";
import { computeWeeklyReport } from "@/lib/weekly-report";
import { computeStreak } from "@/lib/streak";
import ExamAccuracyChart from "@/components/charts/ExamAccuracyChart";
import WeaknessRadar from "@/components/charts/WeaknessRadar";
import BandTimelineChart from "@/components/charts/BandTimelineChart";
import SkillRadar from "@/components/charts/SkillRadar";
import { weeklyBands, skillRadar, type WeeklyBand, type SkillRadarPoint } from "@/lib/stats-skills";
import type { ExamAttempt } from "@/lib/exam/types";
import Segmented from "@/components/Segmented";
import StageCensus from "@/components/StageCensus";
import { topicLabel } from "@/lib/topics";
import { LANG_INFO, LEARN_LANGS, langOf, type LearnLang } from "@/lib/languages";

const PANEL = "panel min-w-0 overflow-hidden p-5 sm:p-6";

/** One row of figures separated by rules, instead of a grid of identical stat cards. */
function Figures({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-3xl border border-rule bg-card sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {items.map(([value, label]) => (
        <div key={label} className="border-rule p-4 [&:not(:last-child)]:border-b sm:border-b-0 sm:[&:not(:last-child)]:border-r sm:p-5">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function StatsPage() {
  const { todaySeconds } = useTimer();
  const [activeTab, setActiveTab] = useState<"overview" | "weekly">("overview");
  const [wordsPerDay, setWordsPerDay] = useState<DailyWordCount[]>([]);
  const [topicDistribution, setTopicDistribution] = useState<{ topic: string; count: number }[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [studyTimePerDay, setStudyTimePerDay] = useState<DailyStudyTime[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [bands, setBands] = useState<WeeklyBand[]>([]);
  const [radarData, setRadarData] = useState<SkillRadarPoint[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  // Each saved word's stage and language, so the census and word count can follow the language filter.
  const [learnedMeta, setLearnedMeta] = useState<{ mastery?: number; lang: LearnLang }[]>([]);
  const [langFilter, setLangFilter] = useState<"all" | LearnLang>("all");
  const [weeklyReport, setWeeklyReport] = useState(() => computeWeeklyReport([], []));
  const [streakInfo, setStreakInfo] = useState(() => computeStreak([]));
  // Server HTML has no localStorage: show nothing rather than "0 từ" until the saved data is read.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const daily = getWordsPerDay(30);
    const learned = getLearnedWords();
    setLearnedMeta(learned.map((w) => ({ mastery: w.mastery, lang: langOf(w) })));
    setWordsPerDay(daily);
    setTopicDistribution(getTopicDistribution());
    setCalendarData(getCalendarData(26));
    setStudyTimePerDay(getStudyTimePerDay(30));
    const attempts = getAttempts();
    const allSessions = getSessions();
    setExamAttempts(attempts);
    setBands(weeklyBands(12));
    setRadarData(skillRadar());
    setWeeklyReport(computeWeeklyReport(allSessions, attempts));
    setStreakInfo(computeStreak(allSessions));
    setTotalWords(learned.length);
    setActiveDays(daily.filter((day) => day.count > 0).length);
    setLoaded(true);
  }, []);

  const todayMinutes = Math.round(todaySeconds / 60);

  const presentLangs = LEARN_LANGS.filter((lang) => learnedMeta.some((item) => item.lang === lang));
  const shownMeta = learnedMeta.filter((item) => langFilter === "all" || item.lang === langFilter);
  const averageMastery = shownMeta.length
    ? Math.round((shownMeta.reduce((total, item) => total + (item.mastery ?? 0), 0) / shownMeta.length) * 10) / 10
    : 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-8 lg:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Thống kê học tập</h1>
      <p className="page-lead">Nhịp học, chủ đề đã học và tiến bộ ở từng kỹ năng.</p>

      <div className="mt-6">
        <Segmented label="Khoảng thời gian" value={activeTab} onChange={setActiveTab}
          options={[{ value: "overview", label: "Tổng quan" }, { value: "weekly", label: "Tuần này" }]} />
      </div>

      {!loaded && <p className="mt-6 text-sm text-muted" role="status">Đang tải thống kê…</p>}

      {loaded && activeTab === "weekly" && (
        <div className="mt-6 space-y-6">
          <Figures items={[
            [String(streakInfo.currentStreak), "Chuỗi ngày học"],
            [`${streakInfo.activeDaysThisWeek}/7`, "Ngày học tuần này"],
            [`${weeklyReport.studyMinutes} phút`, "Thời gian học"],
            [String(weeklyReport.sessions), "Phiên học"],
            [String(weeklyReport.wordsLearned), "Từ mới"],
            [weeklyReport.examAccuracy !== null ? `${weeklyReport.examAccuracy}%` : "–", "Đúng khi luyện thi"],
          ]} />
          {weeklyReport.srsAccuracy !== null && (
            <section className={PANEL}>
              <h2 className="text-base font-semibold text-ink">Nhớ từ khi ôn tập</h2>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-rule">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${weeklyReport.srsAccuracy}%` }} />
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">{weeklyReport.srsAccuracy}%</span>
              </div>
            </section>
          )}
        </div>
      )}

      {loaded && activeTab === "overview" && (
        <div className="mt-6 space-y-6">
          {presentLangs.length > 1 && (
            <Segmented
              label="Ngôn ngữ"
              value={langFilter}
              onChange={(value) => setLangFilter(value as "all" | LearnLang)}
              options={[{ value: "all", label: "Tất cả" }, ...presentLangs.map((lang) => ({ value: lang, label: LANG_INFO[lang].native }))]}
            />
          )}
          <Figures items={[
            [String(langFilter === "all" ? totalWords : shownMeta.length), "Từ đã học"],
            [String(activeDays), "Ngày học trong 30 ngày"],
            [`${averageMastery}/5`, "Mastery trung bình"],
            [`${todayMinutes} phút`, "Hôm nay"],
          ]} />
          <section aria-labelledby="garden-census" className="rounded-3xl bg-gradient-to-b from-primary-soft/40 to-primary-soft px-4 pb-4 pt-5 sm:px-6">
            <h2 id="garden-census" className="section-title">Vườn theo giai đoạn</h2>
            <p className="mb-3 text-sm text-muted">Mỗi lần ôn đúng hạn, từ lớn thêm một bậc từ hạt đến hoa.</p>
            <StageCensus masteries={shownMeta.map((item) => item.mastery)} />
          </section>
          <section className={PANEL}><WordsPerDayChart data={wordsPerDay} /></section>
          <section className={PANEL}><StudyTimeChart data={studyTimePerDay} /></section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={PANEL}><TopicDistributionChart data={topicDistribution.map((item) => ({ ...item, topic: topicLabel(item.topic) }))} /></section>
            <section className={PANEL}>
              <h2 className="text-base font-semibold text-ink">Tóm tắt theo chủ đề</h2>
              {topicDistribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">Chưa có từ nào. Lưu từ ở trang Từ mới để thấy thống kê.</p>
              ) : (
                <ul className="mt-3 divide-y divide-rule">
                  {topicDistribution.map((item) => (
                    <li key={item.topic} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-ink">{topicLabel(item.topic)}</span>
                      <span className="tabular-nums text-muted">{item.count} từ</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className={PANEL}><StreakCalendar data={calendarData} /></section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={PANEL}>
              <h2 className="mb-3 text-base font-semibold text-ink">Band theo tuần, 12 tuần gần nhất</h2>
              <BandTimelineChart data={bands} />
            </section>
            <section className={PANEL}>
              <h2 className="mb-3 text-base font-semibold text-ink">4 kỹ năng</h2>
              <SkillRadar data={radarData} />
            </section>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={PANEL}><ExamAccuracyChart attempts={examAttempts} /></section>
            <section className={PANEL}><WeaknessRadar attempts={examAttempts} /></section>
          </div>
        </div>
      )}
    </main>
  );
}

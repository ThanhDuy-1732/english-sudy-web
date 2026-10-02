"use client";

import Link from "next/link";

const TASKS = [
  {
    id: "task2-opinion",
    kind: "ielts_task2",
    title: "IELTS Task 2 – Opinion Essay",
    desc: "250 từ · 40 phút · Agree/Disagree",
    emoji: "📝",
  },
  {
    id: "task2-discuss",
    kind: "ielts_task2",
    title: "IELTS Task 2 – Discussion Essay",
    desc: "250 từ · 40 phút · Discuss both views",
    emoji: "⚖️",
  },
  {
    id: "task1-line",
    kind: "ielts_task1",
    title: "IELTS Task 1 – Line Chart",
    desc: "150 từ · 20 phút · Mô tả biểu đồ",
    emoji: "📈",
  },
  {
    id: "task1-bar",
    kind: "ielts_task1",
    title: "IELTS Task 1 – Bar Chart",
    desc: "150 từ · 20 phút · So sánh dữ liệu",
    emoji: "📊",
  },
  {
    id: "toeic-email",
    kind: "toeic_email",
    title: "TOEIC Writing – Business Email",
    desc: "100-150 từ · 10 phút",
    emoji: "📧",
  },
];

export default function WritePage() {
  return (
    <div className="write-page">
      <h1>Luyện viết</h1>
      <p className="subtitle">Chọn dạng bài để bắt đầu. AI sẽ chấm theo 4 tiêu chí và đưa bài mẫu.</p>

      <div className="tasks-list">
        {TASKS.map((t) => (
          <Link key={t.id} href={`/write/task/${t.id}`} className="task-card">
            <span className="emoji">{t.emoji}</span>
            <div className="task-info">
              <p className="title">{t.title}</p>
              <p className="desc">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <style jsx>{`
        .write-page { max-width: 640px; margin: 0 auto; padding: 1.5rem; }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
        .subtitle { color: #6c757d; font-size: 0.9rem; margin-bottom: 1.5rem; }
        .tasks-list { display: flex; flex-direction: column; gap: 0.75rem; }
        :global(.task-card) { display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1.5px solid #dee2e6; border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
        :global(.task-card):hover { border-color: #0d6efd; background: rgba(13, 110, 253, 0.18); }
        .emoji { font-size: 1.5rem; flex-shrink: 0; }
        .title { font-weight: 600; font-size: 0.95rem; margin: 0 0 0.2rem; }
        .desc { font-size: 0.8rem; color: #6c757d; margin: 0; }
      `}</style>
    </div>
  );
}

"use client";

import Link from "next/link";

const SCENARIOS = [
  { id: "hotel", title: "Đặt phòng khách sạn", level: 2, emoji: "🏨" },
  { id: "interview", title: "Phỏng vấn xin việc", level: 3, emoji: "💼" },
  { id: "complaint", title: "Khiếu nại dịch vụ", level: 3, emoji: "📞" },
  { id: "restaurant", title: "Đặt bàn nhà hàng", level: 1, emoji: "🍽️" },
  { id: "doctor", title: "Khám bệnh", level: 2, emoji: "🏥" },
  { id: "shopping", title: "Mua sắm / Trả hàng", level: 1, emoji: "🛍️" },
];

const IELTS_PARTS = [
  { part: "p1", title: "IELTS Speaking Part 1", desc: "Câu hỏi về bản thân, 4-5 phút", emoji: "🎯" },
  { part: "p2", title: "IELTS Speaking Part 2", desc: "Cue card, 1 phút chuẩn bị + 2 phút nói", emoji: "📋" },
  { part: "p3", title: "IELTS Speaking Part 3", desc: "Thảo luận chủ đề, 4-5 phút", emoji: "💬" },
];

export default function SpeakPage() {
  return (
    <div className="speak-page">
      <h1>Luyện nói</h1>

      <section>
        <h2>Giao tiếp hàng ngày</h2>
        <div className="scenarios-grid">
          {SCENARIOS.map((s) => (
            <Link key={s.id} href={`/speak/roleplay/${s.id}`} className="scenario-card">
              <span className="emoji">{s.emoji}</span>
              <span className="title">{s.title}</span>
              <span className="level">Lv.{s.level}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2>IELTS Speaking</h2>
        <div className="ielts-list">
          {IELTS_PARTS.map((p) => (
            <Link key={p.part} href={`/speak/ielts/${p.part}`} className="ielts-card">
              <span className="emoji">{p.emoji}</span>
              <div>
                <p className="title">{p.title}</p>
                <p className="desc">{p.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2>Công cụ</h2>
        <div className="tools-list">
          <Link href="/speak/shadowing" className="tool-card">
            <span className="emoji">🎯</span>
            <div>
              <p className="title">Shadowing</p>
              <p className="desc">Nghe và lặp lại câu mẫu để luyện phát âm</p>
            </div>
          </Link>
          <Link href="/speak/history" className="tool-card">
            <span className="emoji">📋</span>
            <div>
              <p className="title">Lịch sử</p>
              <p className="desc">Xem lại các bài nói và điểm số</p>
            </div>
          </Link>
        </div>
      </section>

      <style jsx>{`
        .speak-page { max-width: 640px; margin: 0 auto; padding: 1.5rem; }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; }
        h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #6c757d; margin: 1.5rem 0 0.75rem; }
        .scenarios-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .scenario-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; border: 1.5px solid #dee2e6; border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
        .scenario-card:hover { border-color: #0d6efd; background: #e8f0fe; }
        .emoji { font-size: 1.25rem; }
        .title { flex: 1; font-size: 0.875rem; line-height: 1.3; }
        .level { font-size: 0.75rem; color: #6c757d; }
        .ielts-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .ielts-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1.5px solid #dee2e6; border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
        .ielts-card:hover { border-color: #0d6efd; background: #e8f0fe; }
        .ielts-card .emoji { font-size: 1.5rem; }
        .ielts-card .title { font-weight: 600; margin-bottom: 0.2rem; font-size: 0.95rem; }
        .ielts-card .desc { font-size: 0.8rem; color: #6c757d; }
        .tools-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .tool-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1.5px solid #dee2e6; border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
        .tool-card:hover { border-color: #0d6efd; background: #e8f0fe; }
        .tool-card .emoji { font-size: 1.5rem; }
        .tool-card .title { font-weight: 600; margin-bottom: 0.2rem; font-size: 0.95rem; }
        .tool-card .desc { font-size: 0.8rem; color: #6c757d; }
        @media (max-width: 480px) { .scenarios-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

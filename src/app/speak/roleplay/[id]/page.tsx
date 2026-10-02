"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Scenario, ConversationTurn } from "@/lib/speech/types";
import { saveLearnedWord } from "@/lib/storage";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import { saveSpeaking } from "@/lib/speech/speaking-storage";

const SCENARIOS: Record<string, Scenario> = {
  hotel: {
    id: "hotel",
    title: "Đặt phòng khách sạn",
    level: 2,
    aiRole: "hotel receptionist",
    userRole: "guest checking in",
    goal: "check in early and request a late checkout",
    mustUse: ["I was wondering if", "Is it possible to", "I'd appreciate"],
    maxTurns: 10,
  },
  interview: {
    id: "interview",
    title: "Phỏng vấn xin việc",
    level: 3,
    aiRole: "hiring manager at a tech company",
    userRole: "job applicant for a software developer role",
    goal: "convince the interviewer you are qualified and ask about remote work",
    mustUse: ["My experience includes", "I have demonstrated", "Could you tell me"],
    maxTurns: 12,
  },
  complaint: {
    id: "complaint",
    title: "Khiếu nại dịch vụ",
    level: 3,
    aiRole: "customer service representative",
    userRole: "frustrated customer",
    goal: "get a refund or replacement for a broken product",
    mustUse: ["I'd like to report", "This is unacceptable", "I expect"],
    maxTurns: 10,
  },
  restaurant: {
    id: "restaurant",
    title: "Đặt bàn nhà hàng",
    level: 1,
    aiRole: "restaurant host",
    userRole: "customer making a reservation",
    goal: "book a table for 4 people this Saturday evening and mention a dietary restriction",
    mustUse: ["I'd like to reserve", "One of our guests is"],
    maxTurns: 8,
  },
  doctor: {
    id: "doctor",
    title: "Khám bệnh",
    level: 2,
    aiRole: "general practitioner doctor",
    userRole: "patient with symptoms",
    goal: "describe your symptoms clearly and understand the treatment plan",
    mustUse: ["I've been experiencing", "How long should I"],
    maxTurns: 10,
  },
  shopping: {
    id: "shopping",
    title: "Mua sắm / Trả hàng",
    level: 1,
    aiRole: "store assistant",
    userRole: "customer returning a purchase",
    goal: "return a product and get a refund or exchange",
    mustUse: ["I'd like to return", "Do you have a"],
    maxTurns: 8,
  },
};

export default function RoleplayPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const scenario = SCENARIOS[id];

  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [goalAchieved, setGoalAchieved] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (scenario && !sessionIdRef.current) {
      sessionIdRef.current = startSession("speaking", { mode: "roleplay", scenarioId: id });
    }
    return () => {
      if (sessionIdRef.current) {
        cancelSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [id, scenario]);

  if (!scenario) {
    return <div className="error">Scenario not found</div>;
  }

  function endSession() {
    if (sessionIdRef.current) {
      finishSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
    saveSpeaking({
      id: crypto.randomUUID(),
      mode: "roleplay",
      prompt: scenario?.goal ?? id,
      transcript: turns.map((t) => `${t.role}: ${t.text}`).join("\n"),
      durationSec: turns.length * 30,
      feedback: {
        transcript: "",
        durationSec: turns.length * 30,
        wordsPerMinute: 0,
        fillerCount: 0,
        bands: { fluency: 0, lexical: 0, grammar: 0, pronunciation: null },
        overall: 0,
        strengths: [],
        improvements: [],
        upgradedVersion: "",
        newVocabulary: [],
      },
      createdAt: new Date().toISOString(),
    });
    setDone(true);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");

    const newTurns: ConversationTurn[] = [...turns, { role: "user", text: userText }];
    setTurns(newTurns);
    setLoading(true);

    try {
      const res = await fetch("/api/speak/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, history: turns, userText }),
      });
      const data = await res.json();

      setTurns([
        ...newTurns,
        {
          role: "ai",
          text: data.reply,
          correction: data.correction ?? null,
        },
      ]);

      if (data.goalAchieved) setGoalAchieved(true);

      // Auto-done after maxTurns
      if (newTurns.length >= scenario.maxTurns * 2) {
        endSession();
      }

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      setTurns([
        ...newTurns,
        { role: "ai", text: "(Lỗi kết nối, thử lại.)" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const corrections = turns
    .filter((t) => t.correction)
    .map((t) => t.correction!);

  if (done) {
    return (
      <div className="session-report">
        <h1>Kết thúc phiên</h1>
        <p className="goal-status">{goalAchieved ? "✅ Đã đạt mục tiêu!" : "⚠️ Chưa đạt mục tiêu."}</p>
        <p className="goal">{scenario.goal}</p>

        {corrections.length > 0 && (
          <section>
            <h2>Lỗi ngữ pháp / từ vựng</h2>
            <div className="corrections">
              {corrections.map((c, i) => (
                <div key={i} className="correction-item">
                  <p className="wrong">✗ {c.original}</p>
                  <p className="right">✓ {c.fixed}</p>
                  <p className="note">{c.note}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="report-actions">
          <button onClick={() => router.push(`/speak/roleplay/${id}`)}>
            Thử lại
          </button>
          <button onClick={() => router.push("/speak")}>
            Chọn scenario khác
          </button>
        </div>

        <style jsx>{`
          .session-report { max-width: 640px; margin: 2rem auto; padding: 1.5rem; }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
          h2 { font-size: 1rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
          .goal-status { font-size: 1.1rem; font-weight: 600; }
          .goal { color: #6c757d; font-size: 0.9rem; margin-bottom: 1rem; }
          .corrections { display: flex; flex-direction: column; gap: 0.75rem; }
          .correction-item { color: #212529; padding: 0.75rem; background: #f8f9fa; border-radius: 8px; }
          .wrong { color: #dc3545; margin: 0; }
          .right { color: #198754; margin: 0.25rem 0 0; }
          .note { color: #6c757d; font-size: 0.8rem; margin: 0.25rem 0 0; }
          .report-actions { display: flex; gap: 0.75rem; margin-top: 2rem; flex-wrap: wrap; }
          .report-actions button { color: #212529; padding: 0.6rem 1.25rem; border-radius: 8px; border: 1.5px solid #dee2e6; background: white; cursor: pointer; }
          .report-actions button:first-child { background: #0d6efd; color: white; border-color: #0d6efd; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="roleplay-page">
      <div className="roleplay-header">
        <button onClick={() => router.push("/speak")} className="back-btn">← Speak</button>
        <div className="scenario-info">
          <strong>{scenario.title}</strong>
          <span className="goal-hint">Mục tiêu: {scenario.goal}</span>
        </div>
        {goalAchieved && <span className="goal-badge">✅ Đạt</span>}
      </div>

      <div className="chat-area">
        {turns.length === 0 && (
          <div className="intro-message">
            <p>Bạn đang đóng vai: <strong>{scenario.userRole}</strong></p>
            <p>AI đóng vai: <strong>{scenario.aiRole}</strong></p>
            <p>Bắt đầu hội thoại bằng cách nhập tin nhắn bên dưới.</p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`turn ${t.role}`}>
            <div className="bubble">
              <p>{t.text}</p>
              {t.correction && (
                <button
                  className="correction-chip"
                  onClick={() => alert(`✗ ${t.correction!.original}\n✓ ${t.correction!.fixed}\n${t.correction!.note}`)}
                >
                  🔧 Xem sửa lỗi
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="turn ai">
            <div className="bubble loading">…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Nhập tin nhắn (Enter để gửi)"
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Gửi
        </button>
        <button onClick={endSession} className="end-btn">
          Kết thúc
        </button>
      </div>

      <style jsx>{`
        .roleplay-page { display: flex; flex-direction: column; height: 100vh; max-height: 100vh; overflow: hidden; }
        .roleplay-header { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid #dee2e6; flex-shrink: 0; }
        .back-btn { background: none; border: none; cursor: pointer; color: #6c757d; font-size: 0.875rem; white-space: nowrap; }
        .scenario-info { flex: 1; }
        .scenario-info strong { display: block; font-size: 0.95rem; }
        .goal-hint { font-size: 0.75rem; color: #6c757d; }
        .goal-badge { background: #d1e7dd; color: #0a3622; border-radius: 10px; padding: 0.15rem 0.6rem; font-size: 0.8rem; white-space: nowrap; }
        .chat-area { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .intro-message { text-align: center; color: #6c757d; padding: 2rem; background: #f8f9fa; border-radius: 10px; font-size: 0.875rem; }
        .intro-message p { margin: 0.35rem 0; }
        .turn { display: flex; }
        .turn.user { justify-content: flex-end; }
        .turn.ai { justify-content: flex-start; }
        .bubble { max-width: 70%; padding: 0.75rem 1rem; border-radius: 12px; font-size: 0.9rem; line-height: 1.5; }
        .turn.user .bubble { background: #0d6efd; color: white; border-bottom-right-radius: 4px; }
        .turn.ai .bubble { background: #f1f3f5; color: #212529; border-bottom-left-radius: 4px; }
        .bubble p { margin: 0; }
        .bubble.loading { color: #adb5bd; font-style: italic; }
        .correction-chip { display: block; margin-top: 0.35rem; background: none; border: none; color: rgba(255,255,255,0.7); font-size: 0.75rem; cursor: pointer; padding: 0; text-decoration: underline; }
        .input-area { display: flex; gap: 0.5rem; padding: 0.75rem 1rem; border-top: 1px solid #dee2e6; flex-shrink: 0; }
        .input-area input { flex: 1; padding: 0.6rem 0.9rem; border: 1.5px solid #dee2e6; border-radius: 20px; font-size: 0.9rem; }
        .input-area button { padding: 0.6rem 1.1rem; border-radius: 20px; border: none; background: #0d6efd; color: white; cursor: pointer; font-size: 0.875rem; }
        .input-area button:disabled { background: #adb5bd; cursor: not-allowed; }
        .end-btn { background: #f8f9fa !important; color: #6c757d !important; border: 1.5px solid #dee2e6 !important; }
        .end-btn:hover { background: #e9ecef !important; }
        .error { padding: 2rem; text-align: center; }
      `}</style>
    </div>
  );
}

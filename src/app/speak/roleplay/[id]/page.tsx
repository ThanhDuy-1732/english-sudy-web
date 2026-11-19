"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Scenario, ConversationTurn } from "@/lib/speech/types";
import { saveLearnedWord } from "@/lib/storage";
import { startSession, finishSession, cancelSession } from "@/lib/sessions";
import { saveSpeaking } from "@/lib/speech/speaking-storage";
import { LANG_INFO, languagePhrase, type LearnLang } from "@/lib/languages";
import { useLearningLanguages } from "@/lib/useLearningLanguages";
import Segmented from "@/components/Segmented";

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

export default function RoleplayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const scenario = SCENARIOS[id];

  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  // The conversation's language is chosen before the first message and then stays fixed.
  const [learning] = useLearningLanguages();
  const [chosenLang, setChosenLang] = useState<LearnLang | null>(null);
  const lang: LearnLang = chosenLang && learning.includes(chosenLang) ? chosenLang : learning.includes("en") ? "en" : learning[0];
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
      ...(lang === "en" ? {} : { lang }),
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
        body: JSON.stringify({ scenario, history: turns, userText, ...(lang === "en" ? {} : { lang }) }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.reply !== "string") throw new Error("roleplay failed");

      setTurns([
        ...newTurns,
        {
          role: "ai",
          text: data.reply,
          ...(typeof data.reading === "string" && data.reading ? { reading: data.reading } : {}),
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
        <p className="goal-status">{goalAchieved ? "Đã đạt mục tiêu hội thoại." : "Chưa đạt mục tiêu hội thoại."}</p>
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
          h1 { color: rgb(var(--ink)); letter-spacing: -0.015em; font-weight: 600; font-size: 1.625rem; margin-bottom: 0.5rem; }
          h2 { font-weight: 600; font-size: 1rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
          .goal-status { font-size: 1.1rem; font-weight: 600; }
          .goal { color: rgb(var(--muted)); font-size: 0.9rem; margin-bottom: 1rem; }
          .corrections { display: flex; flex-direction: column; gap: 0.75rem; }
          .correction-item { color: rgb(var(--ink)); padding: 0.75rem; background: rgb(var(--paper)); border-radius: 1rem; }
          .wrong { color: rgb(var(--margin)); margin: 0; }
          .right { color: rgb(var(--ok)); margin: 0.25rem 0 0; }
          .note { color: rgb(var(--muted)); font-size: 0.8rem; margin: 0.25rem 0 0; }
          .report-actions { display: flex; gap: 0.75rem; margin-top: 2rem; flex-wrap: wrap; }
          .report-actions button { color: rgb(var(--ink)); padding: 0.6rem 1.25rem; border-radius: 999px; min-height: 44px; border: 1.5px solid rgb(var(--rule)); background: rgb(var(--card)); cursor: pointer; }
          .report-actions button:first-child { background: rgb(var(--primary)); color: white; border-color: rgb(var(--primary)); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="roleplay-page">
      <div className="roleplay-header">
        <button onClick={() => router.push("/speak")} className="back-btn">← Luyện nói</button>
        <div className="scenario-info">
          <strong>{scenario.title}</strong>
          <span className="goal-hint">Mục tiêu: {scenario.goal}</span>
          {goalAchieved && <span className="goal-badge">Đã đạt mục tiêu</span>}
        </div>
        <button onClick={endSession} className="end-btn">
          Kết thúc
        </button>
      </div>

      <div className="chat-area">
        {turns.length === 0 && learning.length > 1 && (
          <div className="lang-choice">
            <Segmented
              label="Ngôn ngữ"
              value={lang}
              onChange={(value) => setChosenLang(value as LearnLang)}
              options={learning.map((code) => ({ value: code, label: LANG_INFO[code].native }))}
            />
          </div>
        )}
        {turns.length === 0 && (
          <div className="intro-message postcard">
            <p>Bạn đang đóng vai: <strong>{scenario.userRole}</strong></p>
            <p>AI đóng vai: <strong>{scenario.aiRole}</strong></p>
            <p>Bắt đầu hội thoại bằng cách nhập tin nhắn bên dưới.</p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`turn ${t.role}`}>
            <div className="bubble">
              <p lang={LANG_INFO[lang].htmlLang}>{t.text}</p>
              {t.reading && <p className="reading-line">{t.reading}</p>}
              {t.correction && (
                <details className="correction">
                  <summary>Xem sửa lỗi</summary>
                  <p className="fix-line"><span aria-hidden="true">✗ </span><span className="sr-only">Câu của bạn: </span><s>{t.correction.original}</s></p>
                  <p className="fix-line"><span aria-hidden="true">✓ </span><span className="sr-only">Nên viết: </span><strong>{t.correction.fixed}</strong></p>
                  {t.correction.note && <p className="fix-note">{t.correction.note}</p>}
                </details>
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
          placeholder={lang === "en" ? "Nhập tin nhắn (Enter để gửi)" : `Nhập tin nhắn bằng ${languagePhrase(lang)} (Enter để gửi)`}
          lang={LANG_INFO[lang].htmlLang}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Gửi
        </button>
      </div>

      <style jsx>{`
        /* The page scrolls; the message box sticks to the bottom, above the phone tab bar (4.5rem) or at the bottom on desktop. */
        .roleplay-page { display: flex; flex-direction: column; max-width: 48rem; margin: 0 auto; min-height: calc(100dvh - 10.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
        @media (min-width: 1024px) { .roleplay-page { min-height: 100dvh; } }
        .roleplay-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem 0.75rem; border-bottom: 1px solid rgb(var(--rule)); flex-shrink: 0; }
        .end-btn { flex-shrink: 0; min-height: 40px; padding: 0.4rem 0.9rem; border-radius: 999px; border: 1.5px solid rgb(var(--rule)); background: rgb(var(--card)); color: rgb(var(--ink)); font-size: 0.85rem; cursor: pointer; white-space: nowrap; }
        .end-btn:hover { border-color: rgb(var(--primary)); }
        .back-btn { background: none; border: none; cursor: pointer; color: rgb(var(--muted)); font-size: 0.875rem; white-space: nowrap; }
        .scenario-info { flex: 1; }
        .scenario-info { min-width: 0; }
        .scenario-info strong { display: block; font-size: 1.05rem; color: rgb(var(--ink)); }
        .goal-hint { display: block; font-size: 0.8rem; line-height: 1.4; color: rgb(var(--muted)); }
        .goal-badge { display: inline-block; margin-top: 0.35rem; background: rgb(var(--ok-soft)); color: rgb(var(--ink)); border-radius: 1.5rem; padding: 0.15rem 0.6rem; font-size: 0.8rem; white-space: nowrap; }
        .chat-area { flex: 1; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .intro-message { text-align: center; padding: 1.5rem; font-size: 0.9rem; }
        .intro-message p { margin: 0.35rem 0; }
        .turn { display: flex; }
        .turn.user { justify-content: flex-end; }
        .turn.ai { justify-content: flex-start; }
        .bubble { max-width: 80%; padding: 0.75rem 1rem; border-radius: 1.5rem; font-size: 0.9rem; line-height: 1.5; }
        .turn.user .bubble { background: rgb(var(--primary)); color: white; border-bottom-right-radius: 4px; }
        .turn.ai .bubble { background: rgb(var(--rule)); color: rgb(var(--ink)); border-bottom-left-radius: 4px; }
        .bubble p { margin: 0; }
        .reading-line { margin-top: 0.25rem !important; font-size: 0.8rem; opacity: 0.8; }
        .lang-choice { display: flex; justify-content: center; }
        .bubble.loading { color: rgb(var(--muted)); font-style: italic; }
        .correction { margin-top: 0.5rem; }
        .correction summary { display: inline-flex; align-items: center; min-height: 32px; cursor: pointer; color: rgb(var(--primary-text)); font-size: 0.8rem; font-weight: 600; text-decoration: underline; list-style: none; }
        .correction summary::-webkit-details-marker { display: none; }
        .correction[open] summary { text-decoration: none; }
        .fix-line, .fix-note { margin: 0.35rem 0 0; padding: 0.4rem 0.6rem; border-radius: 1rem; background: rgb(var(--card)); font-size: 0.85rem; }
        .fix-line s { color: rgb(var(--margin)); }
        .fix-line strong { color: rgb(var(--ok)); }
        .fix-note { background: none; padding: 0.25rem 0 0; color: rgb(var(--muted)); }
        .input-area { position: sticky; bottom: calc(5.75rem + env(safe-area-inset-bottom)); z-index: 10; display: flex; gap: 0.5rem; padding: 0.75rem 1rem; border-top: 1px solid rgb(var(--rule)); background: rgb(var(--paper)); flex-shrink: 0; }
        @media (min-width: 1024px) { .input-area { bottom: 0; } }
        .input-area input { flex: 1; min-width: 0; min-height: 44px; background: rgb(var(--card)); color: rgb(var(--ink)); padding: 0.6rem 0.9rem; border: 1.5px solid rgb(var(--rule)); border-radius: 1.5rem; font-size: 0.9rem; }
        .input-area button { padding: 0.6rem 1.1rem; border-radius: 999px; min-height: 44px; border: none; background: rgb(var(--primary)); color: white; cursor: pointer; font-size: 0.875rem; }
        .input-area button:disabled { background: rgb(var(--muted)); cursor: not-allowed; }
        .error { padding: 2rem; text-align: center; }
      `}</style>
    </div>
  );
}

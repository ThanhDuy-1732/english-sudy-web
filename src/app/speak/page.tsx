import LinkList from "@/components/LinkList";

const LEVEL = ["", "Cơ bản", "Trung bình", "Khá"];

const SCENARIOS = [
  { id: "restaurant", title: "Đặt bàn nhà hàng", level: 1 },
  { id: "shopping", title: "Mua sắm, trả hàng", level: 1 },
  { id: "hotel", title: "Đặt phòng khách sạn", level: 2 },
  { id: "doctor", title: "Khám bệnh", level: 2 },
  { id: "interview", title: "Phỏng vấn xin việc", level: 3 },
  { id: "complaint", title: "Khiếu nại dịch vụ", level: 3 },
];

const IELTS_PARTS = [
  { part: "p1", title: "Part 1", desc: "Câu hỏi về bản thân, 4–5 phút" },
  { part: "p2", title: "Part 2", desc: "Cue card: 1 phút chuẩn bị, 2 phút nói" },
  { part: "p3", title: "Part 3", desc: "Thảo luận mở rộng chủ đề, 4–5 phút" },
];

export default function SpeakPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-8 lg:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Luyện nói</h1>
      <p className="page-lead">Hội thoại tình huống với AI, có sửa lỗi từng câu. Phần IELTS cho nói bằng micro hoặc gõ câu trả lời, rồi chấm band theo 4 tiêu chí.</p>

      <div className="mt-8">
        <LinkList title="Hội thoại tình huống" description="Gõ tin nhắn để đóng vai với AI cho đến khi đạt mục tiêu cuộc hội thoại."
          items={SCENARIOS.map((s) => ({ href: `/speak/roleplay/${s.id}`, title: s.title, aside: LEVEL[s.level] }))} />
        <LinkList title="IELTS Speaking"
          items={IELTS_PARTS.map((p) => ({ href: `/speak/ielts/${p.part}`, title: p.title, meta: p.desc }))} />
        <LinkList title="Phát âm và lịch sử" items={[
          { href: "/speak/shadowing", title: "Shadowing", meta: "Nghe câu mẫu rồi nhắc lại để luyện phát âm" },
          { href: "/speak/history", title: "Bài nói đã làm", meta: "Nghe lại bản ghi và xem điểm" },
        ]} />
      </div>
    </main>
  );
}

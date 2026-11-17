import LinkList from "@/components/LinkList";

const GROUPS = [
  { title: "IELTS Task 2", description: "Bài luận 250 từ, 40 phút.", tasks: [
    { id: "task2-opinion", name: "Opinion essay", desc: "Đồng ý hay không đồng ý với một quan điểm" },
    { id: "task2-discuss", name: "Discussion essay", desc: "Bàn về hai quan điểm và nêu ý kiến của bạn" },
  ] },
  { title: "IELTS Task 1", description: "Mô tả biểu đồ, 150 từ, 20 phút.", tasks: [
    { id: "task1-line", name: "Line chart", desc: "Mô tả xu hướng theo thời gian" },
    { id: "task1-bar", name: "Bar chart", desc: "So sánh số liệu giữa các nhóm" },
  ] },
  { title: "TOEIC Writing", description: "100–150 từ, 10 phút.", tasks: [
    { id: "toeic-email", name: "Business email", desc: "Trả lời một email công việc" },
  ] },
];

export default function WritePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-8 lg:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Luyện viết</h1>
      <p className="page-lead">Chọn dạng bài để bắt đầu. AI chấm theo 4 tiêu chí, chỉ ra từng lỗi trong bài và đưa bài mẫu.</p>

      <div className="mt-8">
        {GROUPS.map((group) => (
          <LinkList key={group.title} title={group.title} description={group.description}
            items={group.tasks.map((t) => ({ href: `/write/task/${t.id}`, title: <span className="font-en">{t.name}</span>, meta: t.desc }))} />
        ))}
        <LinkList title="Bài đã viết" items={[{ href: "/write/history", title: "Lịch sử bài viết", meta: "Xem lại điểm, viết lại những câu bị sửa" }]} />
      </div>
    </main>
  );
}

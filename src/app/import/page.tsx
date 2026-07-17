import ImportWords from "@/components/ImportWords";

export default function ImportPage() {
  return <main className="bg-[#f7f4ff] px-4 py-12 text-[#2c1f4a] sm:px-6"><div className="mx-auto max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f56d9]">Learning library</p><h1 className="mt-2 font-display text-4xl font-bold">Import danh sách từ</h1><p className="mb-6 mt-2 text-sm text-[#6b6384]">Dán danh sách từ tiếng Anh — AI sẽ tra nghĩa và câu ví dụ cho từng từ.</p><div className="rounded-[28px] bg-white p-5 shadow-sm sm:p-8"><ImportWords /></div></div></main>;
}

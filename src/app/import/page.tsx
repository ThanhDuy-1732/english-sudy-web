import ImportWords from "@/components/ImportWords";

export default function ImportPage() {
  return <main className="page"><div><h1 className="page-title">Nhập danh sách từ</h1><p className="page-lead mb-6">Dán danh sách từ tiếng Anh. AI tra nghĩa và câu ví dụ cho từng từ.</p><div className="panel p-5 sm:p-8"><ImportWords /></div></div></main>;
}

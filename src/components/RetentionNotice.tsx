import Link from "next/link";
import { RETENTION_DAYS } from "@/lib/retention";

/** Tells the learner which data is deleted automatically after RETENTION_DAYS, and how to keep it. */
export default function RetentionNotice({ className = "" }: { className?: string }) {
  return (
    <p role="note" className={`rounded-lg border border-rule bg-card px-4 py-3 text-sm leading-6 text-muted ${className}`}>
      Lịch sử học, đề thi đã tạo và bản ghi âm cũ hơn {RETENTION_DAYS} ngày sẽ tự động bị xoá. Từ đã lưu, sổ lỗi, điểm số và bài viết được giữ lại.{" "}
      <Link href="/settings" className="font-medium text-primary hover:underline">Xuất file sao lưu</Link> nếu muốn giữ toàn bộ.
    </p>
  );
}

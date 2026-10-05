"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="mb-3 text-xl font-bold">Đã xảy ra lỗi</h1>
      <p className="mb-6 text-sm text-[#b0b0d1]">Trang này gặp sự cố. Dữ liệu học của bạn vẫn được giữ trên thiết bị.</p>
      <button type="button" onClick={reset} className="rounded-lg bg-[#7f56d9] px-6 py-3 text-sm font-semibold text-white">Thử lại</button>
    </main>
  );
}

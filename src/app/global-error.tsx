"use client";

// Last-resort boundary for errors in the root layout (navigation, providers). It replaces the whole document.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0e1f19", color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Đã xảy ra lỗi</h1>
          <p style={{ fontSize: 14, color: "rgb(var(--muted))", marginBottom: 24 }}>Ứng dụng gặp sự cố khi khởi động. Dữ liệu học của bạn vẫn được giữ trên thiết bị.</p>
          <button type="button" onClick={reset} style={{ background: "#1f8a50", color: "#fff", border: 0, borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 600 }}>Thử lại</button>
        </div>
      </body>
    </html>
  );
}

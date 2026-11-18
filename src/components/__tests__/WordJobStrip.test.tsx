import { render, screen } from "@testing-library/react";
import { WordJobStrip } from "../WordJobStrip";

const base = {
  id: "j1",
  topic: "TOEIC",
  target: 1000,
  createdAt: "2026-11-18T00:00:00.000Z",
  updatedAt: "2026-11-18T00:00:00.000Z",
};

test("job đang chạy hiện tiến trình và nút Dừng", () => {
  const onPause = jest.fn();
  render(
    <WordJobStrip
      job={{ ...base, status: "running" }}
      count={420}
      isOwner
      onPause={onPause}
      onResume={jest.fn()}
      onCancel={jest.fn()}
    />
  );
  expect(screen.getByText(/420\/1\.000/)).toBeInTheDocument();
  screen.getByRole("button", { name: "Dừng" }).click();
  expect(onPause).toHaveBeenCalled();
});

test("tab khác đang chạy thì không có nút điều khiển", () => {
  render(
    <WordJobStrip
      job={{ ...base, status: "running" }}
      count={420}
      isOwner={false}
      onPause={jest.fn()}
      onResume={jest.fn()}
      onCancel={jest.fn()}
    />
  );
  expect(screen.getByText(/tab khác/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Dừng" })).toBeNull();
});

test("job dở hiện Chạy tiếp và Huỷ", () => {
  const onResume = jest.fn();
  render(
    <WordJobStrip
      job={{ ...base, status: "paused" }}
      count={420}
      isOwner
      onPause={jest.fn()}
      onResume={onResume}
      onCancel={jest.fn()}
    />
  );
  screen.getByRole("button", { name: "Chạy tiếp" }).click();
  expect(onResume).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Huỷ" })).toBeInTheDocument();
});

test("lỗi lưu trữ hiện thông báo riêng", () => {
  render(
    <WordJobStrip
      job={{ ...base, status: "error", lastError: "Không lưu được vào bộ nhớ trình duyệt." }}
      count={420}
      isOwner
      onPause={jest.fn()}
      onResume={jest.fn()}
      onCancel={jest.fn()}
    />
  );
  expect(screen.getByText(/Không lưu được/)).toBeInTheDocument();
});

test("job paused hiện lý do dừng", () => {
  render(
    <WordJobStrip
      job={{ ...base, status: "paused", lastError: "Chủ đề này đã cạn từ mới." }}
      count={420}
      isOwner
      onPause={jest.fn()}
      onResume={jest.fn()}
      onCancel={jest.fn()}
    />
  );
  expect(screen.getByText(/đã cạn từ mới/)).toBeInTheDocument();
});

test("không có job thì không render gì", () => {
  const { container } = render(
    <WordJobStrip job={null} count={0} isOwner onPause={jest.fn()} onResume={jest.fn()} onCancel={jest.fn()} />
  );
  expect(container).toBeEmptyDOMElement();
});

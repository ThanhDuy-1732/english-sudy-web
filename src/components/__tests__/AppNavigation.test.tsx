import { render, screen, within } from "@testing-library/react";
import AppNavigation from "../AppNavigation";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
jest.mock("next/image", () => ({
  __esModule: true,
  default: () => <span data-testid="brand-image" />,
}));
jest.mock("@/components/LanguagePicker", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/DueBadge", () => ({ DueBadge: () => null }));
jest.mock("@/components/HeaderTimer", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ProviderBadge", () => ({ ProviderBadge: () => null }));

test("thanh tab điện thoại có Dịch thay cho Luyện thi", () => {
  render(<AppNavigation />);
  const tabbar = screen.getByRole("navigation", { name: "Điều hướng nhanh" });
  // Chỉ đọc các tab chính (con trực tiếp của hàng tab); liên kết "Luyện thi" nằm trong bảng Thêm.
  const row = tabbar.querySelector(".grid") as HTMLElement;
  const tabs = Array.from(row.querySelectorAll(":scope > a")).map((link) => ({
    label: link.querySelector("span")?.textContent,
    href: link.getAttribute("href"),
  }));
  expect(tabs).toEqual([
    { label: "Hôm nay", href: "/today" },
    { label: "Từ mới", href: "/" },
    { label: "Ôn tập", href: "/review" },
    { label: "Dịch", href: "/translate" },
  ]);
});

test("Luyện thi vẫn mở được từ bảng Thêm", () => {
  render(<AppNavigation />);
  const sheet = document.querySelector("details") as HTMLElement;
  expect(within(sheet).getByRole("link", { name: "Luyện thi" })).toHaveAttribute("href", "/exam");
});

test("thanh bên có Dịch ngay sau Hôm nay", () => {
  render(<AppNavigation />);
  const sidebar = screen.getByRole("navigation", { name: "Điều hướng chính" });
  const labels = within(sidebar).getAllByRole("link").map((link) => link.textContent);
  expect(labels).toEqual(expect.arrayContaining(["Hôm nay", "Dịch", "Ôn tập"]));
  expect(labels.indexOf("Dịch")).toBeGreaterThan(labels.indexOf("Hôm nay"));
  expect(labels.indexOf("Dịch")).toBeLessThan(labels.indexOf("Ôn tập"));
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ServiceWorkerRegistration from "../ServiceWorkerRegistration";

let mockPathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

test("shows native installation guidance and uses the browser install prompt when available", async () => {
  render(<ServiceWorkerRegistration />);
  expect(screen.getByText(/iPhone\/iPad: mở bằng Safari/)).toBeInTheDocument();
  const prompt = jest.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt, userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  act(() => { window.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cài ThankZ English" }));
  await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
});

test("shows and clears the offline notice on connectivity changes", () => {
  render(<ServiceWorkerRegistration />);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  act(() => { window.dispatchEvent(new Event("offline")); });
  expect(screen.getByRole("status")).toHaveTextContent("Đang ngoại tuyến");
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  act(() => { window.dispatchEvent(new Event("online")); });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("an update reloads the page at the next navigation, not before", async () => {
  const previous = process.env.NODE_ENV;
  Object.defineProperty(process.env, "NODE_ENV", { configurable: true, writable: true, value: "production" });
  const reload = jest.fn();
  const originalLocation = window.location;
  Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, reload } });
  const listeners: Record<string, () => void> = {};
  const registration = { addEventListener: jest.fn(), removeEventListener: jest.fn(), update: jest.fn().mockResolvedValue(undefined) };
  const register = jest.fn().mockResolvedValue(registration);
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {
    controller: {}, register, addEventListener: (name: string, fn: () => void) => { listeners[name] = fn; }, removeEventListener: jest.fn(),
  } });
  try {
    mockPathname = "/vocab";
    const view = render(<ServiceWorkerRegistration />);
    await waitFor(() => expect(register).toHaveBeenCalled());
    act(() => listeners.controllerchange());
    expect(reload).not.toHaveBeenCalled();
    mockPathname = "/translate";
    view.rerender(<ServiceWorkerRegistration />);
    expect(reload).toHaveBeenCalledTimes(1);
    view.unmount();
  } finally {
    mockPathname = "/";
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    Object.defineProperty(process.env, "NODE_ENV", { configurable: true, writable: true, value: previous });
  }
});

test("the install guidance can be dismissed and stays hidden after a reload", () => {
  const first = render(<ServiceWorkerRegistration />);
  expect(screen.getByText(/Cài ứng dụng trên điện thoại/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ẩn hướng dẫn cài đặt" }));
  expect(screen.queryByText(/Cài ứng dụng trên điện thoại/)).not.toBeInTheDocument();
  expect(localStorage.getItem("pwaInstallDismissed")).toBe("1");
  first.unmount();
  render(<ServiceWorkerRegistration />);
  expect(screen.queryByText(/Cài ứng dụng trên điện thoại/)).not.toBeInTheDocument();
});

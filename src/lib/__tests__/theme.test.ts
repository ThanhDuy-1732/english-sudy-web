import { THEME_INIT_SCRIPT, getThemePref, setThemePref } from "../theme";

type Listener = () => void;

function mockOs(initialDark: boolean) {
  let matches = initialDark;
  const listeners = new Set<Listener>();
  window.matchMedia = jest.fn().mockImplementation(() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia;
  return {
    set(dark: boolean) {
      matches = dark;
      listeners.forEach((l) => l());
    },
  };
}

function boot() {
  new Function(THEME_INIT_SCRIPT)();
}

const theme = () => document.documentElement.getAttribute("data-theme");

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = '<meta name="theme-color" content="#000000">';
});

test("system follows the OS and updates live when the OS changes", () => {
  const os = mockOs(true);
  boot();
  expect(theme()).toBe("dark");
  os.set(false);
  expect(theme()).toBe("light");
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#f4f7fc");
});

test("an explicit preference wins over the OS and ignores OS changes", () => {
  const os = mockOs(true);
  localStorage.setItem("theme", "light");
  boot();
  expect(theme()).toBe("light");
  os.set(false);
  os.set(true);
  expect(theme()).toBe("light");
});

test("setThemePref persists the choice and re-resolves immediately", () => {
  mockOs(false);
  boot();
  expect(theme()).toBe("light");
  setThemePref("dark");
  expect(theme()).toBe("dark");
  expect(getThemePref()).toBe("dark");
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#0e182b");
  setThemePref("system");
  expect(theme()).toBe("light");
  expect(getThemePref()).toBe("system");
});

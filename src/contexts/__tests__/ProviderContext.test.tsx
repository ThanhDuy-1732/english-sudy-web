import { render, screen, act, waitFor } from "@testing-library/react";
import { ProviderContextProvider, useProvider } from "../ProviderContext";

const mockProviders = [
  { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest" },
  { id: "groq", name: "Groq", model: "llama-3.3-70b" },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve(mockProviders),
  }) as jest.Mock;
  localStorage.clear();
});

function TestConsumer() {
  const { currentProvider, availableProviders, setProvider } = useProvider();
  return (
    <div>
      <span data-testid="current">{currentProvider}</span>
      <span data-testid="count">{availableProviders.length}</span>
      <button onClick={() => setProvider("groq")}>Switch</button>
    </div>
  );
}

test("loads providers from API and sets first as default", async () => {
  render(
    <ProviderContextProvider>
      <TestConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("gemini"));
  expect(screen.getByTestId("count").textContent).toBe("2");
});

test("defaults to opencode when it is available", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () =>
      Promise.resolve([
        { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest" },
        { id: "opencode", name: "OpenCode Go", model: "deepseek-v4.1-flash" },
      ]),
  }) as jest.Mock;

  render(
    <ProviderContextProvider>
      <TestConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("opencode"));
});

test("saved preference wins over the opencode default", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    json: () =>
      Promise.resolve([
        { id: "gemini", name: "Gemini Flash", model: "gemini-flash-latest" },
        { id: "opencode", name: "OpenCode Go", model: "deepseek-v4.1-flash" },
      ]),
  }) as jest.Mock;
  localStorage.setItem("preferredProvider", "gemini");

  render(
    <ProviderContextProvider>
      <TestConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("gemini"));
});

test("restores provider from localStorage", async () => {
  localStorage.setItem("preferredProvider", "groq");
  render(
    <ProviderContextProvider>
      <TestConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("groq"));
});

test("setProvider updates state and localStorage", async () => {
  render(
    <ProviderContextProvider>
      <TestConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("gemini"));
  act(() => screen.getByText("Switch").click());
  expect(screen.getByTestId("current").textContent).toBe("groq");
  expect(localStorage.getItem("preferredProvider")).toBe("groq");
});

function ToggleConsumer() {
  const { disabledProviders, toggleProvider, currentProvider } = useProvider();
  return (
    <div>
      <span data-testid="disabled">{disabledProviders.join(",")}</span>
      <span data-testid="current">{currentProvider}</span>
      <button onClick={() => toggleProvider("groq")}>Toggle Groq</button>
    </div>
  );
}

test("disabledProviders starts empty", async () => {
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getAllByTestId("current")[0].textContent).toBe("gemini"));
  expect(screen.getByTestId("disabled").textContent).toBe("");
});

test("toggleProvider disables a provider and persists to localStorage", async () => {
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getAllByTestId("current")[0].textContent).toBe("gemini"));
  act(() => screen.getByText("Toggle Groq").click());
  expect(screen.getByTestId("disabled").textContent).toBe("groq");
  expect(JSON.parse(localStorage.getItem("disabledProviders")!)).toEqual(["groq"]);
});

test("toggleProvider re-enables a disabled provider", async () => {
  localStorage.setItem("disabledProviders", JSON.stringify(["groq"]));
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getAllByTestId("current")[0].textContent).toBe("gemini"));
  await waitFor(() => expect(screen.getByTestId("disabled").textContent).toBe("groq"));
  act(() => screen.getByText("Toggle Groq").click());
  expect(screen.getByTestId("disabled").textContent).toBe("");
});

test("toggleProvider switches currentProvider when disabling the active one", async () => {
  localStorage.setItem("preferredProvider", "groq");
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getAllByTestId("current")[0].textContent).toBe("groq"));
  act(() => screen.getByText("Toggle Groq").click());
  // Should fall back to first available (gemini)
  expect(screen.getAllByTestId("current")[0].textContent).toBe("gemini");
  expect(localStorage.getItem("preferredProvider")).toBe("gemini");
});

test("restores disabledProviders from localStorage on mount", async () => {
  localStorage.setItem("disabledProviders", JSON.stringify(["gemini", "groq"]));
  render(
    <ProviderContextProvider>
      <ToggleConsumer />
    </ProviderContextProvider>
  );
  await waitFor(() => expect(screen.getByTestId("disabled").textContent).toBe("gemini,groq"));
});

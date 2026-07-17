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

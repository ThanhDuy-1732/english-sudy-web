import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WritingChallenge from "../WritingChallenge";

test("submits a sentence and displays grade", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => null }, json: async () => ({ score: 9, feedback: "Tốt", corrected: "I negotiate." }) }) as unknown as typeof fetch;
  render(<WritingChallenge word="negotiate" />);
  fireEvent.change(screen.getByPlaceholderText("Ví dụ: I need to negotiate..."), { target: { value: "I negotiate." } });
  fireEvent.click(screen.getByRole("button", { name: "Chấm điểm" }));
  await waitFor(() => expect(screen.getByText("9/10")).toBeInTheDocument());
  expect(global.fetch).toHaveBeenCalledWith("/api/grade-sentence", expect.objectContaining({ method: "POST" }));
});

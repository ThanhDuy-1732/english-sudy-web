import { createRecorder } from "../recorder";

test("records MP4 on browsers without WebM and releases the microphone", async () => {
  const stopTrack = jest.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: jest.fn().mockResolvedValue(stream) } });
  const ctor = jest.fn().mockImplementation((input, options) => ({
    stream: input, mimeType: options.mimeType, state: "recording", start: jest.fn(),
    stop() {
      this.ondataavailable({ data: new Blob(["audio"], { type: this.mimeType }) });
      this.onstop();
    },
  }));
  Object.assign(ctor, { isTypeSupported: (type: string) => type === "audio/mp4" });
  Object.defineProperty(global, "MediaRecorder", { configurable: true, value: ctor });
  const recorder = createRecorder();
  await recorder.start();
  const audio = await recorder.stop();
  expect(audio.type).toBe("audio/mp4");
  expect(stopTrack).toHaveBeenCalledTimes(1);
});

test("does not leave the microphone running if recorder construction fails", async () => {
  const stop = jest.fn();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) } });
  const ctor = jest.fn(() => { throw new Error("unsupported recorder"); });
  Object.assign(ctor, { isTypeSupported: () => true });
  Object.defineProperty(global, "MediaRecorder", { configurable: true, value: ctor });
  await expect(createRecorder().start()).rejects.toThrow();
  expect(stop).toHaveBeenCalledTimes(1);
});

export function createRecorder() {
  let chunks: Blob[] = [];
  let rec: MediaRecorder | null = null;

  return {
    async start() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(1000);
    },
    stop(): Promise<Blob> {
      return new Promise((resolve) => {
        rec!.onstop = () => {
          rec!.stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: "audio/webm" }));
        };
        rec!.stop();
      });
    },
    isRecording() {
      return rec?.state === "recording";
    },
  };
}

export type Recorder = ReturnType<typeof createRecorder>;

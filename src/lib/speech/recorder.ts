export function audioFilename(blob: Blob, stem = "speech"): string {
  const type = blob.type.split(";")[0];
  const extension = type === "audio/mp4" || type === "audio/x-m4a" ? "m4a" : type === "audio/ogg" ? "ogg" : "webm";
  return `${stem}.${extension}`;
}

export function createRecorder() {
  let chunks: Blob[] = [];
  let rec: MediaRecorder | null = null;
  let generation = 0;

  return {
    async start() {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Thiết bị chưa hỗ trợ ghi âm. Hãy mở ứng dụng qua HTTPS.");
      }
      const current = ++generation;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try {
        if (current !== generation) throw new Error("Đã hủy ghi âm.");
        const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
          .find((type) => MediaRecorder.isTypeSupported(type));
        chunks = [];
        rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.start(1000);
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop());
        throw error;
      }
    },
    stop(): Promise<Blob> {
      const recorder = rec;
      if (!recorder || recorder.state === "inactive") return Promise.reject(new Error("Chưa ghi âm."));
      return new Promise((resolve, reject) => {
        recorder.onstop = () => {
          recorder.stream.getTracks().forEach((track) => track.stop());
          rec = null;
          resolve(new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type }));
        };
        recorder.onerror = () => {
          recorder.stream.getTracks().forEach((track) => track.stop());
          rec = null;
          reject(new Error("Không thể ghi âm."));
        };
        recorder.stop();
      });
    },
    dispose() {
      generation++;
      if (rec) {
        rec.onstop = null;
        rec.ondataavailable = null;
        if (rec.state !== "inactive") rec.stop();
        rec.stream.getTracks().forEach((track) => track.stop());
        rec = null;
      }
    },
    isRecording() {
      return rec?.state === "recording";
    },
  };
}

export type Recorder = ReturnType<typeof createRecorder>;

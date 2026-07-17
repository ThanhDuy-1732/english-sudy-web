"use client";

import { useProvider } from "@/contexts/ProviderContext";

const ALL_PROVIDERS = [
  {
    id: "gemini",
    name: "Gemini Flash",
    model: "gemini-flash-latest",
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "groq",
    name: "Groq",
    model: "llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    model: "mistralai/Mistral-7B-v0.1",
    envKey: "HUGGINGFACE_API_KEY",
  },
];

export default function SettingsPage() {
  const { currentProvider, availableProviders, setProvider } = useProvider();

  const isActive = (id: string) => availableProviders.some((p) => p.id === id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 font-display text-3xl font-bold text-[#d9ecff]">Cài đặt</h1>
      <p className="mb-8 text-sm text-[#b0b0d1]">
        Quản lý AI provider. Provider được kích hoạt khi có API key trong{" "}
        <code className="rounded bg-white/10 px-1">.env.local</code>.
      </p>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left">
              <th className="px-4 py-3 font-semibold text-[#d9ecff]">Provider</th>
              <th className="px-4 py-3 font-semibold text-[#d9ecff]">Model</th>
              <th className="px-4 py-3 font-semibold text-[#d9ecff]">Trạng thái</th>
              <th className="px-4 py-3 font-semibold text-[#d9ecff]">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {ALL_PROVIDERS.map((p) => {
              const active = isActive(p.id);
              const isCurrent = p.id === currentProvider;
              return (
                <tr key={p.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-4 font-medium text-white">{p.name}</td>
                  <td className="px-4 py-4 font-mono text-xs text-[#b0b0d1]">{p.model}</td>
                  <td className="px-4 py-4">
                    {active ? (
                      <span className="inline-flex items-center gap-1 text-green-400">
                        ✅ Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-yellow-400">
                        ⚠️ Chưa cấu hình
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {active ? (
                      isCurrent ? (
                        <span className="text-[#d9ecff]">✓ Đang dùng</span>
                      ) : (
                        <button
                          onClick={() => setProvider(p.id)}
                          className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-[#d9ecff] hover:bg-white/20"
                        >
                          Dùng cái này
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-[#b0b0d1]">
                        Thêm <code className="rounded bg-white/5 px-1">{p.envKey}</code> vào
                        .env.local
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

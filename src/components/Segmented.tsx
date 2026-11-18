"use client";

/** Single-choice segmented control (exam type, level, stats tab, study minutes). */
export default function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap rounded-2xl bg-ink/[0.06] p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-xl px-4 text-sm font-medium tabular-nums transition-colors ${value === option.value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// A word's growth stage, drawn as a plant: seed → sprout → leaves → bush → bud → flower.
// Stages are the 0–5 mastery stars, which FSRS derives from how long the memory lasts (lib/srs.ts).

export const STAGE_NAMES = ["Hạt", "Mầm", "Lá", "Bụi", "Nụ", "Hoa"] as const;

/** Growth stage 0–5 of a saved word (its mastery stars). */
export function growthStage(mastery: number | undefined): number {
  return Math.max(0, Math.min(5, Math.round(mastery ?? 0)));
}

const SOIL = <ellipse cx="32" cy="58.5" rx="11" ry="3" fill="#8a6a4f" />;
const STEM = "#24834b";
const LEAF_A = "#54c27f";
const LEAF_B = "#3eaf6c";
const FLOWER = "#f25f4c";

const DRAWINGS: React.ReactNode[] = [
  <>
    <ellipse cx="32" cy="54" rx="9" ry="6" fill="#8a6a4f" />
    <ellipse cx="32" cy="51" rx="5" ry="3.6" fill="#c79b6a" />
  </>,
  <>
    <path d="M32 57V42" stroke={STEM} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M32 44c-7 0-11-4-11-10 7 0 11 4 11 10z" fill={LEAF_A} />
    {SOIL}
  </>,
  <>
    <path d="M32 57V32" stroke={STEM} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M32 42c-9 0-14-5-14-13 9 0 14 5 14 13z" fill={LEAF_A} />
    <path d="M32 36c8 0 13-5 13-12-8 0-13 5-13 12z" fill={LEAF_B} />
    {SOIL}
  </>,
  <>
    <path d="M32 58V30" stroke={STEM} strokeWidth="4" strokeLinecap="round" />
    <circle cx="24" cy="34" r="11" fill={LEAF_B} />
    <circle cx="40" cy="32" r="12" fill={LEAF_A} />
    <circle cx="32" cy="22" r="12" fill="#2e9e5b" />
    {SOIL}
  </>,
  <>
    <path d="M32 58V24" stroke={STEM} strokeWidth="4" strokeLinecap="round" />
    <path d="M32 44c-10 0-15-5-15-13 10 0 15 5 15 13z" fill={LEAF_A} />
    <path d="M32 38c9 0 14-5 14-12-9 0-14 5-14 12z" fill={LEAF_B} />
    <path d="M32 8c-6 6-6 14 0 18 6-4 6-12 0-18z" fill={FLOWER} />
    {SOIL}
  </>,
  <>
    <path d="M32 58V28" stroke={STEM} strokeWidth="4" strokeLinecap="round" />
    <path d="M32 46c-10 0-15-5-15-13 10 0 15 5 15 13z" fill={LEAF_A} />
    <path d="M32 40c9 0 14-5 14-12-9 0-14 5-14 12z" fill={LEAF_B} />
    <g fill={FLOWER}>
      <circle cx="32" cy="9" r="7" /><circle cx="41" cy="16" r="7" /><circle cx="38" cy="26" r="7" /><circle cx="26" cy="26" r="7" /><circle cx="23" cy="16" r="7" />
    </g>
    <circle cx="32" cy="18" r="5.5" fill="#ffc93c" />
    {SOIL}
  </>,
];

export default function Plant({ stage, size = 48, className = "", label }: { stage: number; size?: number; className?: string; label?: string }) {
  const s = growthStage(stage);
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {DRAWINGS[s]}
    </svg>
  );
}

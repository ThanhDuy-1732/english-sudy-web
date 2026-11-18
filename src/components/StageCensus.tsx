import Plant, { STAGE_NAMES, growthStage } from "./Plant";

/** How many saved words sit at each growth stage, as a row of plants on a soil line. */
export default function StageCensus({ masteries }: { masteries: (number | undefined)[] }) {
  const perStage = STAGE_NAMES.map((_, stage) => masteries.filter((m) => growthStage(m) === stage).length);
  return (
    <ul aria-label="Số từ theo giai đoạn" className="grid grid-cols-6 gap-1 border-b-[6px] border-soil">
      {STAGE_NAMES.map((name, stage) => (
        <li key={name} className="flex flex-col items-center">
          <span className="font-display text-lg font-bold tabular-nums text-ink">{perStage[stage]}</span>
          <Plant stage={stage} size={52} className="h-auto w-full max-w-[52px]" />
          <span className="pb-1 text-xs text-muted">{name}</span>
        </li>
      ))}
    </ul>
  );
}

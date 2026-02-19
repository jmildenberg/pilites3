import type { Region, ChannelId } from '../../types';

const SWATCH_COLORS = [
  '#a855f7', '#3b82f6', '#22c55e', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
];

interface Props {
  channelId: ChannelId;
  channelLabel: string;
  ledCount: number;
  regions: Region[];
  selectedRegionId: string | null;
  onSelectRegion: (id: string) => void;
  onAddRegion: (channelId: ChannelId, startIndex: number, endIndex: number) => void;
}

/** Gaps between defined regions — spans of unnamed LEDs */
function computeGaps(regions: Region[], ledCount: number): Array<{ start: number; end: number }> {
  const sorted = [...regions].sort((a, b) => a.startIndex - b.startIndex);
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.startIndex > cursor) gaps.push({ start: cursor, end: r.startIndex - 1 });
    cursor = r.endIndex + 1;
  }
  if (cursor < ledCount) gaps.push({ start: cursor, end: ledCount - 1 });
  return gaps;
}

export function ChannelStrip({
  channelId, channelLabel, ledCount, regions, selectedRegionId,
  onSelectRegion, onAddRegion,
}: Props) {
  const channelRegions = regions
    .filter((r) => r.channelId === channelId)
    .sort((a, b) => a.startIndex - b.startIndex);

  const gaps = computeGaps(channelRegions, ledCount);

  /** Build an ordered list of segments (regions + gaps) for rendering */
  type Segment =
    | { kind: 'region'; region: Region }
    | { kind: 'gap'; start: number; end: number };

  const segments: Segment[] = [];
  const allItems: Array<{ start: number; item: Segment }> = [
    ...channelRegions.map((r) => ({ start: r.startIndex, item: { kind: 'region' as const, region: r } })),
    ...gaps.map((g) => ({ start: g.start, item: { kind: 'gap' as const, ...g } })),
  ];
  allItems.sort((a, b) => a.start - b.start).forEach(({ item }) => segments.push(item));

  function segmentWidth(start: number, end: number) {
    return `${((end - start + 1) / ledCount) * 100}%`;
  }


  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-400">{channelLabel}</span>
        <span className="text-xs text-neutral-600">{ledCount} LEDs</span>
      </div>

      {/* Strip visualization */}
      <div className="relative flex h-10 rounded overflow-hidden border border-[#3e3e3e] bg-[#0f0f0f]">
        {segments.length === 0 ? (
          // No regions and no gaps means ledCount === 0; shouldn't happen
          <div className="flex-1 bg-[#1a1a1a]" />
        ) : (
          segments.map((seg, i) => {
            if (seg.kind === 'region') {
              const { region } = seg;
              const isSelected = region.id === selectedRegionId;
              return (
                <button
                  key={region.id}
                  onClick={() => onSelectRegion(region.id)}
                  title={`${region.label} (${region.startIndex}–${region.endIndex})`}
                  className="relative flex items-center justify-center text-xs font-semibold truncate px-1 transition-all"
                  style={{
                    width: segmentWidth(region.startIndex, region.endIndex),
                    backgroundColor: region.uiColor + (isSelected ? 'ff' : '55'),
                    color: isSelected ? '#fff' : region.uiColor,
                    outline: isSelected ? `2px solid ${region.uiColor}` : undefined,
                    outlineOffset: '-2px',
                  }}
                >
                  {region.label}
                </button>
              );
            } else {
              // Gap — click to add a region here
              const { start, end } = seg;
              return (
                <button
                  key={`gap-${i}`}
                  onClick={() => onAddRegion(channelId, start, end)}
                  title={`Add region (${start}–${end})`}
                  className="flex items-center justify-center text-neutral-700 hover:text-neutral-400 hover:bg-[#2e2e2e] transition-colors group"
                  style={{ width: segmentWidth(start, end) }}
                >
                  <span className="text-lg leading-none group-hover:scale-110 transition-transform">+</span>
                </button>
              );
            }
          })
        )}
      </div>

      {/* Region index ruler */}
      <div className="flex justify-between text-[10px] text-neutral-700 font-mono px-0.5">
        <span>0</span>
        <span>{Math.round(ledCount / 4)}</span>
        <span>{Math.round(ledCount / 2)}</span>
        <span>{Math.round((ledCount * 3) / 4)}</span>
        <span>{ledCount - 1}</span>
      </div>
    </div>
  );
}

export { SWATCH_COLORS };

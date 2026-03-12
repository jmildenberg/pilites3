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

/** A flat list of all used LED ranges across all regions, sorted by start. */
function usedRanges(regions: Region[]): Array<{ start: number; end: number; regionId: string; segIndex: number }> {
  const ranges: Array<{ start: number; end: number; regionId: string; segIndex: number }> = [];
  for (const r of regions) {
    r.segments.forEach((seg, si) => {
      ranges.push({ start: seg.startIndex, end: seg.endIndex, regionId: r.id, segIndex: si });
    });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** Gaps between all used ranges. */
function computeGaps(
  ranges: Array<{ start: number; end: number }>,
  ledCount: number,
): Array<{ start: number; end: number }> {
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) gaps.push({ start: cursor, end: r.start - 1 });
    cursor = Math.max(cursor, r.end + 1);
  }
  if (cursor < ledCount) gaps.push({ start: cursor, end: ledCount - 1 });
  return gaps;
}

export function ChannelStrip({
  channelId, channelLabel, ledCount, regions, selectedRegionId,
  onSelectRegion, onAddRegion,
}: Props) {
  const channelRegions = regions.filter((r) => r.channelId === channelId);
  const regionById = new Map(channelRegions.map((r) => [r.id, r]));

  const ranges = usedRanges(channelRegions);
  const gaps = computeGaps(ranges, ledCount);

  /** Build an ordered list of strip items for rendering */
  type StripItem =
    | { kind: 'seg'; regionId: string; segIndex: number; start: number; end: number }
    | { kind: 'gap'; start: number; end: number };

  const items: StripItem[] = [
    ...ranges.map(({ start, end, regionId, segIndex }) => ({
      kind: 'seg' as const, regionId, segIndex, start, end,
    })),
    ...gaps.map(({ start, end }) => ({ kind: 'gap' as const, start, end })),
  ].sort((a, b) => a.start - b.start);

  function slotWidth(start: number, end: number) {
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
        {items.length === 0 ? (
          <div className="flex-1 bg-[#1a1a1a]" />
        ) : (
          items.map((item, i) => {
            if (item.kind === 'seg') {
              const region = regionById.get(item.regionId)!;
              const isSelected = region.id === selectedRegionId;
              const isFirst = item.segIndex === 0;
              const title = `${region.label} — segment ${item.segIndex + 1} (${item.start}–${item.end})`;
              return (
                <button
                  key={`${region.id}-${item.segIndex}`}
                  onClick={() => onSelectRegion(region.id)}
                  title={title}
                  className="relative flex items-center justify-center text-xs font-semibold truncate px-1 transition-all"
                  style={{
                    width: slotWidth(item.start, item.end),
                    backgroundColor: region.uiColor + (isSelected ? 'ff' : '55'),
                    color: isSelected ? '#fff' : region.uiColor,
                    outline: isSelected ? `2px solid ${region.uiColor}` : undefined,
                    outlineOffset: '-2px',
                  }}
                >
                  {isFirst ? region.label : ''}
                </button>
              );
            } else {
              const { start, end } = item;
              return (
                <button
                  key={`gap-${i}`}
                  onClick={() => onAddRegion(channelId, start, end)}
                  title={`Add region (${start}–${end})`}
                  className="flex items-center justify-center text-neutral-700 hover:text-neutral-400 hover:bg-[#2e2e2e] transition-colors group"
                  style={{ width: slotWidth(start, end) }}
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

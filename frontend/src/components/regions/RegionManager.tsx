import { useState } from 'react';
import type { Region, Segment, ChannelId, Play } from '../../types';
import { segmentLedCount } from '../../types';
import { ChannelStrip, SWATCH_COLORS } from './ChannelStrip';
import { useChannelConfig } from '../../context/ChannelConfigContext';

interface Props {
  play: Play;
  onUpdateRegions: (regions: Region[]) => void;
}

function makeId() {
  return crypto.randomUUID();
}

interface EditingState {
  regionId: string;
  label: string;
  segments: Segment[];
  uiColor: string;
}

export function RegionManager({ play, onUpdateRegions }: Props) {
  const { channels } = useChannelConfig();
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const selectedRegion = play.regions.find((r) => r.id === selectedRegionId) ?? null;

  function startEditing(region: Region) {
    setSelectedRegionId(region.id);
    setEditing({
      regionId: region.id,
      label: region.label,
      segments: region.segments,
      uiColor: region.uiColor,
    });
  }

  function handleAddRegion(channelId: ChannelId, startIndex: number, endIndex: number) {
    const used = new Set(play.regions.map((r) => r.uiColor));
    const uiColor = SWATCH_COLORS.find((c) => !used.has(c)) ?? SWATCH_COLORS[play.regions.length % SWATCH_COLORS.length];
    const newRegion: Region = {
      id: makeId(),
      label: `Region ${play.regions.length + 1}`,
      channelId,
      segments: [{ startIndex, endIndex }],
      uiColor,
    };
    const updated = [...play.regions, newRegion];
    onUpdateRegions(updated);
    startEditing(newRegion);
  }

  function handleSelectRegion(id: string) {
    const r = play.regions.find((r) => r.id === id);
    if (r) startEditing(r);
  }

  function commitEdit(override?: Partial<EditingState>) {
    if (!editing) return;
    const state = override ? { ...editing, ...override } : editing;
    if (override) setEditing(state);
    const updated = play.regions.map((r) =>
      r.id === state.regionId
        ? { ...r, label: state.label, segments: state.segments, uiColor: state.uiColor }
        : r
    );
    onUpdateRegions(updated);
  }

  function deleteRegion(id: string) {
    onUpdateRegions(play.regions.filter((r) => r.id !== id));
    setSelectedRegionId(null);
    setEditing(null);
  }

  // ── Segment editing helpers ──────────────────────────────────────────────────

  function updateSegment(index: number, patch: Partial<Segment>) {
    if (!editing) return;
    const segs = editing.segments.map((s, i) => (i === index ? { ...s, ...patch } : s));
    const next = { ...editing, segments: segs };
    setEditing(next);
    commitEdit({ segments: segs });
  }

  function addSegment() {
    if (!editing || !selectedRegion) return;
    const ch = channels.find((c) => c.id === selectedRegion.channelId);
    const ledCount = ch?.ledCount ?? 500;
    // Find first available LED index not already covered by this region's segments
    const covered = new Set<number>();
    editing.segments.forEach((s) => {
      for (let i = s.startIndex; i <= s.endIndex; i++) covered.add(i);
    });
    let start = 0;
    while (covered.has(start) && start < ledCount) start++;
    const end = Math.min(start, ledCount - 1);
    if (start >= ledCount) return; // no room
    const segs = [...editing.segments, { startIndex: start, endIndex: end }];
    const next = { ...editing, segments: segs };
    setEditing(next);
    commitEdit({ segments: segs });
  }

  function removeSegment(index: number) {
    if (!editing || editing.segments.length <= 1) return; // must keep at least one
    const segs = editing.segments.filter((_, i) => i !== index);
    const next = { ...editing, segments: segs };
    setEditing(next);
    commitEdit({ segments: segs });
  }

  const totalLeds = editing ? segmentLedCount(editing.segments) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs text-neutral-500 uppercase tracking-widest mb-4">LED Regions</h3>
        <div className="flex flex-col gap-5">
          {channels.map((ch) => (
            <ChannelStrip
              key={ch.id}
              channelId={ch.id}
              channelLabel={ch.label}
              ledCount={ch.ledCount}
              regions={play.regions}
              selectedRegionId={selectedRegionId}
              onSelectRegion={handleSelectRegion}
              onAddRegion={handleAddRegion}
            />
          ))}
        </div>
        <p className="text-xs text-neutral-600 mt-3">
          Click a gap <span className="text-neutral-400">+</span> to add a region. Click a region to edit it.
        </p>
      </div>

      {/* Region list + edit panel */}
      <div className="flex gap-4">
        {/* List */}
        <div className="flex flex-col gap-1 w-48 shrink-0">
          {play.regions.length === 0 && (
            <p className="text-xs text-neutral-600 italic">No regions defined.</p>
          )}
          {play.regions
            .slice()
            .sort((a, b) => {
              const aStart = a.segments[0]?.startIndex ?? 0;
              const bStart = b.segments[0]?.startIndex ?? 0;
              return a.channelId - b.channelId || aStart - bStart;
            })
            .map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelectRegion(r.id)}
                className={
                  'flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ' +
                  (selectedRegionId === r.id
                    ? 'bg-surface-3 text-white'
                    : 'text-neutral-400 hover:bg-[#1e1e1e]')
                }
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: r.uiColor }}
                />
                <span className="truncate flex-1">{r.label}</span>
                <span className="text-xs text-neutral-600 shrink-0">CH{r.channelId}</span>
              </button>
            ))}
        </div>

        {/* Edit panel */}
        {editing && selectedRegion && (
          <div className="flex-1 bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-neutral-500 uppercase tracking-widest">Edit Region</span>
              <button
                onClick={() => deleteRegion(editing.regionId)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>

            <div>
              <label className="text-xs text-neutral-500 block mb-1">Label</label>
              <input
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                onBlur={() => commitEdit()}
                className="w-full bg-surface-3 rounded px-3 py-1.5 text-sm text-neutral-200 outline-none focus:ring-1 ring-accent"
                autoFocus
              />
            </div>

            {/* Segment list */}
            <div>
              <label className="text-xs text-neutral-500 block mb-2">LED Segments</label>
              <div className="flex flex-col gap-1.5">
                {editing.segments.map((seg, si) => {
                  const ch = channels.find((c) => c.id === selectedRegion.channelId);
                  const ledCount = (ch?.ledCount ?? 500) - 1;
                  return (
                    <div key={si} className="flex items-center gap-2">
                      <span className="text-xs text-neutral-600 w-4 shrink-0">{si + 1}</span>
                      <input
                        type="number"
                        min={0}
                        max={seg.endIndex}
                        value={seg.startIndex}
                        onChange={(e) => updateSegment(si, { startIndex: Number(e.target.value) })}
                        onBlur={() => commitEdit()}
                        className="w-20 bg-surface-3 rounded px-2 py-1 text-sm font-mono text-neutral-200 outline-none focus:ring-1 ring-accent"
                        title="Start LED (0-based)"
                      />
                      <span className="text-xs text-neutral-600">–</span>
                      <input
                        type="number"
                        min={seg.startIndex}
                        max={ledCount}
                        value={seg.endIndex}
                        onChange={(e) => updateSegment(si, { endIndex: Number(e.target.value) })}
                        onBlur={() => commitEdit()}
                        className="w-20 bg-surface-3 rounded px-2 py-1 text-sm font-mono text-neutral-200 outline-none focus:ring-1 ring-accent"
                        title="End LED (inclusive)"
                      />
                      <span className="text-xs text-neutral-700 shrink-0">
                        {seg.endIndex - seg.startIndex + 1} LEDs
                      </span>
                      {editing.segments.length > 1 && (
                        <button
                          onClick={() => removeSegment(si)}
                          className="text-neutral-600 hover:text-red-400 text-sm transition-colors ml-auto"
                          title="Remove segment"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={addSegment}
                className="mt-2 text-xs text-accent hover:text-[#818cf8] transition-colors"
              >
                + Add segment
              </button>
            </div>

            <div>
              <label className="text-xs text-neutral-500 block mb-1">Editor colour</label>
              <div className="flex gap-2 flex-wrap">
                {SWATCH_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => commitEdit({ uiColor: c })}
                    className="w-6 h-6 rounded transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: editing.uiColor === c ? `2px solid white` : undefined,
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="text-xs text-neutral-600 font-mono">
              CH{selectedRegion.channelId} · {editing.segments.length} segment{editing.segments.length !== 1 ? 's' : ''} · {totalLeds} LEDs total
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { Region, ChannelId, Play } from '../../types';
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
  startIndex: number;
  endIndex: number;
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
      startIndex: region.startIndex,
      endIndex: region.endIndex,
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
      startIndex,
      endIndex,
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
        ? { ...r, label: state.label, startIndex: state.startIndex, endIndex: state.endIndex, uiColor: state.uiColor }
        : r
    );
    onUpdateRegions(updated);
    // Panel stays open — it closes only when a different region is selected or deleted.
  }

  function deleteRegion(id: string) {
    onUpdateRegions(play.regions.filter((r) => r.id !== id));
    setSelectedRegionId(null);
    setEditing(null);
  }

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
            .sort((a, b) => a.channelId - b.channelId || a.startIndex - b.startIndex)
            .map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelectRegion(r.id)}
                className={
                  'flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ' +
                  (selectedRegionId === r.id
                    ? 'bg-[#2e2e2e] text-white'
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
          <div className="flex-1 bg-[#1a1a1a] rounded-lg p-4 flex flex-col gap-3">
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
                className="w-full bg-[#2e2e2e] rounded px-3 py-1.5 text-sm text-neutral-200 outline-none focus:ring-1 ring-[#646cff]"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">
                  Start LED <span className="text-neutral-700">(0-based)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={editing.endIndex}
                  value={editing.startIndex}
                  onChange={(e) => setEditing({ ...editing, startIndex: Number(e.target.value) })}
                  onBlur={() => commitEdit()}
                  className="w-full bg-[#2e2e2e] rounded px-3 py-1.5 text-sm font-mono text-neutral-200 outline-none focus:ring-1 ring-[#646cff]"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">
                  End LED <span className="text-neutral-700">(inclusive)</span>
                </label>
                <input
                  type="number"
                  min={editing.startIndex}
                  max={(channels.find((ch) => ch.id === selectedRegion.channelId)?.ledCount ?? 500) - 1}
                  value={editing.endIndex}
                  onChange={(e) => setEditing({ ...editing, endIndex: Number(e.target.value) })}
                  onBlur={() => commitEdit()}
                  className="w-full bg-[#2e2e2e] rounded px-3 py-1.5 text-sm font-mono text-neutral-200 outline-none focus:ring-1 ring-[#646cff]"
                />
              </div>
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
              CH{selectedRegion.channelId} · LEDs {editing.startIndex}–{editing.endIndex} · {editing.endIndex - editing.startIndex + 1} LEDs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

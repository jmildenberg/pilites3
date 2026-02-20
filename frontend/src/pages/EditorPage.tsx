import { useState } from 'react';
import type { Play, Cue, Region, RegionCueState, Effect } from '../types';
import { EFFECT_DEFAULTS } from '../types';
import { RegionManager } from '../components/regions/RegionManager';
import { EffectEditor } from '../components/effects/EffectEditor';
import { resolveStageState, ownedRegionIds } from '../lib/stageState';
import { usePlays } from '../context/PlaysContext';

// ─── RegionRow ────────────────────────────────────────────────────────────────

function RegionRow({
  region,
  ownedState,
  trackedState,
  onCapture,
  onRelease,
  onOff,
  onChange,
}: {
  region: Region;
  ownedState: RegionCueState | null;
  trackedState: RegionCueState;
  onCapture: () => void;
  onRelease: () => void;
  onOff: () => void;
  onChange: (patch: Partial<RegionCueState>) => void;
}) {
  const isOwned = ownedState !== null;
  const displayState = ownedState ?? trackedState;
  const isExplicitlyOff =
    isOwned && displayState.effect.type === 'solid' && displayState.effect.brightness === 0;

  return (
    <div
      className={
        'rounded-lg p-3 mb-2 flex flex-col gap-3 border transition-all ' +
        (isOwned ? 'bg-[#1a1a1a] border-[#2e2e2e]' : 'bg-[#141414] border-[#222] opacity-60')
      }
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: region.uiColor }} />
        <span className={`text-sm font-medium flex-1 ${isOwned ? 'text-neutral-200' : 'text-neutral-500'}`}>
          {region.label}
        </span>
        <span className="text-xs text-neutral-700 font-mono">
          CH{region.channelId} · {region.startIndex}–{region.endIndex}
        </span>

        {/* Badges */}
        <button
          onClick={onOff}
          title={isOwned ? 'Set to off (brightness 0)' : 'Capture and set off'}
          className={
            'text-xs px-1.5 py-0.5 rounded font-mono transition-colors ' +
            (isExplicitlyOff
              ? 'bg-red-900/40 text-red-400'
              : 'bg-[#2e2e2e] text-neutral-600 hover:bg-red-900/30 hover:text-red-400')
          }
        >
          OFF
        </button>
        {isOwned ? (
          <button
            onClick={onRelease}
            title="Release to tracking"
            className="text-xs px-1.5 py-0.5 rounded bg-[#646cff]/20 text-[#646cff] hover:bg-red-900/30 hover:text-red-400 transition-colors font-mono"
          >
            OWN
          </button>
        ) : (
          <button
            onClick={onCapture}
            title="Capture — take ownership"
            className="text-xs px-1.5 py-0.5 rounded bg-[#2e2e2e] text-neutral-500 hover:bg-[#646cff]/20 hover:text-[#646cff] transition-colors font-mono"
          >
            T
          </button>
        )}
      </div>

      {/* Fade time */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-neutral-600 w-20 shrink-0">Fade in (s)</label>
        <input
          type="number" min={0} step={0.5} value={displayState.fadeTime}
          onChange={(e) => onChange({ fadeTime: Number(e.target.value) })}
          disabled={!isOwned}
          className="w-20 bg-[#0f0f0f] rounded px-2 py-1 text-sm font-mono text-neutral-300 outline-none focus:ring-1 ring-[#646cff] disabled:text-neutral-600"
        />
        {!isOwned && <span className="text-xs text-neutral-700 italic">tracking</span>}
      </div>

      {/* Effect editor */}
      <EffectEditor
        effect={displayState.effect}
        onChange={(effect) => onChange({ effect })}
        disabled={!isOwned}
      />
    </div>
  );
}

// ─── CueDetailPanel ───────────────────────────────────────────────────────────

function CueDetailPanel({
  cue, cueIndex, allCues, regions, onChange, onDelete,
}: {
  cue: Cue; cueIndex: number; allCues: Cue[]; regions: Region[];
  onChange: (updated: Cue) => void;
  onDelete: () => void;
}) {
  const owned = ownedRegionIds(cue);
  const resolved = resolveStageState(allCues, regions, cueIndex);

  function updateField(field: 'label' | 'number' | 'notes', value: string) {
    onChange({ ...cue, [field]: value });
  }

  function captureRegion(regionId: string) {
    const inherited = resolved.get(regionId)?.state;
    const newState: RegionCueState = inherited
      ? { ...inherited, regionId }
      : { regionId, fadeTime: 3, effect: { ...EFFECT_DEFAULTS.solid } };
    onChange({ ...cue, regionStates: [...cue.regionStates, newState] });
  }

  function releaseRegion(regionId: string) {
    onChange({ ...cue, regionStates: cue.regionStates.filter((rs) => rs.regionId !== regionId) });
  }

  function offRegion(regionId: string) {
    const offEffect: Effect = { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 };
    if (owned.has(regionId)) {
      onChange({
        ...cue,
        regionStates: cue.regionStates.map((rs) =>
          rs.regionId === regionId ? { ...rs, effect: offEffect } : rs
        ),
      });
    } else {
      const inherited = resolved.get(regionId)?.state;
      onChange({
        ...cue,
        regionStates: [...cue.regionStates, { regionId, fadeTime: inherited?.fadeTime ?? 3, effect: offEffect }],
      });
    }
  }

  function patchRegionState(regionId: string, patch: Partial<RegionCueState>) {
    onChange({
      ...cue,
      regionStates: cue.regionStates.map((rs) =>
        rs.regionId === regionId ? { ...rs, ...patch } : rs
      ),
    });
  }

  const ownedCount = owned.size;
  const trackingCount = regions.length - ownedCount;

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500 uppercase tracking-widest">Cue {cue.number}</span>
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-400 transition-colors"
        >
          Delete
        </button>
      </div>
      <div className="grid grid-cols-[4rem_1fr] gap-2">
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Q#</label>
          <input value={cue.number} onChange={(e) => updateField('number', e.target.value)}
            className="w-full bg-[#2e2e2e] rounded px-2 py-1.5 text-sm font-mono text-neutral-200 outline-none focus:ring-1 ring-[#646cff]" />
        </div>
        <div>
          <label className="text-xs text-neutral-500 block mb-1">Label</label>
          <input value={cue.label} onChange={(e) => updateField('label', e.target.value)}
            className="w-full bg-[#2e2e2e] rounded px-2 py-1.5 text-sm text-neutral-200 outline-none focus:ring-1 ring-[#646cff]" />
        </div>
      </div>

      <div>
        <label className="text-xs text-neutral-500 block mb-1">Notes</label>
        <textarea value={cue.notes} onChange={(e) => updateField('notes', e.target.value)} rows={2}
          className="w-full bg-[#2e2e2e] rounded px-2 py-1.5 text-sm text-neutral-200 outline-none focus:ring-1 ring-[#646cff] resize-none" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-neutral-500 uppercase tracking-widest">Regions</p>
          <span className="text-xs text-neutral-600 font-mono">
            {ownedCount} owned · {trackingCount} tracking
          </span>
        </div>

        {regions.length === 0 && (
          <p className="text-xs text-neutral-600 italic">Define regions in the Regions tab first.</p>
        )}

        {regions
          .slice()
          .sort((a, b) => a.channelId - b.channelId || a.startIndex - b.startIndex)
          .map((region) => {
            const ownedState = cue.regionStates.find((rs) => rs.regionId === region.id) ?? null;
            const resolvedEntry = resolved.get(region.id);
            const trackedState = resolvedEntry?.state
              ?? { regionId: region.id, fadeTime: 3, effect: { ...EFFECT_DEFAULTS.solid, brightness: 0 } };

            return (
              <RegionRow
                key={region.id}
                region={region}
                ownedState={ownedState}
                trackedState={trackedState}
                onCapture={() => captureRegion(region.id)}
                onRelease={() => releaseRegion(region.id)}
                onOff={() => offRegion(region.id)}
                onChange={(patch) => patchRegionState(region.id, patch)}
              />
            );
          })}
      </div>
    </div>
  );
}

// ─── EditorPage ───────────────────────────────────────────────────────────────

type Tab = 'regions' | 'cues';

export function EditorPage() {
  const { plays, setPlays, selectedPlayId, setSelectedPlayId } = usePlays();
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('regions');
  const [pendingDeletePlayId, setPendingDeletePlayId] = useState<string | null>(null);

  const selectedPlay = plays.find((p) => p.id === selectedPlayId) ?? plays[0];
  const selectedCueIndex = selectedPlay.cues.findIndex((c) => c.id === selectedCueId);
  const selectedCue = selectedCueIndex >= 0 ? selectedPlay.cues[selectedCueIndex] : null;

  function updatePlay(patch: Partial<Play>) {
    setPlays((prev) => prev.map((p) => (p.id === selectedPlayId ? { ...p, ...patch } : p)));
  }

  function updateCue(updated: Cue) {
    updatePlay({ cues: selectedPlay.cues.map((c) => (c.id === updated.id ? updated : c)) });
  }

  function deleteCue(id: string) {
    updatePlay({ cues: selectedPlay.cues.filter((c) => c.id !== id) });
    setSelectedCueId(null);
  }

  function deletePlay(id: string) {
    if (plays.length <= 1) return;
    const remaining = plays.filter((p) => p.id !== id);
    setPlays(remaining);
    if (selectedPlayId === id) {
      setSelectedPlayId(remaining[0].id);
      setSelectedCueId(null);
    }
    setPendingDeletePlayId(null);
  }

  function addPlay() {
    const newPlay: Play = {
      id: crypto.randomUUID(),
      title: 'New Show',
      description: '',
      regions: [],
      cues: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPlays((prev) => [...prev, newPlay]);
    setSelectedPlayId(newPlay.id);
    setSelectedCueId(null);
    setTab('regions');
  }

  function addCue() {
    const nums = selectedPlay.cues.map((c) => parseFloat(c.number)).filter(isFinite);
    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    const newCue: Cue = {
      id: crypto.randomUUID(),
      number: String(nextNum),
      label: 'New Cue',
      notes: '',
      regionStates: [],
    };
    updatePlay({ cues: [...selectedPlay.cues, newCue] });
    setSelectedCueId(newCue.id);
    setTab('cues');
  }

  return (
    <div className="flex h-full">
      {/* Play list */}
      <div className="w-44 border-r border-[#2e2e2e] flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 h-10 border-b border-[#2e2e2e] shrink-0">
          <span className="text-xs text-neutral-500 uppercase tracking-widest">Plays</span>
          <button onClick={addPlay} className="text-[#646cff] text-xl leading-none pb-0.5">+</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {plays.map((play) => {
            const isPendingDelete = pendingDeletePlayId === play.id;
            return (
              <div
                key={play.id}
                className={
                  'group flex items-center border-b border-[#2e2e2e] transition-colors ' +
                  (selectedPlayId === play.id ? 'bg-[#646cff]/20' : 'hover:bg-[#2e2e2e]')
                }
              >
                <button
                  onClick={() => { setSelectedPlayId(play.id); setSelectedCueId(null); setPendingDeletePlayId(null); }}
                  className={
                    'flex-1 text-left px-3 py-2.5 text-sm truncate ' +
                    (selectedPlayId === play.id ? 'text-[#646cff]' : 'text-neutral-300')
                  }
                >
                  {play.title}
                </button>
                {plays.length > 1 && (
                  isPendingDelete ? (
                    <div className="flex items-center gap-1 pr-1.5 shrink-0">
                      <button
                        onClick={() => deletePlay(play.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 hover:bg-red-800 transition-colors font-semibold"
                      >
                        Delete?
                      </button>
                      <button
                        onClick={() => setPendingDeletePlayId(null)}
                        className="text-[10px] px-1 py-0.5 rounded text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDeletePlayId(play.id); }}
                      className="opacity-0 group-hover:opacity-100 pr-2.5 text-neutral-600 hover:text-red-400 transition-all text-sm shrink-0"
                      title="Delete show"
                    >
                      ×
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-3 pb-0 border-b border-[#2e2e2e] shrink-0">
          <input
            key={selectedPlay.id}
            defaultValue={selectedPlay.title}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title && title !== selectedPlay.title) updatePlay({ title });
              else e.target.value = selectedPlay.title;
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="text-base font-semibold mb-3 bg-transparent outline-none w-full text-neutral-100 border-b border-transparent focus:border-[#646cff] transition-colors"
          />
          <div className="flex gap-1">
            {(['regions', 'cues'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={
                  'px-4 py-1.5 text-xs font-semibold uppercase tracking-widest rounded-t transition-colors ' +
                  (tab === t ? 'bg-[#2e2e2e] text-white border-b-2 border-[#646cff]' : 'text-neutral-500 hover:text-neutral-300')
                }
              >{t}</button>
            ))}
          </div>
        </div>

        {tab === 'regions' && (
          <div className="flex-1 overflow-y-auto p-4">
            <RegionManager play={selectedPlay} onUpdateRegions={(regions) => updatePlay({ regions })} />
          </div>
        )}

        {tab === 'cues' && (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-52 border-r border-[#2e2e2e] flex flex-col shrink-0">
              <div className="flex items-center justify-between px-3 h-9 border-b border-[#2e2e2e] shrink-0">
                <span className="text-xs text-neutral-500 uppercase tracking-widest">Cues</span>
                <button onClick={addCue} className="text-[#646cff] text-xl leading-none pb-0.5">+</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedPlay.cues.map((cue) => {
                  const ownCount = cue.regionStates.length;
                  const trackCount = selectedPlay.regions.length - ownCount;
                  // Collect unique effect types this cue owns
                  const effectTypes = [...new Set(cue.regionStates.map((rs) => rs.effect.type))];
                  return (
                    <button key={cue.id} onClick={() => setSelectedCueId(cue.id)}
                      className={
                        'w-full text-left px-3 py-2.5 border-b border-[#2e2e2e] flex flex-col gap-0.5 transition-colors ' +
                        (selectedCueId === cue.id ? 'bg-[#646cff]/20' : 'hover:bg-[#2e2e2e]')
                      }
                    >
                      <div className="flex gap-3 items-baseline">
                        <span className={`font-mono text-xs shrink-0 w-6 ${selectedCueId === cue.id ? 'text-[#646cff]' : 'text-neutral-500'}`}>{cue.number}</span>
                        <span className={`text-sm truncate ${selectedCueId === cue.id ? 'text-[#646cff]' : 'text-neutral-300'}`}>{cue.label}</span>
                      </div>
                      <div className="flex items-center gap-2 pl-9">
                        <span className="text-xs text-neutral-600">
                          {ownCount > 0 && `${ownCount} owned`}
                          {trackCount > 0 && <span className="italic text-neutral-700"> · {trackCount} T</span>}
                        </span>
                        <div className="flex gap-1">
                          {effectTypes.map((t) => (
                            <span key={t} className="text-[10px] px-1 rounded bg-[#2e2e2e] text-neutral-500 font-mono">{t}</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {selectedCue && selectedCueIndex >= 0 ? (
                <CueDetailPanel
                  cue={selectedCue} cueIndex={selectedCueIndex}
                  allCues={selectedPlay.cues} regions={selectedPlay.regions}
                  onChange={updateCue}
                  onDelete={() => deleteCue(selectedCue.id)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
                  Select a cue to edit
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

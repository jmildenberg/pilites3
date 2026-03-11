import { useState, useEffect, useRef } from 'react';
import type { Play, Cue, Region, RegionCueState, RegionGroup, Effect } from '../types';
import { EFFECT_DEFAULTS } from '../types';
import { RegionManager } from '../components/regions/RegionManager';
import { GroupManager } from '../components/regions/GroupManager';
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

// ─── GroupRow ─────────────────────────────────────────────────────────────────

function GroupRow({
  group, memberCount, ownedState, trackedState, onCapture, onRelease, onOff, onChange, conflictWith,
}: {
  group: RegionGroup;
  memberCount: number;
  ownedState: RegionCueState | null;
  trackedState: RegionCueState;
  onCapture: () => void;
  onRelease: () => void;
  onOff: () => void;
  onChange: (patch: Partial<RegionCueState>) => void;
  conflictWith?: string; // label of the group that conflicts
}) {
  const isOwned = ownedState !== null;
  const displayState = ownedState ?? trackedState;
  const isExplicitlyOff =
    isOwned &&
    displayState.effect.type === 'solid' &&
    (displayState.effect as { brightness: number }).brightness === 0;

  return (
    <div className={
      'border rounded-lg p-3 flex flex-col gap-2 mb-2 ' +
      (conflictWith && !isOwned ? 'border-amber-900/40 opacity-60' : 'border-[#646cff]/20')
    }>
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-200 font-medium flex-1 truncate">{group.label}</span>
        <span className="text-xs text-neutral-600 shrink-0">{memberCount} regions</span>
        {conflictWith && !isOwned ? (
          <span
            className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-500 font-mono shrink-0"
            title={`Shares regions with active group "${conflictWith}"`}
          >
            CONFLICT
          </span>
        ) : (
          <>
            <button
              onClick={onOff}
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
                className="text-xs px-1.5 py-0.5 rounded bg-[#646cff]/20 text-[#646cff] hover:bg-red-900/30 hover:text-red-400 transition-colors font-mono"
              >
                GRP
              </button>
            ) : (
              <button
                onClick={onCapture}
                className="text-xs px-1.5 py-0.5 rounded bg-[#2e2e2e] text-neutral-500 hover:bg-[#646cff]/20 hover:text-[#646cff] transition-colors font-mono"
              >
                T
              </button>
            )}
          </>
        )}
      </div>

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
  cue, cueIndex, allCues, regions, regionGroups, onChange, onDelete,
}: {
  cue: Cue; cueIndex: number; allCues: Cue[]; regions: Region[]; regionGroups: RegionGroup[];
  onChange: (updated: Cue) => void;
  onDelete: () => void;
}) {
  const owned = ownedRegionIds(cue, regionGroups);
  const resolved = resolveStageState(allCues, regions, cueIndex, regionGroups);

  // Map of regionId → groupId for regions currently owned via a group entry in this cue
  const groupedRegionIds = new Map<string, string>();
  for (const rs of cue.regionStates) {
    if (rs.groupId) {
      const group = regionGroups.find((g) => g.id === rs.groupId);
      group?.regionIds.forEach((rid) => groupedRegionIds.set(rid, rs.groupId!));
    }
  }

  function updateField(field: 'label' | 'number' | 'notes', value: string) {
    onChange({ ...cue, [field]: value });
  }

  // ── Group helpers ────────────────────────────────────────────────────────────

  function captureGroup(groupId: string) {
    const group = regionGroups.find((g) => g.id === groupId);
    const firstMemberId = group?.regionIds[0];
    const inherited = firstMemberId ? resolved.get(firstMemberId)?.state : undefined;
    const newState: RegionCueState = inherited
      ? { groupId, fadeTime: inherited.fadeTime, effect: inherited.effect }
      : { groupId, fadeTime: 3, effect: { ...EFFECT_DEFAULTS.solid } };
    onChange({ ...cue, regionStates: [...cue.regionStates, newState] });
  }

  function releaseGroup(groupId: string) {
    onChange({ ...cue, regionStates: cue.regionStates.filter((rs) => rs.groupId !== groupId) });
  }

  function offGroup(groupId: string) {
    const offEffect: Effect = { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 };
    const existing = cue.regionStates.find((rs) => rs.groupId === groupId);
    if (existing) {
      onChange({ ...cue, regionStates: cue.regionStates.map((rs) => rs.groupId === groupId ? { ...rs, effect: offEffect } : rs) });
    } else {
      const group = regionGroups.find((g) => g.id === groupId);
      const firstMemberId = group?.regionIds[0];
      const inherited = firstMemberId ? resolved.get(firstMemberId)?.state : undefined;
      onChange({ ...cue, regionStates: [...cue.regionStates, { groupId, fadeTime: inherited?.fadeTime ?? 3, effect: offEffect }] });
    }
  }

  function patchGroupState(groupId: string, patch: Partial<RegionCueState>) {
    onChange({ ...cue, regionStates: cue.regionStates.map((rs) => rs.groupId === groupId ? { ...rs, ...patch } : rs) });
  }

  // ── Region helpers ────────────────────────────────────────────────────────────

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
    if (owned.has(regionId) && !groupedRegionIds.has(regionId)) {
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
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-400 transition-colors">
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

      {/* Groups section */}
      {regionGroups.length > 0 && (
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Groups</p>
          {regionGroups.map((group) => {
            const ownedState = cue.regionStates.find((rs) => rs.groupId === group.id) ?? null;
            const firstMemberId = group.regionIds[0];
            const trackedState = firstMemberId
              ? (resolved.get(firstMemberId)?.state ?? { groupId: group.id, fadeTime: 0, effect: { ...EFFECT_DEFAULTS.solid, brightness: 0 } })
              : { groupId: group.id, fadeTime: 0, effect: { ...EFFECT_DEFAULTS.solid, brightness: 0 } };
            const memberCount = group.regionIds.filter((id) => regions.some((r) => r.id === id)).length;

            // Detect if any member region is already owned by a different active group
            let conflictWith: string | undefined;
            if (!ownedState) {
              for (const rid of group.regionIds) {
                const owningGroupId = groupedRegionIds.get(rid);
                if (owningGroupId && owningGroupId !== group.id) {
                  conflictWith = regionGroups.find((g) => g.id === owningGroupId)?.label;
                  break;
                }
              }
            }

            return (
              <GroupRow
                key={group.id}
                group={group}
                memberCount={memberCount}
                ownedState={ownedState}
                trackedState={trackedState}
                conflictWith={conflictWith}
                onCapture={() => captureGroup(group.id)}
                onRelease={() => releaseGroup(group.id)}
                onOff={() => offGroup(group.id)}
                onChange={(patch) => patchGroupState(group.id, patch)}
              />
            );
          })}
        </div>
      )}

      {/* Regions section */}
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
            // If this region is owned via a group entry, show a read-only badge row
            const owningGroupId = groupedRegionIds.get(region.id);
            if (owningGroupId) {
              const owningGroup = regionGroups.find((g) => g.id === owningGroupId);
              return (
                <div
                  key={region.id}
                  className="flex items-center gap-2 px-3 py-2 mb-1 rounded border border-[#2e2e2e]/50 opacity-50"
                >
                  <span className="text-sm text-neutral-400 flex-1 truncate">{region.label}</span>
                  <span className="text-xs text-neutral-600 shrink-0">CH{region.channelId}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[#646cff]/10 text-[#646cff]/70 font-mono shrink-0">
                    {owningGroup?.label ?? 'group'}
                  </span>
                </div>
              );
            }

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

type Tab = 'regions' | 'groups' | 'cues';

const DEBOUNCE_MS = 600;

export function EditorPage() {
  const {
    plays, loading, error,
    selectedPlayId, setSelectedPlayId,
    createPlay: apiCreatePlay,
    updatePlay: apiUpdatePlay,
    deletePlay: apiDeletePlay,
  } = usePlays();
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('regions');
  const [pendingDeletePlayId, setPendingDeletePlayId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Local editing state — updated immediately on every change for a responsive UI.
  // API saves are debounced so rapid keystrokes/slider drags don't hammer the backend.
  const [localPlay, setLocalPlay] = useState<Play | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlayRef = useRef<Play | null>(null);
  const prevPlayIdRef = useRef<string | undefined>(undefined);

  const selectedPlay = plays.find((p) => p.id === selectedPlayId) ?? plays[0];

  // When the active play changes (different ID or first load), sync localPlay from server state.
  // Any in-flight debounce for the previous play is left to fire naturally — its timer captures
  // the correct data and will save to the old play ID without affecting the new selection.
  useEffect(() => {
    if (!selectedPlay) return;
    if (selectedPlay.id === prevPlayIdRef.current) return;
    prevPlayIdRef.current = selectedPlay.id;
    setLocalPlay(selectedPlay);
  }, [selectedPlay]); // runs when selectedPlay reference changes (new ID or first load)

  // displayPlay is the source of truth for the edit UI; localPlay leads, server state fallbacks.
  const displayPlay = localPlay ?? selectedPlay;

  const selectedCueIndex = displayPlay?.cues.findIndex((c) => c.id === selectedCueId) ?? -1;
  const selectedCue = (displayPlay && selectedCueIndex >= 0) ? displayPlay.cues[selectedCueIndex] : null;

  // ── Edit helpers ────────────────────────────────────────────────────────────

  /** Apply a patch to the local play state and schedule (or immediately fire) an API save. */
  function editPlay(patch: Partial<Play>, immediate = false) {
    const base = displayPlay;
    if (!base) return;
    const updated: Play = { ...base, ...patch };
    setLocalPlay(updated);

    if (immediate) {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      pendingPlayRef.current = null;
      void apiUpdatePlay(updated.id, updated);
    } else {
      pendingPlayRef.current = updated;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const toSave = pendingPlayRef.current;
        pendingPlayRef.current = null;
        if (toSave) void apiUpdatePlay(toSave.id, toSave);
      }, DEBOUNCE_MS);
    }
  }

  function updateCue(updated: Cue) {
    if (!displayPlay) return;
    editPlay({ cues: displayPlay.cues.map((c) => (c.id === updated.id ? updated : c)) });
  }

  function deleteCue(id: string) {
    if (!displayPlay) return;
    editPlay({ cues: displayPlay.cues.filter((c) => c.id !== id) }, true);
    setSelectedCueId(null);
  }

  async function handleDeletePlay(id: string) {
    if (plays.length <= 1) return;
    // Cancel any pending debounced save for the play being deleted.
    if (debounceRef.current && pendingPlayRef.current?.id === id) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      pendingPlayRef.current = null;
    }
    const remaining = plays.filter((p) => p.id !== id);
    await apiDeletePlay(id);
    if (selectedPlayId === id) {
      setSelectedPlayId(remaining[0].id);
      setSelectedCueId(null);
    }
    setPendingDeletePlayId(null);
  }

  async function addPlay() {
    setMutationError(null);
    try {
      const newPlay: Play = {
        id: crypto.randomUUID(),
        title: 'New Show',
        description: '',
        regions: [],
        cues: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const created = await apiCreatePlay(newPlay);
      setSelectedPlayId(created.id);
      setSelectedCueId(null);
      setTab('regions');
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Failed to create show');
    }
  }

  function addCue(afterIndex?: number) {
    if (!displayPlay) return;
    const insertAfter = afterIndex ?? (selectedCueIndex >= 0 ? selectedCueIndex : displayPlay.cues.length - 1);
    const cues = displayPlay.cues;
    let nextNum: number;
    if (cues.length === 0) {
      nextNum = 1;
    } else if (insertAfter >= cues.length - 1) {
      const nums = cues.map((c) => parseFloat(c.number)).filter(isFinite);
      nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    } else {
      const a = parseFloat(cues[insertAfter]?.number ?? '0');
      const b = parseFloat(cues[insertAfter + 1]?.number ?? '0');
      nextNum = isFinite(a) && isFinite(b) ? (a + b) / 2 : Math.max(...cues.map((c) => parseFloat(c.number)).filter(isFinite)) + 1;
    }
    const newCue: Cue = {
      id: crypto.randomUUID(),
      number: String(nextNum),
      label: 'New Cue',
      notes: '',
      regionStates: [],
    };
    const newCues = [...cues];
    newCues.splice(insertAfter + 1, 0, newCue);
    editPlay({ cues: newCues }, true);
    setSelectedCueId(newCue.id);
    setTab('cues');
  }

  function moveCue(fromIndex: number, toIndex: number) {
    if (!displayPlay || fromIndex === toIndex) return;
    const cues = [...displayPlay.cues];
    const [moved] = cues.splice(fromIndex, 1);
    cues.splice(toIndex, 0, moved);
    editPlay({ cues }, true);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-neutral-600 text-sm">Loading shows…</div>
  );
  if (error && plays.length === 0) return (
    <div className="flex items-center justify-center h-full text-red-500 text-sm">
      Cannot reach backend: {error}
    </div>
  );
  return (
    <div className="flex h-full">
      {/* Play list */}
      <div className="w-44 border-r border-[#2e2e2e] flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 h-10 border-b border-[#2e2e2e] shrink-0">
          <span className="text-xs text-neutral-500 uppercase tracking-widest">Plays</span>
          <button onClick={addPlay} className="text-[#646cff] text-xl leading-none pb-0.5">+</button>
        </div>
        {mutationError && (
          <div className="px-2 py-1.5 text-[11px] text-red-400 bg-red-950/40 border-b border-red-900/40 leading-snug">
            {mutationError}
          </div>
        )}
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
                        onClick={() => handleDeletePlay(play.id)}
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
      {!displayPlay ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-600 text-sm">
          <span>No shows yet.</span>
          <button
            onClick={addPlay}
            className="px-4 py-2 rounded bg-[#646cff] text-white text-sm font-medium hover:bg-[#535bdd] transition-colors"
          >
            + Create Show
          </button>
        </div>
      ) : (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-3 pb-0 border-b border-[#2e2e2e] shrink-0">
          <input
            key={displayPlay.id}
            defaultValue={displayPlay.title}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title && title !== displayPlay.title) editPlay({ title });
              else e.target.value = displayPlay.title;
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="text-base font-semibold mb-3 bg-transparent outline-none w-full text-neutral-100 border-b border-transparent focus:border-[#646cff] transition-colors"
          />
          <div className="flex gap-1">
            {(['regions', 'groups', 'cues'] as Tab[]).map((t) => (
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
            <RegionManager play={displayPlay} onUpdateRegions={(regions) => editPlay({ regions })} />
          </div>
        )}

        {tab === 'groups' && (
          <div className="flex-1 overflow-y-auto p-4">
            <GroupManager play={displayPlay} onUpdateGroups={(regionGroups) => editPlay({ regionGroups })} />
          </div>
        )}

        {tab === 'cues' && (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-52 border-r border-[#2e2e2e] flex flex-col shrink-0">
              <div className="flex items-center justify-between px-3 h-9 border-b border-[#2e2e2e] shrink-0">
                <span className="text-xs text-neutral-500 uppercase tracking-widest">Cues</span>
                <button
                  onClick={() => addCue()}
                  title={selectedCueIndex >= 0 ? 'Insert cue after selected' : 'Add cue at end'}
                  className="text-[#646cff] text-xl leading-none pb-0.5"
                >+</button>
              </div>
              <div
                className="flex-1 overflow-y-auto"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndexRef.current !== null) {
                    moveCue(dragIndexRef.current, displayPlay.cues.length - 1);
                    dragIndexRef.current = null;
                  }
                  setDragOverIndex(null);
                }}
              >
                {displayPlay.cues.map((cue, i) => {
                  const ownCount = cue.regionStates.length;
                  const trackCount = displayPlay.regions.length - ownCount;
                  const effectTypes = [...new Set(cue.regionStates.map((rs) => rs.effect.type))];
                  const isSelected = selectedCueId === cue.id;
                  const isDragTarget = dragOverIndex === i && dragIndexRef.current !== null && dragIndexRef.current !== i;
                  return (
                    <div
                      key={cue.id}
                      className="relative group/cuerow"
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; dragIndexRef.current = i; }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex(i); }}
                      onDragLeave={() => setDragOverIndex(null)}
                      onDrop={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (dragIndexRef.current !== null) moveCue(dragIndexRef.current, i);
                        dragIndexRef.current = null;
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
                    >
                      {isDragTarget && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#646cff] z-10 pointer-events-none" />
                      )}
                      <button
                        onClick={() => setSelectedCueId(cue.id)}
                        className={
                          'w-full text-left px-3 py-2.5 border-b border-[#2e2e2e] flex flex-col gap-0.5 transition-colors ' +
                          (isSelected ? 'bg-[#646cff]/20' : 'hover:bg-[#2e2e2e]')
                        }
                      >
                        <div className="flex gap-2 items-baseline">
                          <span className="text-neutral-700 cursor-grab text-xs shrink-0" title="Drag to reorder">⠿</span>
                          <span className={`font-mono text-xs shrink-0 w-6 ${isSelected ? 'text-[#646cff]' : 'text-neutral-500'}`}>{cue.number}</span>
                          <span className={`text-sm truncate ${isSelected ? 'text-[#646cff]' : 'text-neutral-300'}`}>{cue.label}</span>
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
                      {/* Insert-after button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); addCue(i); }}
                        title={`Insert cue after ${cue.number}`}
                        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/cuerow:opacity-100 transition-opacity w-5 h-5 rounded-full bg-[#646cff] text-white text-xs font-bold leading-none flex items-center justify-center shadow-lg"
                      >+</button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {selectedCue && selectedCueIndex >= 0 ? (
                <CueDetailPanel
                  cue={selectedCue} cueIndex={selectedCueIndex}
                  allCues={displayPlay.cues} regions={displayPlay.regions}
                  regionGroups={displayPlay.regionGroups ?? []}
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
      )}
    </div>
  );
}

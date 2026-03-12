import { useState } from 'react';
import type { Play, RegionGroup } from '../../types';

interface Props {
  play: Play;
  onUpdateGroups: (groups: RegionGroup[]) => void;
}

export function GroupManager({ play, onUpdateGroups }: Props) {
  const groups = play.regionGroups ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  const sortedRegions = play.regions
    .slice()
    .sort((a, b) => a.channelId - b.channelId || (a.segments[0]?.startIndex ?? 0) - (b.segments[0]?.startIndex ?? 0));

  function addGroup() {
    const newGroup: RegionGroup = {
      id: crypto.randomUUID(),
      label: `Group ${groups.length + 1}`,
      regionIds: [],
    };
    onUpdateGroups([...groups, newGroup]);
    setSelectedGroupId(newGroup.id);
    setPendingDeleteId(null);
  }

  function updateLabel(groupId: string, label: string) {
    onUpdateGroups(groups.map((g) => (g.id === groupId ? { ...g, label } : g)));
  }

  function toggleRegion(groupId: string, regionId: string) {
    onUpdateGroups(
      groups.map((g) => {
        if (g.id !== groupId) return g;
        const has = g.regionIds.includes(regionId);
        return { ...g, regionIds: has ? g.regionIds.filter((id) => id !== regionId) : [...g.regionIds, regionId] };
      })
    );
  }

  function deleteGroup(groupId: string) {
    onUpdateGroups(groups.filter((g) => g.id !== groupId));
    if (selectedGroupId === groupId) setSelectedGroupId(null);
    setPendingDeleteId(null);
  }

  return (
    <div className="flex gap-4">
      {/* Group list */}
      <div className="w-48 shrink-0 flex flex-col gap-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-500 uppercase tracking-widest">Groups</span>
          <button
            onClick={addGroup}
            className="text-[#646cff] text-xl leading-none pb-0.5"
            title="New group"
          >
            +
          </button>
        </div>

        {groups.length === 0 && (
          <p className="text-xs text-neutral-600 italic">No groups yet.</p>
        )}

        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          const isPendingDelete = pendingDeleteId === group.id;
          return (
            <div
              key={group.id}
              className={
                'group flex items-center gap-1 rounded transition-colors ' +
                (isSelected ? 'bg-[#2e2e2e]' : 'hover:bg-[#1e1e1e]')
              }
            >
              <button
                onClick={() => { setSelectedGroupId(group.id); setPendingDeleteId(null); }}
                className={
                  'flex-1 text-left px-2 py-1.5 text-sm truncate ' +
                  (isSelected ? 'text-white' : 'text-neutral-400')
                }
              >
                {group.label}
                <span className="text-xs text-neutral-600 ml-1">({group.regionIds.length})</span>
              </button>

              {isPendingDelete ? (
                <div className="flex items-center gap-1 pr-1.5 shrink-0">
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 hover:bg-red-800 transition-colors font-semibold"
                  >
                    Delete?
                  </button>
                  <button
                    onClick={() => setPendingDeleteId(null)}
                    className="text-[10px] px-1 py-0.5 rounded text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setPendingDeleteId(group.id); }}
                  className="opacity-0 group-hover:opacity-100 pr-2 text-neutral-600 hover:text-red-400 transition-all text-sm shrink-0"
                  title="Delete group"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit panel */}
      {selectedGroup && (
        <div className="flex-1 bg-[#1a1a1a] rounded-lg p-4 flex flex-col gap-4">
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Group name</label>
            <input
              key={selectedGroup.id}
              defaultValue={selectedGroup.label}
              onBlur={(e) => {
                const label = e.target.value.trim();
                if (label) updateLabel(selectedGroup.id, label);
                else e.target.value = selectedGroup.label;
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-full bg-[#2e2e2e] rounded px-3 py-1.5 text-sm text-neutral-200 outline-none focus:ring-1 ring-[#646cff]"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-neutral-500 block mb-2">Member regions</label>
            {play.regions.length === 0 && (
              <p className="text-xs text-neutral-600 italic">Define regions first.</p>
            )}
            <div className="flex flex-col gap-1">
              {sortedRegions.map((region) => {
                const checked = selectedGroup.regionIds.includes(region.id);
                return (
                  <label
                    key={region.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#2e2e2e] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRegion(selectedGroup.id, region.id)}
                      className="accent-[#646cff]"
                    />
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: region.uiColor }}
                    />
                    <span className="text-sm text-neutral-300 flex-1 truncate">{region.label}</span>
                    <span className="text-xs text-neutral-600 shrink-0">CH{region.channelId}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {selectedGroup.regionIds.length > 0 && (
            <p className="text-xs text-neutral-600">
              {selectedGroup.regionIds.length} region{selectedGroup.regionIds.length !== 1 ? 's' : ''} · reference this group in a cue using its name
            </p>
          )}
        </div>
      )}
    </div>
  );
}

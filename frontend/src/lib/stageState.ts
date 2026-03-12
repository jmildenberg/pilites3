import type { Cue, Region, RegionCueState, RegionGroup, Effect } from '../types';
import { effectPeakBrightness } from '../types';

export const DARK_EFFECT: Effect = { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 };

export const DARK_STATE = (regionId: string): RegionCueState => ({
  regionId,
  fadeTime: 0,
  effect: DARK_EFFECT,
});

/**
 * For a given cue index, return the full resolved stage state — one
 * RegionCueState per region, filling in tracked values by walking backward
 * through prior cues.
 *
 * Group states are expanded: if a cue owns a region via a groupId, that group's
 * effect is applied to all regions in the group.
 *
 * Regions that have never been set by any prior cue resolve to DARK (off).
 */
export function resolveStageState(
  cues: Cue[],
  regions: Region[],
  cueIndex: number,
  regionGroups: RegionGroup[] = [],
): Map<string, { state: RegionCueState; ownedByCueIndex: number | null; sourceGroupId: string | null }> {
  const groupById = new Map(regionGroups.map((g) => [g.id, g]));
  const result = new Map<string, { state: RegionCueState; ownedByCueIndex: number | null; sourceGroupId: string | null }>();

  for (const region of regions) {
    let found: { state: RegionCueState; ownedByCueIndex: number; sourceGroupId: string | null } | null = null;
    for (let i = cueIndex; i >= 0; i--) {
      const match = cues[i].regionStates.find((rs) => {
        if (rs.regionId === region.id) return true;
        if (rs.groupId) {
          const group = groupById.get(rs.groupId);
          return group?.regionIds.includes(region.id) ?? false;
        }
        return false;
      });
      if (match) {
        // Normalise to a regionId-specific state so callers don't need to handle groupId
        const resolved: RegionCueState = match.groupId
          ? { regionId: region.id, fadeTime: match.fadeTime, effect: match.effect }
          : match;
        found = { state: resolved, ownedByCueIndex: i, sourceGroupId: match.groupId ?? null };
        break;
      }
    }
    result.set(region.id, found ?? { state: DARK_STATE(region.id), ownedByCueIndex: null, sourceGroupId: null });
  }

  return result;
}

/**
 * Which regions does this specific cue own (has explicit state for)?
 * Includes regions owned via a group.
 */
export function ownedRegionIds(cue: Cue, regionGroups: RegionGroup[] = []): Set<string> {
  const ids = new Set<string>();
  for (const rs of cue.regionStates) {
    if (rs.regionId) ids.add(rs.regionId);
    if (rs.groupId) {
      const group = regionGroups.find((g) => g.id === rs.groupId);
      group?.regionIds.forEach((id) => ids.add(id));
    }
  }
  return ids;
}

/**
 * Produce a representative brightness per region for the ShowPage live preview.
 * Animated effects (pulse, chase, etc.) return their peak brightness since
 * the actual per-frame rendering happens on the backend.
 */
export function resolveRegionLevels(
  cues: Cue[],
  regions: Region[],
  cueIndex: number,
  regionGroups: RegionGroup[] = [],
): Record<string, { effect: Effect; brightness: number }> {
  const stageState = resolveStageState(cues, regions, cueIndex, regionGroups);
  const out: Record<string, { effect: Effect; brightness: number }> = {};
  for (const region of regions) {
    const entry = stageState.get(region.id);
    if (entry) {
      out[region.id] = {
        effect: entry.state.effect,
        brightness: effectPeakBrightness(entry.state.effect),
      };
    }
  }
  return out;
}

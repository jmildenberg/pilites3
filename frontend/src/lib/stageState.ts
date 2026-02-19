import type { Cue, Region, RegionCueState, Effect } from '../types';
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
 * Regions that have never been set by any prior cue resolve to DARK (off).
 */
export function resolveStageState(
  cues: Cue[],
  regions: Region[],
  cueIndex: number,
): Map<string, { state: RegionCueState; ownedByCueIndex: number | null }> {
  const result = new Map<string, { state: RegionCueState; ownedByCueIndex: number | null }>();

  for (const region of regions) {
    let found: { state: RegionCueState; ownedByCueIndex: number } | null = null;
    for (let i = cueIndex; i >= 0; i--) {
      const state = cues[i].regionStates.find((rs) => rs.regionId === region.id);
      if (state) {
        found = { state, ownedByCueIndex: i };
        break;
      }
    }
    result.set(region.id, found ?? { state: DARK_STATE(region.id), ownedByCueIndex: null });
  }

  return result;
}

/**
 * Which regions does this specific cue own (has explicit state for)?
 */
export function ownedRegionIds(cue: Cue): Set<string> {
  return new Set(cue.regionStates.map((rs) => rs.regionId));
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
): Record<string, { effect: Effect; brightness: number }> {
  const stageState = resolveStageState(cues, regions, cueIndex);
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

import { describe, it, expect } from 'vitest';
import { resolveStageState, resolveRegionLevels, ownedRegionIds, DARK_EFFECT } from './stageState';
import type { Cue, Region } from '../types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const r1: Region = { id: 'r1', label: 'Stage Left',  channelId: 0, segments: [{ startIndex: 0,   endIndex: 149 }], uiColor: '#a855f7' };
const r2: Region = { id: 'r2', label: 'Stage Right', channelId: 0, segments: [{ startIndex: 150, endIndex: 299 }], uiColor: '#3b82f6' };
const r3: Region = { id: 'r3', label: 'Backdrop',    channelId: 1, segments: [{ startIndex: 0,   endIndex: 249 }], uiColor: '#22c55e' };
const regions = [r1, r2, r3];

const WARM_WHITE = { r: 255, g: 220, b: 180, w: 0 };
const ORANGE     = { r: 255, g: 140, b: 60,  w: 0 };
const BLACK      = { r: 0,   g: 0,   b: 0,   w: 0 };

const cues: Cue[] = [
  {
    id: 'c1', number: '1', label: 'House Full', notes: '',
    regionStates: [
      { regionId: 'r1', fadeTime: 3, effect: { type: 'solid', color: WARM_WHITE, brightness: 1 } },
      { regionId: 'r2', fadeTime: 3, effect: { type: 'solid', color: WARM_WHITE, brightness: 1 } },
      { regionId: 'r3', fadeTime: 3, effect: { type: 'solid', color: WARM_WHITE, brightness: 0.5 } },
    ],
  },
  {
    // Owns r1 + r2; r3 tracks from c1
    id: 'c2', number: '2', label: 'Scene 1', notes: '',
    regionStates: [
      { regionId: 'r1', fadeTime: 4, effect: { type: 'solid', color: ORANGE, brightness: 0.85 } },
      { regionId: 'r2', fadeTime: 4, effect: { type: 'solid', color: ORANGE, brightness: 0.75 } },
    ],
  },
  {
    // Owns nothing — all regions track
    id: 'c3', number: '3', label: 'All tracking', notes: '',
    regionStates: [],
  },
  {
    // Blackout — owns all
    id: 'c4', number: '4', label: 'Blackout', notes: '',
    regionStates: [
      { regionId: 'r1', fadeTime: 2, effect: { type: 'solid', color: BLACK, brightness: 0 } },
      { regionId: 'r2', fadeTime: 2, effect: { type: 'solid', color: BLACK, brightness: 0 } },
      { regionId: 'r3', fadeTime: 2, effect: { type: 'solid', color: BLACK, brightness: 0 } },
    ],
  },
];

// ─── resolveStageState ───────────────────────────────────────────────────────

describe('resolveStageState', () => {
  it('returns owned states for cue that owns all regions', () => {
    const result = resolveStageState(cues, regions, 0);
    expect(result.get('r1')?.state.effect).toMatchObject({ type: 'solid', brightness: 1 });
    expect(result.get('r2')?.state.effect).toMatchObject({ type: 'solid', brightness: 1 });
    expect(result.get('r3')?.state.effect).toMatchObject({ type: 'solid', brightness: 0.5 });
  });

  it('marks owned regions with the correct owning cue index', () => {
    const result = resolveStageState(cues, regions, 0);
    expect(result.get('r1')?.ownedByCueIndex).toBe(0);
    expect(result.get('r3')?.ownedByCueIndex).toBe(0);
  });

  it('tracks unowned regions backward to the last owning cue', () => {
    // Cue 1 (index 1) owns r1/r2; r3 has no state → should track from cue 0
    const result = resolveStageState(cues, regions, 1);
    expect(result.get('r3')?.ownedByCueIndex).toBe(0);
    expect(result.get('r3')?.state.effect).toMatchObject({ type: 'solid', brightness: 0.5 });
  });

  it('resolves r1 and r2 from the current cue when they are owned', () => {
    const result = resolveStageState(cues, regions, 1);
    expect(result.get('r1')?.state.effect).toMatchObject({ type: 'solid', color: ORANGE });
    expect(result.get('r2')?.state.effect).toMatchObject({ type: 'solid', color: ORANGE });
  });

  it('falls back to DARK for regions that have never been set', () => {
    // Single cue that owns nothing
    const singleCue: Cue[] = [{ id: 'x', number: '1', label: '', notes: '', regionStates: [] }];
    const result = resolveStageState(singleCue, regions, 0);
    expect(result.get('r1')?.state.effect).toEqual(DARK_EFFECT);
    expect(result.get('r1')?.ownedByCueIndex).toBeNull();
  });

  it('walks back multiple cues to find the last owner', () => {
    // cue index 2 owns nothing; r3 should trace back to cue 0
    const result = resolveStageState(cues, regions, 2);
    expect(result.get('r3')?.ownedByCueIndex).toBe(0);
  });

  it('returns the correct state for blackout cue', () => {
    const result = resolveStageState(cues, regions, 3);
    for (const id of ['r1', 'r2', 'r3']) {
      expect(result.get(id)?.state.effect).toMatchObject({ type: 'solid', brightness: 0 });
      expect(result.get(id)?.ownedByCueIndex).toBe(3);
    }
  });

  it('covers all provided regions', () => {
    const result = resolveStageState(cues, regions, 1);
    expect([...result.keys()].sort()).toEqual(['r1', 'r2', 'r3']);
  });
});

// ─── ownedRegionIds ──────────────────────────────────────────────────────────

describe('ownedRegionIds', () => {
  it('returns ids of regions with explicit state', () => {
    const owned = ownedRegionIds(cues[1]);
    expect(owned).toEqual(new Set(['r1', 'r2']));
  });

  it('returns empty set for cue with no region states', () => {
    const owned = ownedRegionIds(cues[2]);
    expect(owned).toEqual(new Set());
  });

  it('returns all region ids for cue that owns everything', () => {
    const owned = ownedRegionIds(cues[3]);
    expect(owned).toEqual(new Set(['r1', 'r2', 'r3']));
  });
});

// ─── resolveRegionLevels ─────────────────────────────────────────────────────

describe('resolveRegionLevels', () => {
  it('returns brightness 1 for fully-on solid regions', () => {
    const levels = resolveRegionLevels(cues, regions, 0);
    expect(levels['r1'].brightness).toBe(1);
    expect(levels['r2'].brightness).toBe(1);
  });

  it('returns fractional brightness for dimmed regions', () => {
    const levels = resolveRegionLevels(cues, regions, 0);
    expect(levels['r3'].brightness).toBe(0.5);
  });

  it('returns 0 brightness for blackout', () => {
    const levels = resolveRegionLevels(cues, regions, 3);
    expect(levels['r1'].brightness).toBe(0);
    expect(levels['r2'].brightness).toBe(0);
    expect(levels['r3'].brightness).toBe(0);
  });

  it('resolves tracking regions from prior cues', () => {
    // cue 1 owns r1/r2; r3 tracks cue 0 at 0.5
    const levels = resolveRegionLevels(cues, regions, 1);
    expect(levels['r3'].brightness).toBe(0.5);
  });

  it('returns the effect alongside brightness', () => {
    const levels = resolveRegionLevels(cues, regions, 1);
    expect(levels['r1'].effect.type).toBe('solid');
  });

  it('includes all regions in the output', () => {
    const levels = resolveRegionLevels(cues, regions, 2);
    expect(Object.keys(levels).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('uses peak brightness for animated effects', () => {
    const animatedCues: Cue[] = [{
      id: 'a1', number: '1', label: '', notes: '',
      regionStates: [
        { regionId: 'r1', fadeTime: 0, effect: { type: 'pulse', color: WARM_WHITE, minBrightness: 0.1, maxBrightness: 0.9, period: 2 } },
      ],
    }];
    const levels = resolveRegionLevels(animatedCues, [r1], 0);
    expect(levels['r1'].brightness).toBe(0.9); // maxBrightness
  });
});

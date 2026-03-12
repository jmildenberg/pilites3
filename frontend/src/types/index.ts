// ─── Channel ─────────────────────────────────────────────────────────────────

export type ChannelId = 0 | 1;

export interface ChannelConfig {
  id: ChannelId;
  label: string;
  ledCount: number;
  type: 'rpi' | 'wled';
  // rpi-only
  gpioPin: number;
  colorOrder: 'RGB' | 'GRB' | 'BGR';
  // wled-only
  wledHost?: string;
  wledPort?: number;
}

// ─── Colour ───────────────────────────────────────────────────────────────────

/** RGB values 0–255. W (warm white) only used on SK6812 RGBW strips. */
export interface Color {
  r: number;
  g: number;
  b: number;
  w: number;
}

export function colorToHex(c: Color): string {
  return '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hexToColor(hex: string, w = 0): Color {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, w };
}

// ─── Effects ──────────────────────────────────────────────────────────────────

/** Static single colour across the whole region. */
export interface SolidEffect {
  type: 'solid';
  color: Color;
  brightness: number; // 0–1
}

/** Smooth colour blend from one end of the region to the other. */
export interface GradientEffect {
  type: 'gradient';
  colorA: Color;
  colorB: Color;
  brightness: number; // 0–1
}

/** Full hue rainbow cycling across the region. */
export interface RainbowEffect {
  type: 'rainbow';
  brightness: number; // 0–1
  speed: number;      // hue degrees per second
}

/** Brightness breathes between min and max on a sinusoidal cycle. */
export interface PulseEffect {
  type: 'pulse';
  color: Color;
  minBrightness: number; // 0–1
  maxBrightness: number; // 0–1
  period: number;        // seconds per full cycle
}

/** Rapid on/off flashing. */
export interface StrobeEffect {
  type: 'strobe';
  color: Color;
  brightness: number; // 0–1 (on-level)
  rate: number;       // Hz
  dutyCycle: number;  // 0–1 fraction of each cycle that is on
}

/** A lit segment moves along the region. */
export interface ChaseEffect {
  type: 'chase';
  color: Color;
  backgroundColor: Color;
  pixelCount: number;            // width of the lit segment
  speed: number;                 // LEDs per second
  direction: 'forward' | 'reverse' | 'bounce';
}

/** Random pixels flicker on and off. */
export interface TwinkleEffect {
  type: 'twinkle';
  color: Color;
  brightness: number; // 0–1 peak brightness of each spark
  density: number;    // 0–1 fraction of pixels active at once
  speed: number;      // relative fade speed (1 = normal)
}

/** Procedural fire simulation. */
export interface FireEffect {
  type: 'fire';
  brightness: number; // 0–1 overall intensity scale
  cooling: number;    // 20–100 — higher = shorter flames
  sparking: number;   // 50–200 — higher = more sparks
}

export type Effect =
  | SolidEffect
  | GradientEffect
  | RainbowEffect
  | PulseEffect
  | StrobeEffect
  | ChaseEffect
  | TwinkleEffect
  | FireEffect;

export type EffectType = Effect['type'];

/** Peak / representative brightness of an effect, used for UI previews. */
export function effectPeakBrightness(e: Effect): number {
  switch (e.type) {
    case 'solid':    return e.brightness;
    case 'gradient': return e.brightness;
    case 'rainbow':  return e.brightness;
    case 'pulse':    return e.maxBrightness;
    case 'strobe':   return e.brightness;
    case 'chase':    return 0.8; // approximate
    case 'twinkle':  return e.brightness * e.density;
    case 'fire':     return e.brightness;
  }
}

/** Default parameters for each effect type. */
export const EFFECT_DEFAULTS: Record<EffectType, Effect> = {
  solid:    { type: 'solid',    color: { r: 255, g: 220, b: 180, w: 0 }, brightness: 1 },
  gradient: { type: 'gradient', colorA: { r: 255, g: 100, b: 50, w: 0 }, colorB: { r: 50, g: 100, b: 255, w: 0 }, brightness: 1 },
  rainbow:  { type: 'rainbow',  brightness: 1, speed: 30 },
  pulse:    { type: 'pulse',    color: { r: 255, g: 220, b: 180, w: 0 }, minBrightness: 0.1, maxBrightness: 1, period: 2 },
  strobe:   { type: 'strobe',   color: { r: 255, g: 255, b: 255, w: 0 }, brightness: 1, rate: 5, dutyCycle: 0.5 },
  chase:    { type: 'chase',    color: { r: 255, g: 255, b: 255, w: 0 }, backgroundColor: { r: 0, g: 0, b: 0, w: 0 }, pixelCount: 10, speed: 50, direction: 'forward' },
  twinkle:  { type: 'twinkle',  color: { r: 255, g: 255, b: 255, w: 0 }, brightness: 1, density: 0.3, speed: 1 },
  fire:     { type: 'fire',     brightness: 1, cooling: 55, sparking: 120 },
};

// ─── Region ───────────────────────────────────────────────────────────────────

/** A named, non-overlapping contiguous range of LEDs on one channel, per play. */
export interface Region {
  id: string;
  label: string;
  channelId: ChannelId;
  startIndex: number; // 0-based, inclusive
  endIndex: number;   // 0-based, inclusive
  /** Display colour for the region swatch in the editor */
  uiColor: string;    // hex e.g. "#a855f7"
}

/** A named set of regions that share the same effect in a cue. */
export interface RegionGroup {
  id: string;
  label: string;
  regionIds: string[];
}

// ─── Cue ──────────────────────────────────────────────────────────────────────

export interface RegionCueState {
  /** Set for individual region ownership. */
  regionId?: string;
  /** Set for group ownership — expanded to all group members at render time. */
  groupId?: string;
  fadeTime: number; // seconds to crossfade INTO this state
  effect: Effect;
}

export interface Cue {
  id: string;
  number: string;       // theatrical cue numbering: "1", "1.5", "2" …
  label: string;
  notes: string;
  regionStates: RegionCueState[];
  followTime?: number;  // auto-fire next cue after N seconds; undefined = manual GO
}

// ─── Scene ────────────────────────────────────────────────────────────────────

/** A named snapshot of region states that can be applied to any cue. */
export interface Scene {
  id: string;
  label: string;
  regionStates: RegionCueState[];
}

// ─── Play ─────────────────────────────────────────────────────────────────────

export interface Play {
  id: string;
  title: string;
  description: string;
  regions: Region[];
  regionGroups?: RegionGroup[]; // optional; defaults to [] for shows without groups
  palette?: Color[];            // user-defined colour palette for this show
  cues: Cue[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Build the full colour palette for a play: custom colours first (in defined order),
 * then any additional colours detected from cue effects, deduped by hex.
 */
export function extractPlayColors(play: Play): Color[] {
  const seen = new Map<string, Color>();
  function add(c: Color) { const h = colorToHex(c); if (!seen.has(h)) seen.set(h, c); }
  for (const c of play.palette ?? []) add(c);
  for (const cue of play.cues) {
    for (const rs of cue.regionStates) {
      const e = rs.effect;
      if ('color' in e) add(e.color);
      if ('colorA' in e) add((e as GradientEffect).colorA);
      if ('colorB' in e) add((e as GradientEffect).colorB);
      if ('backgroundColor' in e) add((e as ChaseEffect).backgroundColor);
    }
  }
  return Array.from(seen.values());
}

// ─── Playback state (runtime, from WebSocket) ─────────────────────────────────

export type PlaybackStatus = 'idle' | 'running' | 'fading' | 'paused';

export interface PlaybackState {
  playId: string | null;
  currentCueIndex: number | null;
  status: PlaybackStatus;
}

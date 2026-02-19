import { describe, it, expect } from 'vitest';
import { colorToHex, hexToColor, effectPeakBrightness } from './index';
import type { Effect } from './index';

// ─── colorToHex ───────────────────────────────────────────────────────────────

describe('colorToHex', () => {
  it('converts pure red', () => {
    expect(colorToHex({ r: 255, g: 0, b: 0, w: 0 })).toBe('#ff0000');
  });

  it('converts pure green', () => {
    expect(colorToHex({ r: 0, g: 255, b: 0, w: 0 })).toBe('#00ff00');
  });

  it('converts pure blue', () => {
    expect(colorToHex({ r: 0, g: 0, b: 255, w: 0 })).toBe('#0000ff');
  });

  it('converts black', () => {
    expect(colorToHex({ r: 0, g: 0, b: 0, w: 0 })).toBe('#000000');
  });

  it('converts white', () => {
    expect(colorToHex({ r: 255, g: 255, b: 255, w: 0 })).toBe('#ffffff');
  });

  it('pads single-digit hex values', () => {
    expect(colorToHex({ r: 1, g: 2, b: 3, w: 0 })).toBe('#010203');
  });

  it('ignores the W channel', () => {
    expect(colorToHex({ r: 255, g: 0, b: 0, w: 255 })).toBe('#ff0000');
  });
});

// ─── hexToColor ───────────────────────────────────────────────────────────────

describe('hexToColor', () => {
  it('converts #ff0000 to pure red', () => {
    expect(hexToColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, w: 0 });
  });

  it('converts #00ff00 to pure green', () => {
    expect(hexToColor('#00ff00')).toEqual({ r: 0, g: 255, b: 0, w: 0 });
  });

  it('converts #0000ff to pure blue', () => {
    expect(hexToColor('#0000ff')).toEqual({ r: 0, g: 0, b: 255, w: 0 });
  });

  it('converts #000000 to black', () => {
    expect(hexToColor('#000000')).toEqual({ r: 0, g: 0, b: 0, w: 0 });
  });

  it('defaults W to 0', () => {
    expect(hexToColor('#ff0000').w).toBe(0);
  });

  it('accepts a custom W value', () => {
    expect(hexToColor('#ff0000', 128).w).toBe(128);
  });

  it('round-trips with colorToHex', () => {
    const original = { r: 180, g: 120, b: 50, w: 0 };
    expect(hexToColor(colorToHex(original))).toEqual(original);
  });
});

// ─── effectPeakBrightness ─────────────────────────────────────────────────────

describe('effectPeakBrightness', () => {
  it('solid: returns brightness directly', () => {
    const e: Effect = { type: 'solid', color: { r: 255, g: 255, b: 255, w: 0 }, brightness: 0.75 };
    expect(effectPeakBrightness(e)).toBe(0.75);
  });

  it('solid at 0: returns 0', () => {
    const e: Effect = { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 };
    expect(effectPeakBrightness(e)).toBe(0);
  });

  it('gradient: returns brightness', () => {
    const e: Effect = {
      type: 'gradient',
      colorA: { r: 255, g: 0, b: 0, w: 0 },
      colorB: { r: 0, g: 0, b: 255, w: 0 },
      brightness: 0.6,
    };
    expect(effectPeakBrightness(e)).toBe(0.6);
  });

  it('rainbow: returns brightness', () => {
    const e: Effect = { type: 'rainbow', brightness: 0.8, speed: 30 };
    expect(effectPeakBrightness(e)).toBe(0.8);
  });

  it('pulse: returns maxBrightness', () => {
    const e: Effect = {
      type: 'pulse',
      color: { r: 255, g: 255, b: 255, w: 0 },
      minBrightness: 0.1,
      maxBrightness: 0.9,
      period: 2,
    };
    expect(effectPeakBrightness(e)).toBe(0.9);
  });

  it('strobe: returns brightness', () => {
    const e: Effect = {
      type: 'strobe',
      color: { r: 255, g: 255, b: 255, w: 0 },
      brightness: 1,
      rate: 5,
      dutyCycle: 0.5,
    };
    expect(effectPeakBrightness(e)).toBe(1);
  });

  it('chase: returns approximate 0.8', () => {
    const e: Effect = {
      type: 'chase',
      color: { r: 255, g: 255, b: 255, w: 0 },
      backgroundColor: { r: 0, g: 0, b: 0, w: 0 },
      pixelCount: 10,
      speed: 50,
      direction: 'forward',
    };
    expect(effectPeakBrightness(e)).toBe(0.8);
  });

  it('twinkle: returns brightness × density', () => {
    const e: Effect = {
      type: 'twinkle',
      color: { r: 255, g: 255, b: 255, w: 0 },
      brightness: 1,
      density: 0.3,
      speed: 1,
    };
    expect(effectPeakBrightness(e)).toBeCloseTo(0.3);
  });

  it('fire: returns brightness', () => {
    const e: Effect = { type: 'fire', brightness: 0.8, cooling: 55, sparking: 120 };
    expect(effectPeakBrightness(e)).toBe(0.8);
  });
});

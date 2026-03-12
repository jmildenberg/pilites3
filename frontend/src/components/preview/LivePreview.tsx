import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import type { Effect, Region, Play, Cue } from '../../types';
import { colorToHex, effectPeakBrightness } from '../../types';
import { resolveRegionLevels, DARK_EFFECT } from '../../lib/stageState';
import { usePixelStream } from '../../hooks/usePixelStream';
import type { PixelGetter } from '../../hooks/usePixelStream';

// ─── Effect → CSS style (used when pixel stream is not connected) ─────────────

const EFFECT_BADGES: Partial<Record<Effect['type'], string>> = {
  chase:   'CHASE',
  twinkle: 'TWNKL',
  fire:    'FIRE',
  rainbow: 'RNBW',
};

function effectStyle(effect: Effect): CSSProperties {
  switch (effect.type) {
    case 'solid': {
      return { backgroundColor: colorToHex(effect.color), opacity: effect.brightness };
    }
    case 'gradient': {
      return {
        background: `linear-gradient(to right, ${colorToHex(effect.colorA)}, ${colorToHex(effect.colorB)})`,
        opacity: effect.brightness,
      };
    }
    case 'rainbow': {
      return {
        background: 'linear-gradient(to right, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)',
        animation: `pilites-rainbow-shift ${360 / effect.speed}s linear infinite`,
        opacity: effect.brightness,
      };
    }
    case 'pulse': {
      return {
        backgroundColor: colorToHex(effect.color),
        '--pulse-min': String(effect.minBrightness),
        '--pulse-max': String(effect.maxBrightness),
        animation: `pilites-pulse ${effect.period}s ease-in-out infinite`,
      } as CSSProperties;
    }
    case 'strobe': {
      const duration = 1 / Math.max(effect.rate, 0.1);
      return {
        backgroundColor: colorToHex(effect.color),
        opacity: effect.brightness,
        animation: `pilites-strobe ${duration}s steps(1, end) infinite`,
      };
    }
    case 'chase': {
      return { backgroundColor: colorToHex(effect.color), opacity: effectPeakBrightness(effect) * 0.6 };
    }
    case 'twinkle': {
      return { backgroundColor: colorToHex(effect.color), opacity: effect.brightness * effect.density };
    }
    case 'fire': {
      return {
        background: 'linear-gradient(to top, #cc2200 0%, #ff6600 50%, #ffcc00 100%)',
        opacity: effect.brightness,
      };
    }
  }
}

// ─── RegionBulbCanvas ─────────────────────────────────────────────────────────

function RegionBulbCanvas({
  region, effect, pixelStream, compact,
}: {
  region: Region;
  effect: Effect;
  pixelStream: PixelGetter | null;
  compact: boolean;
}) {
  const regionLedCount = region.segments.reduce((sum, s) => sum + (s.endIndex - s.startIndex + 1), 0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const badge = EFFECT_BADGES[effect.type];
  const height = compact ? 36 : 72;

  // Draw each LED in the region as a circular bulb. Two passes per frame:
  //   1. Glow pass — blurred circles for a soft halo
  //   2. Bulb pass — sharp circles on top (the actual LED colour)
  useEffect(() => {
    if (!pixelStream) return;

    let rafId: number;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d')!;

    function resize() {
      canvas!.width  = container!.clientWidth;
      canvas!.height = container!.clientHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    function paint() {
      const channelPixels = pixelStream!(region.channelId);
      if (channelPixels) {
        const W = canvas!.width;
        const H = canvas!.height;
        const spacing = W / regionLedCount;
        const radius  = Math.min(spacing * 0.46, H * 0.38);
        const cy      = H / 2;

        // Build a flat array of RGB triples from all segments in order
        const rgb: Array<[number, number, number]> = [];
        for (const seg of region.segments) {
          for (let phys = seg.startIndex; phys <= seg.endIndex; phys++) {
            rgb.push([channelPixels[phys * 3], channelPixels[phys * 3 + 1], channelPixels[phys * 3 + 2]]);
          }
        }

        ctx.clearRect(0, 0, W, H);

        // ── Glow pass (blurred) ──────────────────────────────────────────────
        if (radius >= 1.5) {
          ctx.filter = `blur(${Math.max(1, radius * 0.9).toFixed(1)}px)`;
          for (let i = 0; i < rgb.length; i++) {
            const [r, g, b] = rgb[i];
            const lum = (r + g + b) / 765;
            if (lum < 0.02) continue;
            ctx.beginPath();
            ctx.arc((i + 0.5) * spacing, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, lum * 1.4).toFixed(3)})`;
            ctx.fill();
          }
          ctx.filter = 'none';
        }

        // ── Bulb pass (sharp) ────────────────────────────────────────────────
        for (let i = 0; i < rgb.length; i++) {
          const [r, g, b] = rgb[i];
          ctx.beginPath();
          ctx.arc((i + 0.5) * spacing, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fill();
        }
      }
      rafId = requestAnimationFrame(paint);
    }

    rafId = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [pixelStream, region, regionLedCount]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-[#0a0a0a]"
      style={{ height }}
    >
      {pixelStream ? (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={effectStyle(effect)}>
          {badge && (
            <span
              className="text-[9px] font-bold px-1 rounded"
              style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'rgba(255,255,255,0.9)',
                fontFamily: 'monospace',
              }}
            >
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── RegionCardFooter ─────────────────────────────────────────────────────────

function RegionCardFooter({ effect }: { effect: Effect }) {
  const brightness = effectPeakBrightness(effect);

  function detail() {
    switch (effect.type) {
      case 'solid':    return `${(brightness * 100).toFixed(0)}%`;
      case 'gradient': return `gradient · ${(brightness * 100).toFixed(0)}%`;
      case 'rainbow':  return `${effect.speed}°/s`;
      case 'pulse':    return `${effect.period}s · ${(effect.minBrightness * 100).toFixed(0)}–${(effect.maxBrightness * 100).toFixed(0)}%`;
      case 'strobe':   return `${effect.rate} Hz · ${(effect.dutyCycle * 100).toFixed(0)}% duty`;
      case 'chase':    return `${effect.direction} · ${effect.speed}px/s · ${effect.pixelCount}px`;
      case 'twinkle':  return `${(effect.density * 100).toFixed(0)}% density · ×${effect.speed}`;
      case 'fire':     return `cool:${effect.cooling} spark:${effect.sparking}`;
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-t border-[#2e2e2e]">
      <span className="text-xs text-neutral-500 flex-1">{detail()}</span>
      <div className="flex items-center gap-1 shrink-0">
        <div className="w-16 h-1.5 rounded-full bg-[#2e2e2e] overflow-hidden">
          <div className="h-full rounded-full bg-[#646cff]" style={{ width: `${brightness * 100}%` }} />
        </div>
        <span className="text-xs text-neutral-600 font-mono w-8 text-right">{(brightness * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ─── RegionCard ───────────────────────────────────────────────────────────────

function RegionCard({
  region, effect, pixelStream, compact,
}: {
  region: Region;
  effect: Effect;
  pixelStream: PixelGetter | null;
  compact: boolean;
}) {
  const isAnimated = !['solid', 'gradient'].includes(effect.type);

  return (
    <div className="bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#2e2e2e]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2e2e2e]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: region.uiColor }} />
          <span className="text-xs font-semibold text-neutral-300">{region.label}</span>
          <span className="text-[10px] font-mono text-neutral-600">Ch{region.channelId}</span>
        </div>
        <div className="flex items-center gap-2">
          {pixelStream && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
              LIVE
            </span>
          )}
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isAnimated ? 'bg-[#646cff]/20 text-[#646cff]' : 'bg-[#2e2e2e] text-neutral-400'}`}>
            {effect.type}
          </span>
        </div>
      </div>

      <RegionBulbCanvas region={region} effect={effect} pixelStream={pixelStream} compact={compact} />

      {!compact && <RegionCardFooter effect={effect} />}
    </div>
  );
}

// ─── LivePreview ──────────────────────────────────────────────────────────────

export interface LivePreviewProps {
  play: Play;
  currentCue: Cue | null;
  cueIndex: number | null;
  compact?: boolean;
}

export function LivePreview({ play, cueIndex, compact = false }: LivePreviewProps) {
  const { regions, cues } = play;
  const pixelStream = usePixelStream();

  const resolvedEffects: Record<string, Effect> = {};
  if (cueIndex !== null) {
    const levels = resolveRegionLevels(cues, regions, cueIndex, play.regionGroups ?? []);
    for (const [regionId, { effect }] of Object.entries(levels)) {
      resolvedEffects[regionId] = effect;
    }
  }

  if (!regions.length) {
    return (
      <div className="flex items-center justify-center py-12 text-neutral-600 text-sm">
        No regions defined — add regions in the Editor.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-${compact ? '2' : '3'}`}>
      {regions
        .slice()
        .sort((a, b) => a.channelId - b.channelId || (a.segments[0]?.startIndex ?? 0) - (b.segments[0]?.startIndex ?? 0))
        .map((r) => (
          <RegionCard
            key={r.id}
            region={r}
            effect={resolvedEffects[r.id] ?? DARK_EFFECT}
            pixelStream={pixelStream}
            compact={compact}
          />
        ))}
    </div>
  );
}

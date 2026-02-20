import type { CSSProperties } from 'react';
import type { Effect, Region, Play, Cue } from '../../types';
import { colorToHex, effectPeakBrightness } from '../../types';
import { resolveRegionLevels } from '../../lib/stageState';
import { useChannelConfig } from '../../context/ChannelConfigContext';

// ─── Effect → CSS style ───────────────────────────────────────────────────────

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
    // Complex effects — show base color at reduced opacity with a badge overlay
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

// ─── RegionSegment ────────────────────────────────────────────────────────────

function RegionSegment({
  region, effect, ledCount, compact,
}: {
  region: Region;
  effect: Effect;
  ledCount: number;
  compact: boolean;
}) {
  const regionLeds = region.endIndex - region.startIndex + 1;
  const widthPct = (regionLeds / ledCount) * 100;
  const badge = EFFECT_BADGES[effect.type];
  const height = compact ? 28 : 56;

  return (
    <div
      className="relative overflow-hidden shrink-0"
      style={{ width: `${widthPct}%`, height }}
    >
      {/* Effect background */}
      <div className="absolute inset-0 transition-all duration-500" style={effectStyle(effect)} />

      {/* Region label + effect badge */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1">
        {!compact && (
          <span
            className="text-xs font-semibold truncate w-full text-center"
            style={{ color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
          >
            {region.label}
          </span>
        )}
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

      {/* Right border between segments */}
      <div className="absolute inset-y-0 right-0 w-px bg-black/40" />
    </div>
  );
}

// ─── UnallocatedSegment ───────────────────────────────────────────────────────

function UnallocatedSegment({ startIdx, endIdx, ledCount, compact }: {
  startIdx: number; endIdx: number; ledCount: number; compact: boolean;
}) {
  const widthPct = ((endIdx - startIdx + 1) / ledCount) * 100;
  return (
    <div
      className="relative shrink-0 bg-[#111] border-r border-black/40"
      style={{ width: `${widthPct}%`, height: compact ? 28 : 56 }}
    >
      {!compact && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-700 font-mono">
          {startIdx}–{endIdx}
        </div>
      )}
    </div>
  );
}

// ─── ChannelStrip ─────────────────────────────────────────────────────────────

function ChannelStrip({
  channelId, ledCount, regions, resolvedEffects, compact,
}: {
  channelId: 0 | 1;
  ledCount: number;
  regions: Region[];
  resolvedEffects: Record<string, Effect>;
  compact: boolean;
}) {
  const chRegions = regions
    .filter((r) => r.channelId === channelId)
    .sort((a, b) => a.startIndex - b.startIndex);

  // Build ordered list of region/gap segments
  type Seg = { kind: 'region'; region: Region } | { kind: 'gap'; start: number; end: number };
  const segments: Seg[] = [];
  let cursor = 0;
  for (const r of chRegions) {
    if (r.startIndex > cursor) segments.push({ kind: 'gap', start: cursor, end: r.startIndex - 1 });
    segments.push({ kind: 'region', region: r });
    cursor = r.endIndex + 1;
  }
  if (cursor < ledCount) segments.push({ kind: 'gap', start: cursor, end: ledCount - 1 });

  const label = `Channel ${channelId}`;
  const quarter = Math.round(ledCount / 4);

  return (
    <div className="flex flex-col gap-1">
      {!compact && (
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs font-semibold text-neutral-400">{label}</span>
          <span className="text-xs text-neutral-600 font-mono">{ledCount} LEDs</span>
        </div>
      )}

      {/* Strip */}
      <div className={`flex overflow-hidden rounded border border-[#2e2e2e] bg-[#0a0a0a] ${compact ? '' : 'shadow-inner'}`}>
        {segments.map((seg, i) =>
          seg.kind === 'region' ? (
            <RegionSegment
              key={seg.region.id}
              region={seg.region}
              effect={resolvedEffects[seg.region.id] ?? { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 }}
              ledCount={ledCount}
              compact={compact}
            />
          ) : (
            <UnallocatedSegment
              key={`gap-${i}`}
              startIdx={seg.start}
              endIdx={seg.end}
              ledCount={ledCount}
              compact={compact}
            />
          )
        )}
      </div>

      {/* LED index ruler (full mode only) */}
      {!compact && (
        <div className="flex justify-between text-[10px] text-neutral-700 font-mono px-0.5">
          {[0, quarter, quarter * 2, quarter * 3, ledCount - 1].map((n) => <span key={n}>{n}</span>)}
        </div>
      )}
    </div>
  );
}

// ─── Region summary list (full mode) ─────────────────────────────────────────

function RegionSummary({ region, effect }: { region: Region; effect: Effect }) {
  const brightness = effectPeakBrightness(effect);
  const isAnimated = !['solid', 'gradient'].includes(effect.type);

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
    <div className="flex items-center gap-3 py-1.5 border-b border-[#1e1e1e] last:border-0">
      <div
        className="w-3 h-3 rounded-sm shrink-0"
        style={{ backgroundColor: region.uiColor }}
      />
      <span className="text-sm text-neutral-300 w-28 shrink-0 truncate">{region.label}</span>
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${isAnimated ? 'bg-[#646cff]/20 text-[#646cff]' : 'bg-[#2e2e2e] text-neutral-400'}`}>
        {effect.type}
      </span>
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

// ─── LivePreview ──────────────────────────────────────────────────────────────

export interface LivePreviewProps {
  play: Play;
  currentCue: Cue | null;
  cueIndex: number | null;
  compact?: boolean;
}

export function LivePreview({ play, currentCue, cueIndex, compact = false }: LivePreviewProps) {
  const { regions, cues } = play;
  const { channels } = useChannelConfig();

  // Resolve effects for all regions at the current cue
  const resolvedEffects: Record<string, Effect> = {};
  if (cueIndex !== null) {
    const levels = resolveRegionLevels(cues, regions, cueIndex);
    for (const [regionId, { effect }] of Object.entries(levels)) {
      resolvedEffects[regionId] = effect;
    }
  }

  return (
    <div className={`flex flex-col gap-${compact ? '2' : '5'}`}>
      {channels.map((ch) => (
        <ChannelStrip
          key={ch.id}
          channelId={ch.id}
          ledCount={ch.ledCount}
          regions={regions}
          resolvedEffects={resolvedEffects}
          compact={compact}
        />
      ))}

      {!compact && currentCue && (
        <div className="flex flex-col mt-1">
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">Region States</p>
          {regions
            .slice()
            .sort((a, b) => a.channelId - b.channelId || a.startIndex - b.startIndex)
            .map((r) => (
              <RegionSummary
                key={r.id}
                region={r}
                effect={resolvedEffects[r.id] ?? { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

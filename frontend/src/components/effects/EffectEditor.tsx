import { useRef } from 'react';
import type {
  Effect, EffectType, Color,
  SolidEffect, GradientEffect, RainbowEffect,
  PulseEffect, StrobeEffect, ChaseEffect, TwinkleEffect, FireEffect,
} from '../../types';
import { colorToHex, hexToColor, EFFECT_DEFAULTS } from '../../types';

// ─── Effect type metadata ──────────────────────────────────────────────────────

const EFFECT_TYPES: Array<{ type: EffectType; label: string; description: string }> = [
  { type: 'solid',    label: 'Solid',    description: 'Static colour' },
  { type: 'gradient', label: 'Gradient', description: 'A→B colour blend' },
  { type: 'rainbow',  label: 'Rainbow',  description: 'Hue cycle' },
  { type: 'pulse',    label: 'Pulse',    description: 'Breathing brightness' },
  { type: 'strobe',   label: 'Strobe',   description: 'Rapid flash' },
  { type: 'chase',    label: 'Chase',    description: 'Moving segment' },
  { type: 'twinkle',  label: 'Twinkle',  description: 'Random sparkle' },
  { type: 'fire',     label: 'Fire',     description: 'Flame simulation' },
];

// ─── Small shared controls ────────────────────────────────────────────────────

function ColorPick({
  label, value, onChange, palette = [],
}: {
  label: string; value: Color; onChange: (c: Color) => void; palette?: Color[];
}) {
  const hex = colorToHex(value);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-600">{label}</label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Native colour picker swatch */}
        <div
          className="relative w-7 h-7 rounded border border-[#3e3e3e] overflow-hidden shrink-0"
          style={{ backgroundColor: hex }}
          title="Custom colour"
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(hexToColor(e.target.value))}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </div>
        {/* Palette swatches */}
        {palette.map((c) => {
          const ch = colorToHex(c);
          const isActive = ch === hex;
          return (
            <button
              key={ch}
              onClick={() => onChange(c)}
              title={ch}
              className="w-5 h-5 rounded shrink-0 transition-transform hover:scale-110"
              style={{
                backgroundColor: ch,
                outline: isActive ? '2px solid white' : '1px solid rgba(255,255,255,0.15)',
                outlineOffset: isActive ? '1px' : '0',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Slider({
  label, value, min, max, step = 0.01, unit = '', format,
  onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  unit?: string; format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const display = format ? format(value) : `${value}${unit}`;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between">
        <label className="text-xs text-neutral-600">{label}</label>
        <span className="text-xs text-neutral-400 font-mono">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#646cff]"
      />
    </div>
  );
}

function NumberInput({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-neutral-600">{label}{unit && <span className="text-neutral-700"> ({unit})</span>}</label>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-[#0f0f0f] rounded px-2 py-1 text-sm font-mono text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
      />
    </div>
  );
}

// ─── Per-effect param panels ───────────────────────────────────────────────────

type ParamProps<T> = { e: T; patch: (p: Partial<T>) => void; palette: Color[] };

function SolidParams({ e, patch, palette }: ParamProps<SolidEffect>) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPick label="Color" value={e.color} onChange={(color) => patch({ color })} palette={palette} />
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
    </div>
  );
}

function GradientParams({ e, patch, palette }: ParamProps<GradientEffect>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        <ColorPick label="Color A" value={e.colorA} onChange={(colorA) => patch({ colorA })} palette={palette} />
        <ColorPick label="Color B" value={e.colorB} onChange={(colorB) => patch({ colorB })} palette={palette} />
      </div>
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
    </div>
  );
}

function RainbowParams({ e, patch }: ParamProps<RainbowEffect>) {
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
      <Slider label="Speed" value={e.speed} min={1} max={360} step={1} unit="°/s" format={(v) => `${v}°/s`} onChange={(speed) => patch({ speed })} />
    </div>
  );
}

function PulseParams({ e, patch, palette }: ParamProps<PulseEffect>) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPick label="Color" value={e.color} onChange={(color) => patch({ color })} palette={palette} />
      <Slider label="Min brightness" value={e.minBrightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(v) => patch({ minBrightness: Math.min(v, e.maxBrightness) })} />
      <Slider label="Max brightness" value={e.maxBrightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(v) => patch({ maxBrightness: Math.max(v, e.minBrightness) })} />
      <Slider label="Period" value={e.period} min={0.1} max={30} step={0.1} unit="s" format={(v) => `${v.toFixed(1)}s`} onChange={(period) => patch({ period })} />
    </div>
  );
}

function StrobeParams({ e, patch, palette }: ParamProps<StrobeEffect>) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPick label="Color" value={e.color} onChange={(color) => patch({ color })} palette={palette} />
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
      <Slider label="Rate" value={e.rate} min={0.5} max={30} step={0.5} format={(v) => `${v} Hz`} onChange={(rate) => patch({ rate })} />
      <Slider label="Duty cycle" value={e.dutyCycle} min={0.05} max={0.95} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(dutyCycle) => patch({ dutyCycle })} />
    </div>
  );
}

function ChaseParams({ e, patch, palette }: ParamProps<ChaseEffect>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        <ColorPick label="Segment" value={e.color} onChange={(color) => patch({ color })} palette={palette} />
        <ColorPick label="Background" value={e.backgroundColor} onChange={(backgroundColor) => patch({ backgroundColor })} palette={palette} />
      </div>
      <NumberInput label="Segment size" value={e.pixelCount} min={1} max={100} unit="LEDs" onChange={(pixelCount) => patch({ pixelCount })} />
      <Slider label="Speed" value={e.speed} min={1} max={500} step={1} format={(v) => `${v} px/s`} onChange={(speed) => patch({ speed })} />
      <div className="flex flex-col gap-0.5">
        <label className="text-xs text-neutral-600">Direction</label>
        <div className="flex gap-1">
          {(['forward', 'reverse', 'bounce'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => patch({ direction: dir })}
              className={
                'flex-1 py-1 rounded text-xs transition-colors ' +
                (e.direction === dir
                  ? 'bg-[#646cff] text-white'
                  : 'bg-[#0f0f0f] text-neutral-500 hover:text-neutral-300')
              }
            >
              {dir}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TwinkleParams({ e, patch, palette }: ParamProps<TwinkleEffect>) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPick label="Color" value={e.color} onChange={(color) => patch({ color })} palette={palette} />
      <Slider label="Peak brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
      <Slider label="Density" value={e.density} min={0.01} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(density) => patch({ density })} />
      <Slider label="Speed" value={e.speed} min={0.1} max={5} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(speed) => patch({ speed })} />
    </div>
  );
}

function FireParams({ e, patch }: ParamProps<FireEffect>) {
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
      <Slider label="Cooling" value={e.cooling} min={20} max={100} step={1} format={(v) => String(v)} onChange={(cooling) => patch({ cooling })} />
      <Slider label="Sparking" value={e.sparking} min={50} max={200} step={1} format={(v) => String(v)} onChange={(sparking) => patch({ sparking })} />
    </div>
  );
}

// ─── EffectEditor ─────────────────────────────────────────────────────────────

interface Props {
  effect: Effect;
  onChange: (effect: Effect) => void;
  disabled?: boolean;
  palette?: Color[];
}

export function EffectEditor({ effect, onChange, disabled = false, palette = [] }: Props) {
  // Retain the last known color across effect type switches, including colorless types (rainbow, fire)
  const lastColorRef = useRef<Color>(
    'color' in effect ? effect.color
    : 'colorA' in effect ? (effect as GradientEffect).colorA
    : (EFFECT_DEFAULTS.solid as SolidEffect).color
  );
  const lastColorBRef = useRef<Color>(
    'colorB' in effect ? (effect as GradientEffect).colorB
    : (EFFECT_DEFAULTS.gradient as GradientEffect).colorB
  );

  // Keep refs current as the effect changes (e.g. user picks a new color)
  if ('color' in effect) lastColorRef.current = effect.color;
  if ('colorA' in effect) lastColorRef.current = (effect as GradientEffect).colorA;
  if ('colorB' in effect) lastColorBRef.current = (effect as GradientEffect).colorB;

  function switchType(type: EffectType) {
    if (type === effect.type) return;
    const next = { ...EFFECT_DEFAULTS[type] } as Record<string, unknown>;

    // Restore retained color into the new effect where applicable
    if ('color' in next) next.color = lastColorRef.current;
    if ('colorA' in next) next.colorA = lastColorRef.current;
    if ('colorB' in next) next.colorB = lastColorBRef.current;

    onChange(next as unknown as Effect);
  }

  function patch<T extends Effect>(partial: Partial<T>) {
    onChange({ ...effect, ...partial } as Effect);
  }

  return (
    <div className={`flex flex-col gap-3 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      {/* Effect type pills */}
      <div className="flex flex-wrap gap-1">
        {EFFECT_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => switchType(type)}
            title={EFFECT_TYPES.find((t) => t.type === type)?.description}
            className={
              'px-2 py-0.5 rounded text-xs font-medium transition-colors ' +
              (effect.type === type
                ? 'bg-[#646cff] text-white'
                : 'bg-[#2e2e2e] text-neutral-400 hover:text-neutral-200 hover:bg-[#3e3e3e]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Per-type params */}
      <div className="bg-[#0f0f0f] rounded p-3">
        {effect.type === 'solid'    && <SolidParams    e={effect} patch={patch} palette={palette} />}
        {effect.type === 'gradient' && <GradientParams e={effect} patch={patch} palette={palette} />}
        {effect.type === 'rainbow'  && <RainbowParams  e={effect} patch={patch} palette={palette} />}
        {effect.type === 'pulse'    && <PulseParams    e={effect} patch={patch} palette={palette} />}
        {effect.type === 'strobe'   && <StrobeParams   e={effect} patch={patch} palette={palette} />}
        {effect.type === 'chase'    && <ChaseParams    e={effect} patch={patch} palette={palette} />}
        {effect.type === 'twinkle'  && <TwinkleParams  e={effect} patch={patch} palette={palette} />}
        {effect.type === 'fire'     && <FireParams     e={effect} patch={patch} palette={palette} />}
      </div>
    </div>
  );
}

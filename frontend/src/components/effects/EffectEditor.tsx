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

function ColorPick({ label, value, onChange }: { label: string; value: Color; onChange: (c: Color) => void }) {
  const hex = colorToHex(value);
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-neutral-600">{label}</label>
      <div className="relative w-8 h-8 rounded border border-[#3e3e3e] overflow-hidden" style={{ backgroundColor: hex }}>
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(hexToColor(e.target.value))}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
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

function SolidParams({ e, patch }: { e: SolidEffect; patch: (p: Partial<SolidEffect>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPick label="Color" value={e.color} onChange={(color) => patch({ color })} />
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
    </div>
  );
}

function GradientParams({ e, patch }: { e: GradientEffect; patch: (p: Partial<GradientEffect>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        <ColorPick label="Color A" value={e.colorA} onChange={(colorA) => patch({ colorA })} />
        <ColorPick label="Color B" value={e.colorB} onChange={(colorB) => patch({ colorB })} />
      </div>
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
    </div>
  );
}

function RainbowParams({ e, patch }: { e: RainbowEffect; patch: (p: Partial<RainbowEffect>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
      <Slider label="Speed" value={e.speed} min={1} max={360} step={1} unit="°/s" format={(v) => `${v}°/s`} onChange={(speed) => patch({ speed })} />
    </div>
  );
}

function PulseParams({ e, patch }: { e: PulseEffect; patch: (p: Partial<PulseEffect>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPick label="Color" value={e.color} onChange={(color) => patch({ color })} />
      <Slider label="Min brightness" value={e.minBrightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(v) => patch({ minBrightness: Math.min(v, e.maxBrightness) })} />
      <Slider label="Max brightness" value={e.maxBrightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(v) => patch({ maxBrightness: Math.max(v, e.minBrightness) })} />
      <Slider label="Period" value={e.period} min={0.1} max={30} step={0.1} unit="s" format={(v) => `${v.toFixed(1)}s`} onChange={(period) => patch({ period })} />
    </div>
  );
}

function StrobeParams({ e, patch }: { e: StrobeEffect; patch: (p: Partial<StrobeEffect>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPick label="Color" value={e.color} onChange={(color) => patch({ color })} />
      <Slider label="Brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
      <Slider label="Rate" value={e.rate} min={0.5} max={30} step={0.5} format={(v) => `${v} Hz`} onChange={(rate) => patch({ rate })} />
      <Slider label="Duty cycle" value={e.dutyCycle} min={0.05} max={0.95} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(dutyCycle) => patch({ dutyCycle })} />
    </div>
  );
}

function ChaseParams({ e, patch }: { e: ChaseEffect; patch: (p: Partial<ChaseEffect>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        <ColorPick label="Segment" value={e.color} onChange={(color) => patch({ color })} />
        <ColorPick label="Background" value={e.backgroundColor} onChange={(backgroundColor) => patch({ backgroundColor })} />
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

function TwinkleParams({ e, patch }: { e: TwinkleEffect; patch: (p: Partial<TwinkleEffect>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPick label="Color" value={e.color} onChange={(color) => patch({ color })} />
      <Slider label="Peak brightness" value={e.brightness} min={0} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(brightness) => patch({ brightness })} />
      <Slider label="Density" value={e.density} min={0.01} max={1} format={(v) => `${(v * 100).toFixed(0)}%`} onChange={(density) => patch({ density })} />
      <Slider label="Speed" value={e.speed} min={0.1} max={5} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(speed) => patch({ speed })} />
    </div>
  );
}

function FireParams({ e, patch }: { e: FireEffect; patch: (p: Partial<FireEffect>) => void }) {
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
}

export function EffectEditor({ effect, onChange, disabled = false }: Props) {
  function switchType(type: EffectType) {
    if (type === effect.type) return;
    onChange({ ...EFFECT_DEFAULTS[type] });
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
        {effect.type === 'solid'    && <SolidParams    e={effect} patch={patch} />}
        {effect.type === 'gradient' && <GradientParams e={effect} patch={patch} />}
        {effect.type === 'rainbow'  && <RainbowParams  e={effect} patch={patch} />}
        {effect.type === 'pulse'    && <PulseParams    e={effect} patch={patch} />}
        {effect.type === 'strobe'   && <StrobeParams   e={effect} patch={patch} />}
        {effect.type === 'chase'    && <ChaseParams    e={effect} patch={patch} />}
        {effect.type === 'twinkle'  && <TwinkleParams  e={effect} patch={patch} />}
        {effect.type === 'fire'     && <FireParams     e={effect} patch={patch} />}
      </div>
    </div>
  );
}

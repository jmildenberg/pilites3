import type { Cue, Region } from '../types';
import { colorToHex, effectPeakBrightness } from '../types';
import { LivePreview } from '../components/preview/LivePreview';
import { usePlays, useSelectedPlay } from '../context/PlaysContext';
import { usePlayback } from '../hooks/usePlayback';

// ─── CueRow ───────────────────────────────────────────────────────────────────

function CueRow({
  cue, index, isCurrent, isNext, regions, onClick,
}: {
  cue: Cue; index: number; isCurrent: boolean; isNext: boolean;
  regions: Region[]; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full text-left px-4 py-2 border-b border-[#2e2e2e] flex items-center gap-3 transition-colors border-l-2 ' +
        (isCurrent ? 'bg-[#646cff]/20 border-l-[#646cff]'
          : isNext  ? 'bg-[#22c55e]/10 border-l-[#22c55e]'
          : 'hover:bg-[#2e2e2e] border-l-transparent')
      }
    >
      <span className="text-neutral-600 text-xs w-5 text-right shrink-0">{index + 1}</span>
      <span className="text-neutral-400 font-mono text-sm w-8 shrink-0">{cue.number}</span>
      <span className="text-sm font-medium flex-1 truncate">{cue.label}</span>

      {/* Effect type tags + region swatches */}
      <div className="flex items-center gap-1.5 shrink-0">
        {cue.regionStates.map((rs) => {
          const region = regions.find((r) => r.id === rs.regionId);
          if (!region) return null;
          const brightness = effectPeakBrightness(rs.effect);
          const isAnimated = rs.effect.type !== 'solid' && rs.effect.type !== 'gradient';
          const color = 'color' in rs.effect
            ? colorToHex(rs.effect.color)
            : 'colorA' in rs.effect
            ? colorToHex(rs.effect.colorA)
            : region.uiColor;
          return (
            <div key={rs.regionId} className="flex flex-col items-center gap-0.5">
              <div
                className={`w-2.5 h-2.5 rounded-sm ${isAnimated ? 'animate-pulse' : ''}`}
                style={{
                  backgroundColor: brightness > 0 ? color : '#2e2e2e',
                  opacity: 0.4 + brightness * 0.6,
                }}
                title={`${region.label}: ${rs.effect.type}`}
              />
            </div>
          );
        })}
        {[...new Set(cue.regionStates.map((rs) => rs.effect.type))].filter((t) => t !== 'solid').map((t) => (
          <span key={t} className="text-[10px] px-1 rounded bg-[#2e2e2e] text-neutral-500 font-mono">{t}</span>
        ))}
      </div>

      <span className="text-xs text-neutral-600 shrink-0 w-6 text-right">
        {cue.regionStates[0]?.fadeTime ?? 0}s
      </span>
    </button>
  );
}

// ─── ShowPage ─────────────────────────────────────────────────────────────────

export function ShowPage() {
  const { loading, plays } = usePlays();
  if (loading) return (
    <div className="flex items-center justify-center h-full text-neutral-600 text-sm">Loading shows…</div>
  );
  if (!plays.length) return (
    <div className="flex items-center justify-center h-full text-neutral-600 text-sm">No shows yet — create one in the Editor.</div>
  );
  return <ShowPageContent />;
}

function ShowPageContent() {
  const play = useSelectedPlay();
  const { cues, regions } = play;
  const { playback, currentIndex, nextIndex, currentCue, nextCue, applyCue, go, back } = usePlayback(play);

  const activeEffects = currentCue
    ? [...new Set(currentCue.regionStates.map((rs) => rs.effect.type))]
    : [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 h-12 border-b border-[#2e2e2e] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{play.title}</h1>
          <span className={
            'text-xs px-2 py-0.5 rounded-full font-mono ' +
            (playback.status === 'idle' ? 'bg-neutral-800 text-neutral-500' : 'bg-[#22c55e]/20 text-[#22c55e]')
          }>
            {playback.status.toUpperCase()}
          </span>
          {activeEffects.length > 0 && (
            <div className="flex gap-1">
              {activeEffects.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2e2e2e] text-neutral-400 font-mono">{t}</span>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-neutral-600">
          {cues.length} cues · {regions.length} regions
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {cues.map((cue, i) => (
            <CueRow
              key={cue.id} cue={cue} index={i}
              isCurrent={currentIndex === i}
              isNext={nextIndex === i && currentIndex !== i}
              regions={regions}
              onClick={() => applyCue(i)}
            />
          ))}
        </div>

        <div className="w-52 border-l border-[#2e2e2e] flex flex-col p-4 gap-5 shrink-0">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-neutral-500 uppercase tracking-widest">Live</p>
            <LivePreview
              play={play}
              currentCue={currentCue}
              cueIndex={currentIndex}
              compact
            />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mb-0.5">Current</p>
              <p className="text-sm font-mono text-[#646cff]">{currentCue ? `Q${currentCue.number}` : '—'}</p>
              <p className="text-xs text-neutral-300 truncate">{currentCue?.label ?? 'No cue'}</p>
              {currentCue?.notes && <p className="text-xs text-neutral-600 italic mt-0.5 truncate">{currentCue.notes}</p>}
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mb-0.5">Next</p>
              <p className="text-sm font-mono text-[#22c55e]">{nextCue ? `Q${nextCue.number}` : '—'}</p>
              <p className="text-xs text-neutral-300 truncate">{nextCue?.label ?? 'End of list'}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            <button onClick={back}
              className="w-full py-1.5 rounded text-sm font-semibold bg-[#2e2e2e] hover:bg-[#3e3e3e] text-neutral-300 transition-colors">
              ← BACK
            </button>
            <button onClick={go} disabled={nextIndex >= cues.length}
              className="w-full py-6 rounded text-2xl font-black bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-[#2e2e2e] disabled:text-neutral-600 text-black transition-colors">
              GO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

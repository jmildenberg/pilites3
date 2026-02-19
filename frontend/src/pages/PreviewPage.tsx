import { useState } from 'react';
import type { PlaybackState } from '../types';
import { resolveRegionLevels } from '../lib/stageState';
import { LivePreview } from '../components/preview/LivePreview';
import { useSelectedPlay } from '../context/PlaysContext';

// ─── PreviewPage ──────────────────────────────────────────────────────────────

export function PreviewPage() {
  const play = useSelectedPlay();
  const { cues, regions } = play;

  const [playback, setPlayback] = useState<PlaybackState>({
    playId: play.id,
    currentCueIndex: null,
    status: 'idle',
    regionLevels: {},
  });

  const currentIndex = playback.currentCueIndex;
  const nextIndex = currentIndex === null ? 0 : currentIndex + 1;
  const currentCue = currentIndex !== null ? cues[currentIndex] : null;
  const nextCue = nextIndex < cues.length ? cues[nextIndex] : null;

  function applyCue(index: number) {
    const resolved = resolveRegionLevels(cues, regions, index);
    const levels: Record<string, number> = {};
    for (const [regionId, { brightness }] of Object.entries(resolved)) {
      levels[regionId] = brightness;
    }
    setPlayback({ ...playback, currentCueIndex: index, status: 'running', regionLevels: levels });
  }

  function go() {
    const target = currentIndex === null ? 0 : currentIndex + 1;
    if (target < cues.length) applyCue(target);
  }

  function back() {
    if (currentIndex === null || currentIndex === 0) {
      setPlayback({ playId: play.id, currentCueIndex: null, status: 'idle', regionLevels: {} });
      return;
    }
    applyCue(currentIndex - 1);
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-[#2e2e2e] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{play.title}</h1>
          <span className={
            'text-xs px-2 py-0.5 rounded-full font-mono ' +
            (playback.status === 'idle' ? 'bg-neutral-800 text-neutral-500' : 'bg-[#22c55e]/20 text-[#22c55e]')
          }>
            {playback.status.toUpperCase()}
          </span>
        </div>

        {/* Cue info + GO/BACK inline */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-neutral-500">
              {currentCue ? `Q${currentCue.number} — ${currentCue.label}` : 'No cue active'}
            </p>
            <p className="text-xs text-neutral-600">
              Next: {nextCue ? `Q${nextCue.number} — ${nextCue.label}` : 'end of list'}
            </p>
          </div>
          <button
            onClick={back}
            className="px-3 py-1.5 rounded text-sm font-semibold bg-[#2e2e2e] hover:bg-[#3e3e3e] text-neutral-300 transition-colors"
          >
            ← BACK
          </button>
          <button
            onClick={go}
            disabled={nextIndex >= cues.length}
            className="px-8 py-1.5 rounded text-sm font-black bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-[#2e2e2e] disabled:text-neutral-600 text-black transition-colors"
          >
            GO
          </button>
        </div>
      </div>

      {/* Main preview area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <LivePreview
          play={play}
          currentCue={currentCue}
          cueIndex={currentIndex}
          compact={false}
        />
      </div>

      {/* Cue strip at the bottom */}
      <div className="shrink-0 border-t border-[#2e2e2e] bg-[#0f0f0f]">
        <div className="flex overflow-x-auto">
          {cues.map((cue, i) => (
            <button
              key={cue.id}
              onClick={() => applyCue(i)}
              className={
                'shrink-0 px-4 py-2.5 border-r border-[#2e2e2e] text-left transition-colors flex flex-col gap-0.5 min-w-[120px] ' +
                (currentIndex === i
                  ? 'bg-[#646cff]/20 border-t-2 border-t-[#646cff]'
                  : nextIndex === i && currentIndex !== i
                  ? 'bg-[#22c55e]/10 border-t-2 border-t-[#22c55e]'
                  : 'hover:bg-[#1a1a1a] border-t-2 border-t-transparent')
              }
            >
              <span className={`text-xs font-mono ${currentIndex === i ? 'text-[#646cff]' : 'text-neutral-500'}`}>
                Q{cue.number}
              </span>
              <span className={`text-xs truncate ${currentIndex === i ? 'text-white' : 'text-neutral-400'}`}>
                {cue.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

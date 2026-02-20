import { useState } from 'react';
import type { Cue, Play, PlaybackState } from '../types';

export function usePlayback(play: Play) {
  const { cues } = play;

  const [playback, setPlayback] = useState<PlaybackState>({
    playId: play.id,
    currentCueIndex: null,
    status: 'idle',
  });

  const currentIndex = playback.currentCueIndex;
  const nextIndex = currentIndex === null ? 0 : currentIndex + 1;
  const currentCue: Cue | null = currentIndex !== null ? (cues[currentIndex] ?? null) : null;
  const nextCue: Cue | null = nextIndex < cues.length ? cues[nextIndex] : null;

  function applyCue(index: number) {
    setPlayback((prev) => ({ ...prev, currentCueIndex: index, status: 'running' }));
  }

  function go() {
    const target = currentIndex === null ? 0 : currentIndex + 1;
    if (target < cues.length) applyCue(target);
  }

  function back() {
    if (currentIndex === null || currentIndex === 0) {
      setPlayback({ playId: play.id, currentCueIndex: null, status: 'idle' });
      return;
    }
    applyCue(currentIndex - 1);
  }

  return { playback, currentIndex, nextIndex, currentCue, nextCue, applyCue, go, back };
}

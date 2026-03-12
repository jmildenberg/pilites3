import { useState, useEffect, useRef, useCallback } from 'react';
import type { Cue, Play, PlaybackState } from '../types';
import { resolveStageState, DARK_EFFECT } from '../lib/stageState';
import { wsUrl } from '../lib/api';

export function usePlayback(play: Play) {
  const { cues, regions } = play;

  const [playback, setPlayback] = useState<PlaybackState>({
    playId: play.id,
    currentCueIndex: null,
    status: 'idle',
  });
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Open WebSocket; auto-reconnect on close
  useEffect(() => {
    let cancelled = false;

    function connect() {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen  = () => { if (!cancelled) setWsConnected(true); };
      ws.onclose = () => {
        setWsConnected(false);
        if (!cancelled) setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  function send(msg: object) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn('[usePlayback] WebSocket not connected — message dropped');
    }
  }

  const currentIndex = playback.currentCueIndex;
  const nextIndex    = currentIndex === null ? 0 : currentIndex + 1;
  const currentCue: Cue | null = currentIndex !== null ? (cues[currentIndex] ?? null) : null;
  const nextCue: Cue | null    = nextIndex < cues.length ? cues[nextIndex] : null;

  /**
   * Fire a cue: resolve the full stage state for this cue index (tracking
   * included), then send set_regions to the backend for rendering.
   */
  const applyCue = useCallback((index: number) => {
    setPlayback((prev) => ({ ...prev, currentCueIndex: index, status: 'running' }));

    const stageState = resolveStageState(cues, regions, index, play.regionGroups ?? []);
    const regionEntries = regions.map((region) => {
      const entry = stageState.get(region.id);
      const effect = entry?.state.effect ?? DARK_EFFECT;
      return {
        regionId:  region.id,
        channelId: region.channelId,
        segments:  region.segments,
        effect,
      };
    });

    send({ type: 'set_regions', regions: regionEntries });
  }, [cues, regions, play.regionGroups]);

  function go() {
    const target = currentIndex === null ? 0 : currentIndex + 1;
    if (target < cues.length) applyCue(target);
  }

  function back() {
    if (currentIndex === null || currentIndex === 0) {
      setPlayback({ playId: play.id, currentCueIndex: null, status: 'idle' });
      send({ type: 'blackout' });
      return;
    }
    applyCue(currentIndex - 1);
  }

  return { playback, currentIndex, nextIndex, currentCue, nextCue, applyCue, go, back, wsConnected };
}

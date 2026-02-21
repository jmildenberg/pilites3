/**
 * Connects to /ws/preview and receives per-frame pixel data from the backend
 * renderer. Returns a stable getter function when connected, null otherwise.
 *
 * Binary frame format (one message per channel per rendered frame):
 *   [channel_id: uint8][led_count: uint16 LE][r0,g0,b0, r1,g1,b1, ...]
 *
 * The getter reads the latest frame stored in a ref — no React state is updated
 * per frame, so the consuming component only re-renders on connect/disconnect.
 * Canvas components drive their own repaints via requestAnimationFrame.
 */
import { useState, useEffect, useRef } from 'react';
import { previewWsUrl } from '../lib/api';

/** Returns the latest RGB pixel buffer for a given channel, or undefined if no
 *  frame has arrived yet for that channel. */
export type PixelGetter = (channelId: number) => Uint8Array | undefined;

export function usePixelStream(): PixelGetter | null {
  const framesRef = useRef<Map<number, Uint8Array>>(new Map());
  const [connected, setConnected] = useState(false);

  // Stable getter — created once, always reads the latest framesRef.current.
  const getterRef = useRef<PixelGetter>((channelId) => framesRef.current.get(channelId));

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket;

    function connect() {
      ws = new WebSocket(previewWsUrl());
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        if (!cancelled) setConnected(true);
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();

      ws.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        const buf = new Uint8Array(e.data);
        if (buf.length < 3) return;
        const channelId = buf[0];
        const ledCount = buf[1] | (buf[2] << 8);
        // Store a copy of the RGB slice; mutate the map in-place (no state update).
        framesRef.current.set(channelId, buf.slice(3, 3 + ledCount * 3));
      };
    }

    connect();
    return () => {
      cancelled = true;
      ws?.close();
    };
  }, []);

  return connected ? getterRef.current : null;
}

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
import type { Play } from '../types';

// ─── Seed data ────────────────────────────────────────────────────────────────

const INITIAL_PLAYS: Play[] = [
  {
    id: 'p1',
    title: 'Sample Show',
    description: 'Development placeholder',
    regions: [
      { id: 'r1', label: 'Stage Left',  channelId: 0, startIndex: 0,   endIndex: 149, uiColor: '#a855f7' },
      { id: 'r2', label: 'Stage Right', channelId: 0, startIndex: 150, endIndex: 299, uiColor: '#3b82f6' },
      { id: 'r3', label: 'Backdrop',    channelId: 1, startIndex: 0,   endIndex: 249, uiColor: '#22c55e' },
    ],
    cues: [
      {
        id: 'c1', number: '1', label: 'House Full', notes: 'Pre-show house lights',
        regionStates: [
          { regionId: 'r1', fadeTime: 3, effect: { type: 'solid', color: { r: 255, g: 220, b: 180, w: 0 }, brightness: 1 } },
          { regionId: 'r2', fadeTime: 3, effect: { type: 'solid', color: { r: 255, g: 220, b: 180, w: 0 }, brightness: 1 } },
          { regionId: 'r3', fadeTime: 3, effect: { type: 'solid', color: { r: 255, g: 220, b: 180, w: 0 }, brightness: 0.5 } },
        ],
      },
      {
        id: 'c2', number: '2', label: 'Scene 1 – Stage', notes: 'Warm stage wash, backdrop tracks',
        regionStates: [
          { regionId: 'r1', fadeTime: 4, effect: { type: 'solid', color: { r: 255, g: 140, b: 60, w: 0 }, brightness: 0.85 } },
          { regionId: 'r2', fadeTime: 4, effect: { type: 'solid', color: { r: 255, g: 160, b: 80, w: 0 }, brightness: 0.75 } },
        ],
      },
      {
        id: 'c3', number: '3', label: 'Chase + Pulse', notes: 'Dynamic scene',
        regionStates: [
          { regionId: 'r1', fadeTime: 2, effect: { type: 'chase', color: { r: 255, g: 200, b: 50, w: 0 }, backgroundColor: { r: 20, g: 0, b: 40, w: 0 }, pixelCount: 15, speed: 80, direction: 'bounce' } },
          { regionId: 'r2', fadeTime: 2, effect: { type: 'pulse', color: { r: 200, g: 80, b: 255, w: 0 }, minBrightness: 0.1, maxBrightness: 0.9, period: 2.5 } },
          { regionId: 'r3', fadeTime: 2, effect: { type: 'fire',  brightness: 0.8, cooling: 55, sparking: 120 } },
        ],
      },
      {
        id: 'c4', number: '4', label: 'Blackout', notes: '',
        regionStates: [
          { regionId: 'r1', fadeTime: 2, effect: { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 } },
          { regionId: 'r2', fadeTime: 2, effect: { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 } },
          { regionId: 'r3', fadeTime: 2, effect: { type: 'solid', color: { r: 0, g: 0, b: 0, w: 0 }, brightness: 0 } },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface PlaysContextValue {
  plays: Play[];
  setPlays: Dispatch<SetStateAction<Play[]>>;
  selectedPlayId: string;
  setSelectedPlayId: (id: string) => void;
}

const PlaysContext = createContext<PlaysContextValue | null>(null);

export function PlaysProvider({ children }: { children: ReactNode }) {
  const [plays, setPlays] = useState<Play[]>(() =>
    loadStorage('pilites.plays', INITIAL_PLAYS)
  );
  const [selectedPlayId, setSelectedPlayId] = useState<string>(() =>
    loadStorage('pilites.selectedPlayId', INITIAL_PLAYS[0].id)
  );

  useEffect(() => {
    localStorage.setItem('pilites.plays', JSON.stringify(plays));
  }, [plays]);

  useEffect(() => {
    localStorage.setItem('pilites.selectedPlayId', selectedPlayId);
  }, [selectedPlayId]);

  return (
    <PlaysContext.Provider value={{ plays, setPlays, selectedPlayId, setSelectedPlayId }}>
      {children}
    </PlaysContext.Provider>
  );
}

export function usePlays(): PlaysContextValue {
  const ctx = useContext(PlaysContext);
  if (!ctx) throw new Error('usePlays must be used within PlaysProvider');
  return ctx;
}

/** Returns the currently-selected play (falls back to first if id not found). */
export function useSelectedPlay(): Play {
  const { plays, selectedPlayId } = usePlays();
  const play = plays.find((p) => p.id === selectedPlayId) ?? plays[0];
  if (!play) throw new Error('useSelectedPlay: no plays available');
  return play;
}

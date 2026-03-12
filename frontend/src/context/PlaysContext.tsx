import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Play, Region } from '../types';
import { api } from '../lib/api';

/** Migrate a region from legacy {startIndex, endIndex} to {segments:[...]}. */
function migrateRegion(r: Region & { startIndex?: number; endIndex?: number }): Region {
  if (!('segments' in r) && 'startIndex' in r) {
    const { startIndex, endIndex, ...rest } = r as any;
    return { ...rest, segments: [{ startIndex, endIndex }] };
  }
  return r;
}

function migratePlay(play: Play): Play {
  return { ...play, regions: (play.regions as any[]).map(migrateRegion) };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface PlaysContextValue {
  plays: Play[];
  loading: boolean;
  error: string | null;
  selectedPlayId: string | null;
  setSelectedPlayId: (id: string) => void;
  createPlay: (play: Play) => Promise<Play>;
  updatePlay: (id: string, play: Play) => Promise<Play>;
  deletePlay: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const PlaysContext = createContext<PlaysContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PlaysProvider({ children }: { children: ReactNode }) {
  const [plays, setPlays]         = useState<Play[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selectedPlayId, _setSelectedPlayId] = useState<string | null>(() => {
    try { return localStorage.getItem('pilites.selectedPlayId'); } catch { return null; }
  });

  function setSelectedPlayId(id: string) {
    _setSelectedPlayId(id);
    try { localStorage.setItem('pilites.selectedPlayId', id); } catch {}
  }

  const refresh = useCallback(async () => {
    try {
      const fetched = (await api.plays.list()).map(migratePlay);
      setPlays(fetched);
      setError(null);
      // If the currently-selected play no longer exists, fall back to first
      if (fetched.length > 0) {
        _setSelectedPlayId((prev) =>
          fetched.find((p) => p.id === prev) ? prev : fetched[0].id
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { refresh(); }, [refresh]);

  // Poll every 10 s so a second browser tab / machine stays in sync
  useEffect(() => {
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function createPlay(play: Play): Promise<Play> {
    const created = migratePlay(await api.plays.create(play));
    setPlays((prev) => [...prev, created]);
    return created;
  }

  async function updatePlay(id: string, play: Play): Promise<Play> {
    const updated = migratePlay(await api.plays.update(id, play));
    setPlays((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }

  async function deletePlay(id: string): Promise<void> {
    await api.plays.delete(id);
    setPlays((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <PlaysContext.Provider value={{
      plays, loading, error,
      selectedPlayId, setSelectedPlayId,
      createPlay, updatePlay, deletePlay, refresh,
    }}>
      {children}
    </PlaysContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePlays(): PlaysContextValue {
  const ctx = useContext(PlaysContext);
  if (!ctx) throw new Error('usePlays must be used within PlaysProvider');
  return ctx;
}

/** Returns the currently-selected play, falling back to the first available. */
export function useSelectedPlay(): Play {
  const { plays, selectedPlayId } = usePlays();
  const play = plays.find((p) => p.id === selectedPlayId) ?? plays[0];
  if (!play) throw new Error('useSelectedPlay: no plays available');
  return play;
}

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ChannelConfig } from '../types';
import { api } from '../lib/api';

// ─── Defaults (used as fallback while loading / backend offline) ──────────────

export const DEFAULT_CHANNELS: ChannelConfig[] = [
  { id: 0, label: 'Channel 0', ledCount: 500, gpioPin: 18 },
  { id: 1, label: 'Channel 1', ledCount: 500, gpioPin: 13 },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface ChannelConfigContextValue {
  channels: ChannelConfig[];
  loading: boolean;
  error: string | null;
  saveChannels: (channels: ChannelConfig[]) => Promise<void>;
}

const ChannelConfigContext = createContext<ChannelConfigContextValue | null>(null);

export function ChannelConfigProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<ChannelConfig[]>(DEFAULT_CHANNELS);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      const fetched = await api.channels.get();
      setChannels(fetched);
      setError(null);
    } catch (e) {
      // Backend unavailable — keep current channels so UI still renders
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  async function saveChannels(updated: ChannelConfig[]): Promise<void> {
    const saved = await api.channels.update(updated);
    setChannels(saved);
  }

  return (
    <ChannelConfigContext.Provider value={{ channels, loading, error, saveChannels }}>
      {children}
    </ChannelConfigContext.Provider>
  );
}

export function useChannelConfig(): ChannelConfigContextValue {
  const ctx = useContext(ChannelConfigContext);
  if (!ctx) throw new Error('useChannelConfig must be used within ChannelConfigProvider');
  return ctx;
}

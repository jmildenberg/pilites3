import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import type { ChannelConfig } from '../types';

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_CHANNELS: ChannelConfig[] = [
  { id: 0, label: 'Channel 0', ledCount: 500, gpioPin: 18 },
  { id: 1, label: 'Channel 1', ledCount: 500, gpioPin: 13 },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface ChannelConfigContextValue {
  channels: ChannelConfig[];
  setChannels: Dispatch<SetStateAction<ChannelConfig[]>>;
}

const ChannelConfigContext = createContext<ChannelConfigContextValue | null>(null);

export function ChannelConfigProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<ChannelConfig[]>(() =>
    loadStorage('pilites.channels', DEFAULT_CHANNELS)
  );

  useEffect(() => {
    localStorage.setItem('pilites.channels', JSON.stringify(channels));
  }, [channels]);

  return (
    <ChannelConfigContext.Provider value={{ channels, setChannels }}>
      {children}
    </ChannelConfigContext.Provider>
  );
}

export function useChannelConfig(): ChannelConfigContextValue {
  const ctx = useContext(ChannelConfigContext);
  if (!ctx) throw new Error('useChannelConfig must be used within ChannelConfigProvider');
  return ctx;
}

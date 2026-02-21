/**
 * Central API client for the PiLites3 backend.
 *
 * Base URL resolution priority:
 *   1. localStorage 'pilites.apiBase'  — runtime override set in Settings
 *   2. VITE_API_BASE_URL               — set at build time for a Pi target
 *   3. Empty string                    — same origin (Pi serving its own frontend)
 */
import type { Play, ChannelConfig } from '../types';

function getApiBase(): string {
  try {
    const override = localStorage.getItem('pilites.apiBase');
    if (override) return override.replace(/\/$/, '');
  } catch {}
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
}

export function wsUrl(): string {
  const base = getApiBase();
  if (base) {
    return base.replace(/^http/, 'ws') + '/ws';
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  plays: {
    list:   ()                     => request<Play[]>('/api/plays'),
    get:    (id: string)           => request<Play>(`/api/plays/${id}`),
    create: (play: Play)           => request<Play>('/api/plays', { method: 'POST', body: JSON.stringify(play) }),
    update: (id: string, p: Play)  => request<Play>(`/api/plays/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
    delete: (id: string)           => request<void>(`/api/plays/${id}`, { method: 'DELETE' }),
  },
  channels: {
    get:    ()                              => request<ChannelConfig[]>('/api/channels'),
    update: (channels: ChannelConfig[])    => request<ChannelConfig[]>('/api/channels', { method: 'PUT', body: JSON.stringify(channels) }),
  },
};

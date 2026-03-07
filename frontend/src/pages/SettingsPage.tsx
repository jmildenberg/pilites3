import { useState, useEffect, useRef } from 'react';
import type { ChannelId } from '../types';
import { useChannelConfig } from '../context/ChannelConfigContext';
import { usePlays } from '../context/PlaysContext';

export function SettingsPage() {
  const { channels, loading: channelsLoading, saveChannels } = useChannelConfig();
  const { error: playsError, loading: playsLoading } = usePlays();

  // Local copy for editing — committed to the backend on Save.
  // useState(channels) captures DEFAULT_CHANNELS on first render because the
  // API fetch runs asynchronously. The effect below syncs localChannels once
  // the real data arrives, provided the user has not already started editing.
  const [localChannels, setLocalChannels] = useState(channels);
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!channelsLoading && !didInitRef.current) {
      didInitRef.current = true;
      setLocalChannels(channels);
    }
  }, [channelsLoading, channels]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const apiUrlRef = useRef<HTMLInputElement>(null);

  function updateChannel(id: ChannelId, patch: Partial<{ label: string; ledCount: number; type: 'rpi' | 'wled'; gpioPin: number; colorOrder: 'RGB' | 'GRB'; wledHost: string; wledPort: number }>) {
    setLocalChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await saveChannels(localChannels);
      // Persist API base URL override for this browser
      const url = apiUrlRef.current?.value.trim() ?? '';
      if (url) localStorage.setItem('pilites.apiBase', url);
      else localStorage.removeItem('pilites.apiBase');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const connected = !playsLoading && !playsError;

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Settings</h2>
        <p className="text-sm text-neutral-500">Hardware configuration — saved to the Pi backend.</p>
      </div>

      {/* Channel configuration */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-neutral-500 uppercase tracking-widest border-b border-[#2e2e2e] pb-2">
          LED Channels
        </h3>
        {localChannels.map((ch) => (
          <div key={ch.id} className="bg-[#1a1a1a] rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Channel {ch.id}</span>
              <span className="text-xs text-neutral-500 font-mono">
                {ch.type === 'wled' ? `WLED ${ch.wledHost ?? '—'}` : `GPIO ${ch.gpioPin}`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Label</label>
                <input
                  value={ch.label}
                  onChange={(e) => updateChannel(ch.id, { label: e.target.value })}
                  className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">LED Count</label>
                <input
                  type="number" value={ch.ledCount} min={1} max={1200}
                  onChange={(e) => updateChannel(ch.id, { ledCount: Number(e.target.value) })}
                  className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-neutral-500 block mb-1">Controller Type</label>
                <select
                  value={ch.type}
                  onChange={(e) => updateChannel(ch.id, { type: e.target.value as 'rpi' | 'wled' })}
                  className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
                >
                  <option value="rpi">Raspberry Pi GPIO (rpi_ws281x)</option>
                  <option value="wled">WLED ESP32 (DDP over UDP)</option>
                </select>
              </div>

              {ch.type === 'rpi' ? (
                <>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">GPIO Pin</label>
                    <input
                      type="number" value={ch.gpioPin}
                      onChange={(e) => updateChannel(ch.id, { gpioPin: Number(e.target.value) })}
                      className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Color Order</label>
                    <select
                      value={ch.colorOrder}
                      onChange={(e) => updateChannel(ch.id, { colorOrder: e.target.value as 'RGB' | 'GRB' })}
                      className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
                    >
                      <option value="RGB">RGB (WS2811)</option>
                      <option value="GRB">GRB (WS2812 / WS2815)</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">WLED Host</label>
                    <input
                      value={ch.wledHost ?? ''}
                      placeholder="192.168.1.50"
                      onChange={(e) => updateChannel(ch.id, { wledHost: e.target.value })}
                      className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm font-mono text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">DDP Port</label>
                    <input
                      type="number" value={ch.wledPort ?? 4048}
                      onChange={(e) => updateChannel(ch.id, { wledPort: Number(e.target.value) })}
                      className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* API connection */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-neutral-500 uppercase tracking-widest border-b border-[#2e2e2e] pb-2">
          Backend Connection
        </h3>
        <div className="bg-[#1a1a1a] rounded-lg p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1">
              API Base URL <span className="text-neutral-700">(leave blank when Pi serves the app)</span>
            </label>
            <input
              ref={apiUrlRef}
              defaultValue={(() => { try { return localStorage.getItem('pilites.apiBase') ?? ''; } catch { return ''; } })()}
              placeholder="http://raspberrypi.local:8000"
              className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm font-mono text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${playsLoading ? 'bg-yellow-500' : connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-neutral-500">
              {playsLoading ? 'Connecting…' : connected ? 'Connected to backend' : `Backend offline — ${playsError}`}
            </span>
          </div>
        </div>
      </section>

      {saveError && (
        <p className="text-sm text-red-400">{saveError}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start bg-[#646cff] hover:bg-[#535bf2] disabled:bg-[#2e2e2e] disabled:text-neutral-600 text-white font-semibold text-sm px-5 py-2 rounded transition-colors"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Settings'}
      </button>
    </div>
  );
}

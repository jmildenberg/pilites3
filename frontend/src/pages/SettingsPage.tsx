import type { ChannelId } from '../types';
import { useChannelConfig } from '../context/ChannelConfigContext';

export function SettingsPage() {
  const { channels, setChannels } = useChannelConfig();

  function updateChannel(id: ChannelId, patch: Partial<{ label: string; ledCount: number; gpioPin: number }>) {
    setChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)));
  }

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
        {channels.map((ch) => (
          <div key={ch.id} className="bg-[#1a1a1a] rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Channel {ch.id}</span>
              <span className="text-xs text-neutral-500 font-mono">GPIO {ch.gpioPin}</span>
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
              <div>
                <label className="text-xs text-neutral-500 block mb-1">GPIO Pin</label>
                <input
                  type="number" value={ch.gpioPin}
                  onChange={(e) => updateChannel(ch.id, { gpioPin: Number(e.target.value) })}
                  className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Strip Type</label>
                <select className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm text-neutral-300 outline-none focus:ring-1 ring-[#646cff]">
                  <option value="WS2812">WS2812 (RGB)</option>
                  <option value="SK6812">SK6812 (RGBW)</option>
                </select>
              </div>
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
            <label className="text-xs text-neutral-500 block mb-1">API Base URL</label>
            <input
              defaultValue="http://localhost:8000"
              className="w-full bg-[#2e2e2e] rounded px-3 py-2 text-sm font-mono text-neutral-300 outline-none focus:ring-1 ring-[#646cff]"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neutral-600" />
            <span className="text-xs text-neutral-500">Not connected — backend not running</span>
          </div>
        </div>
      </section>

      <button className="self-start bg-[#646cff] hover:bg-[#535bf2] text-white font-semibold text-sm px-5 py-2 rounded transition-colors">
        Save Settings
      </button>
    </div>
  );
}

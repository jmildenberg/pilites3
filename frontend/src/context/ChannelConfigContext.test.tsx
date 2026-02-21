import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ChannelConfigProvider, useChannelConfig, DEFAULT_CHANNELS } from './ChannelConfigContext';
import type { ChannelConfig } from '../types';

// ─── Mock fetch ───────────────────────────────────────────────────────────────

function mockFetch(response: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(response),
  }));
}

beforeEach(() => {
  mockFetch(DEFAULT_CHANNELS);
});

// ─── Helper components ────────────────────────────────────────────────────────

function Inspector() {
  const { channels } = useChannelConfig();
  return (
    <div>
      <span data-testid="count">{channels.length}</span>
      {channels.map((ch) => (
        <div key={ch.id} data-testid={`ch-${ch.id}`}>
          <span data-testid={`label-${ch.id}`}>{ch.label}</span>
          <span data-testid={`leds-${ch.id}`}>{ch.ledCount}</span>
          <span data-testid={`gpio-${ch.id}`}>{ch.gpioPin}</span>
        </div>
      ))}
    </div>
  );
}

function Mutator() {
  const { channels, saveChannels } = useChannelConfig();
  return (
    <>
      <button
        onClick={() =>
          saveChannels(channels.map((ch) => ch.id === 0 ? { ...ch, ledCount: 300 } : ch))
        }
      >
        Set CH0 to 300
      </button>
      <button
        onClick={() =>
          saveChannels(channels.map((ch) => ch.id === 0 ? { ...ch, label: 'Main Stage' } : ch))
        }
      >
        Rename CH0
      </button>
    </>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChannelConfigProvider / useChannelConfig', () => {
  it('provides two channels by default', async () => {
    await act(async () => {
      render(
        <ChannelConfigProvider>
          <Inspector />
        </ChannelConfigProvider>
      );
    });
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('defaults to 500 LEDs per channel', async () => {
    await act(async () => {
      render(
        <ChannelConfigProvider>
          <Inspector />
        </ChannelConfigProvider>
      );
    });
    expect(screen.getByTestId('leds-0').textContent).toBe('500');
    expect(screen.getByTestId('leds-1').textContent).toBe('500');
  });

  it('sets correct GPIO pins (18 and 13)', async () => {
    await act(async () => {
      render(
        <ChannelConfigProvider>
          <Inspector />
        </ChannelConfigProvider>
      );
    });
    expect(screen.getByTestId('gpio-0').textContent).toBe('18');
    expect(screen.getByTestId('gpio-1').textContent).toBe('13');
  });

  it('saveChannels updates LED count', async () => {
    const updated: ChannelConfig[] = DEFAULT_CHANNELS.map((ch) =>
      ch.id === 0 ? { ...ch, ledCount: 300 } : ch
    );
    mockFetch(updated); // PUT /api/channels returns updated list

    await act(async () => {
      render(
        <ChannelConfigProvider>
          <Inspector />
          <Mutator />
        </ChannelConfigProvider>
      );
    });

    // Second fetch call (the PUT) returns updated channels
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(updated),
    }));

    await act(async () => {
      screen.getByText('Set CH0 to 300').click();
    });
    expect(screen.getByTestId('leds-0').textContent).toBe('300');
    expect(screen.getByTestId('leds-1').textContent).toBe('500');
  });

  it('saveChannels updates label', async () => {
    const updated: ChannelConfig[] = DEFAULT_CHANNELS.map((ch) =>
      ch.id === 0 ? { ...ch, label: 'Main Stage' } : ch
    );

    await act(async () => {
      render(
        <ChannelConfigProvider>
          <Inspector />
          <Mutator />
        </ChannelConfigProvider>
      );
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(updated),
    }));

    await act(async () => {
      screen.getByText('Rename CH0').click();
    });
    expect(screen.getByTestId('label-0').textContent).toBe('Main Stage');
  });

  it('DEFAULT_CHANNELS export matches provider defaults', () => {
    expect(DEFAULT_CHANNELS).toHaveLength(2);
    expect(DEFAULT_CHANNELS[0]).toMatchObject({ id: 0, ledCount: 500, gpioPin: 18 });
    expect(DEFAULT_CHANNELS[1]).toMatchObject({ id: 1, ledCount: 500, gpioPin: 13 });
  });
});

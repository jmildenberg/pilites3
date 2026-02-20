import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ChannelConfigProvider, useChannelConfig, DEFAULT_CHANNELS } from './ChannelConfigContext';

// ─── Helper: component that exposes context values ────────────────────────────

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
  const { setChannels } = useChannelConfig();
  return (
    <>
      <button
        onClick={() =>
          setChannels((prev) =>
            prev.map((ch) => (ch.id === 0 ? { ...ch, ledCount: 300 } : ch))
          )
        }
      >
        Set CH0 to 300
      </button>
      <button
        onClick={() =>
          setChannels((prev) =>
            prev.map((ch) => (ch.id === 0 ? { ...ch, label: 'Main Stage' } : ch))
          )
        }
      >
        Rename CH0
      </button>
    </>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChannelConfigProvider / useChannelConfig', () => {
  it('provides two channels by default', () => {
    render(
      <ChannelConfigProvider>
        <Inspector />
      </ChannelConfigProvider>
    );
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('defaults to 500 LEDs per channel', () => {
    render(
      <ChannelConfigProvider>
        <Inspector />
      </ChannelConfigProvider>
    );
    expect(screen.getByTestId('leds-0').textContent).toBe('500');
    expect(screen.getByTestId('leds-1').textContent).toBe('500');
  });

  it('sets correct GPIO pins (18 and 13)', () => {
    render(
      <ChannelConfigProvider>
        <Inspector />
      </ChannelConfigProvider>
    );
    expect(screen.getByTestId('gpio-0').textContent).toBe('18');
    expect(screen.getByTestId('gpio-1').textContent).toBe('13');
  });

  it('setChannels updates LED count', async () => {
    render(
      <ChannelConfigProvider>
        <Inspector />
        <Mutator />
      </ChannelConfigProvider>
    );
    await act(async () => {
      screen.getByText('Set CH0 to 300').click();
    });
    expect(screen.getByTestId('leds-0').textContent).toBe('300');
    expect(screen.getByTestId('leds-1').textContent).toBe('500'); // ch1 unchanged
  });

  it('setChannels updates label', async () => {
    render(
      <ChannelConfigProvider>
        <Inspector />
        <Mutator />
      </ChannelConfigProvider>
    );
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

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PlaysProvider, usePlays, useSelectedPlay } from './PlaysContext';

beforeEach(() => { localStorage.clear(); });

// ─── Helper: component that exposes context values ───────────────────────────

function Inspector() {
  const { plays, selectedPlayId } = usePlays();
  const selected = useSelectedPlay();
  return (
    <div>
      <span data-testid="play-count">{plays.length}</span>
      <span data-testid="selected-id">{selectedPlayId}</span>
      <span data-testid="selected-title">{selected.title}</span>
    </div>
  );
}

function Mutator() {
  const { setPlays, setSelectedPlayId, plays } = usePlays();
  return (
    <>
      <button
        onClick={() =>
          setPlays((prev) => [
            ...prev,
            {
              id: 'p2',
              title: 'Second Show',
              description: '',
              regions: [],
              cues: [],
              createdAt: '',
              updatedAt: '',
            },
          ])
        }
      >
        Add Play
      </button>
      <button onClick={() => setSelectedPlayId('p2')}>Select p2</button>
      <button
        onClick={() =>
          setPlays((prev) =>
            prev.map((p) =>
              p.id === plays[0].id ? { ...p, title: 'Renamed Show' } : p
            )
          )
        }
      >
        Rename First
      </button>
    </>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlaysProvider / usePlays / useSelectedPlay', () => {
  it('provides the seed play by default', () => {
    render(
      <PlaysProvider>
        <Inspector />
      </PlaysProvider>
    );
    expect(screen.getByTestId('play-count').textContent).toBe('1');
    expect(screen.getByTestId('selected-title').textContent).toBe('Sample Show');
  });

  it('selectedPlayId matches the first play id', () => {
    render(
      <PlaysProvider>
        <Inspector />
      </PlaysProvider>
    );
    expect(screen.getByTestId('selected-id').textContent).toBe('p1');
  });

  it('setPlays adds a new play', async () => {
    render(
      <PlaysProvider>
        <Inspector />
        <Mutator />
      </PlaysProvider>
    );
    await act(async () => {
      screen.getByText('Add Play').click();
    });
    expect(screen.getByTestId('play-count').textContent).toBe('2');
  });

  it('setSelectedPlayId changes the active play', async () => {
    render(
      <PlaysProvider>
        <Inspector />
        <Mutator />
      </PlaysProvider>
    );
    await act(async () => {
      screen.getByText('Add Play').click();
    });
    await act(async () => {
      screen.getByText('Select p2').click();
    });
    expect(screen.getByTestId('selected-title').textContent).toBe('Second Show');
    expect(screen.getByTestId('selected-id').textContent).toBe('p2');
  });

  it('useSelectedPlay reflects play title mutations', async () => {
    render(
      <PlaysProvider>
        <Inspector />
        <Mutator />
      </PlaysProvider>
    );
    await act(async () => {
      screen.getByText('Rename First').click();
    });
    expect(screen.getByTestId('selected-title').textContent).toBe('Renamed Show');
  });

  it('useSelectedPlay falls back to first play when selectedPlayId is unknown', async () => {
    render(
      <PlaysProvider>
        <Inspector />
        <Mutator />
      </PlaysProvider>
    );
    // Select an id that does not exist
    await act(async () => {
      screen.getByText('Select p2').click(); // p2 not added yet → fallback
    });
    expect(screen.getByTestId('selected-title').textContent).toBe('Sample Show');
  });
});

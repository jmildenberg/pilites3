import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PlaysProvider, usePlays, useSelectedPlay } from './PlaysContext';
import type { Play } from '../types';

// ─── Seed play (matches INITIAL_PLAYS shape) ──────────────────────────────────

const SEED_PLAY: Play = {
  id: 'p1',
  title: 'Sample Show',
  description: '',
  regions: [],
  cues: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const SECOND_PLAY: Play = {
  id: 'p2',
  title: 'Second Show',
  description: '',
  regions: [],
  cues: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Mock fetch ───────────────────────────────────────────────────────────────

function mockFetch(plays: Play[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(plays),
  }));
}

beforeEach(() => {
  localStorage.clear();
  mockFetch([SEED_PLAY]);
});

// ─── Helper components ────────────────────────────────────────────────────────

function Inspector() {
  const { plays, selectedPlayId, loading } = usePlays();
  const selected = plays.length > 0 ? useSelectedPlay() : null;
  return (
    <div>
      <span data-testid="play-count">{plays.length}</span>
      <span data-testid="selected-id">{selectedPlayId ?? ''}</span>
      <span data-testid="selected-title">{selected?.title ?? ''}</span>
      <span data-testid="loading">{loading ? 'loading' : 'done'}</span>
    </div>
  );
}

function Mutator() {
  const { createPlay, updatePlay, deletePlay, setSelectedPlayId, plays } = usePlays();
  return (
    <>
      <button onClick={() => createPlay(SECOND_PLAY)}>Add Play</button>
      <button onClick={() => setSelectedPlayId('p2')}>Select p2</button>
      <button
        onClick={() =>
          plays[0] && updatePlay(plays[0].id, { ...plays[0], title: 'Renamed Show' })
        }
      >
        Rename First
      </button>
      <button onClick={() => plays[0] && deletePlay(plays[0].id)}>Delete First</button>
    </>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlaysProvider / usePlays / useSelectedPlay', () => {
  it('loads plays from the API on mount', async () => {
    await act(async () => {
      render(
        <PlaysProvider>
          <Inspector />
        </PlaysProvider>
      );
    });
    expect(screen.getByTestId('play-count').textContent).toBe('1');
    expect(screen.getByTestId('selected-title').textContent).toBe('Sample Show');
  });

  it('selectedPlayId matches the first play id after load', async () => {
    await act(async () => {
      render(
        <PlaysProvider>
          <Inspector />
        </PlaysProvider>
      );
    });
    expect(screen.getByTestId('selected-id').textContent).toBe('p1');
  });

  it('createPlay adds a new play', async () => {
    // First call (GET /api/plays) → seed; second call (POST) → SECOND_PLAY
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([SEED_PLAY]) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve(SECOND_PLAY) })
    );

    await act(async () => {
      render(
        <PlaysProvider>
          <Inspector />
          <Mutator />
        </PlaysProvider>
      );
    });
    await act(async () => {
      screen.getByText('Add Play').click();
    });
    expect(screen.getByTestId('play-count').textContent).toBe('2');
  });

  it('setSelectedPlayId changes the active play', async () => {
    mockFetch([SEED_PLAY, SECOND_PLAY]);

    await act(async () => {
      render(
        <PlaysProvider>
          <Inspector />
          <Mutator />
        </PlaysProvider>
      );
    });
    await act(async () => {
      screen.getByText('Select p2').click();
    });
    expect(screen.getByTestId('selected-id').textContent).toBe('p2');
    expect(screen.getByTestId('selected-title').textContent).toBe('Second Show');
  });

  it('updatePlay reflects title mutations', async () => {
    const renamed = { ...SEED_PLAY, title: 'Renamed Show' };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([SEED_PLAY]) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(renamed) })
    );

    await act(async () => {
      render(
        <PlaysProvider>
          <Inspector />
          <Mutator />
        </PlaysProvider>
      );
    });
    await act(async () => {
      screen.getByText('Rename First').click();
    });
    expect(screen.getByTestId('selected-title').textContent).toBe('Renamed Show');
  });

  it('useSelectedPlay falls back to first play when selectedPlayId is unknown', async () => {
    await act(async () => {
      render(
        <PlaysProvider>
          <Inspector />
          <Mutator />
        </PlaysProvider>
      );
    });
    // p2 is not in the plays list — should fall back to first play
    await act(async () => {
      screen.getByText('Select p2').click();
    });
    expect(screen.getByTestId('selected-title').textContent).toBe('Sample Show');
  });
});

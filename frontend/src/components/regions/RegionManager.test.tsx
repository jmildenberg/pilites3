import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegionManager } from './RegionManager';
import type { Play, Region } from '../../types';
import { ChannelConfigProvider } from '../../context/ChannelConfigContext';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ChannelConfigProvider>{children}</ChannelConfigProvider>;
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makePlay(regions: Region[] = []): Play {
  return {
    id: 'p1',
    title: 'Test',
    description: '',
    regions,
    cues: [],
    createdAt: '',
    updatedAt: '',
  };
}

const r1: Region = { id: 'r1', label: 'Stage Left', channelId: 0, startIndex: 0,   endIndex: 149, uiColor: '#a855f7' };
const r2: Region = { id: 'r2', label: 'Backdrop',   channelId: 1, startIndex: 0,   endIndex: 249, uiColor: '#22c55e' };

/**
 * Click the region LIST item (not the strip button) by matching the button
 * whose accessible name includes both the label and the channel badge "CH0"/"CH1".
 * The strip button shows only the label; the list item shows "Label CH#".
 */
function getListButton(name: string) {
  return screen.getByRole('button', { name: new RegExp(`${name}.*CH`) });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegionManager', () => {
  describe('initial render', () => {
    it('shows "No regions defined" when the play has no regions', () => {
      render(<RegionManager play={makePlay()} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      expect(screen.getByText('No regions defined.')).toBeInTheDocument();
    });

    it('renders a list entry for each region', () => {
      render(<RegionManager play={makePlay([r1, r2])} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      // Each region appears in the list with its channel badge
      expect(getListButton('Stage Left')).toBeInTheDocument();
      expect(getListButton('Backdrop')).toBeInTheDocument();
    });

    it('does not show the edit panel before selecting a region', () => {
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      expect(screen.queryByText('Edit Region')).not.toBeInTheDocument();
    });

    it('shows channel labels for each region', () => {
      render(<RegionManager play={makePlay([r1, r2])} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      expect(screen.getByText('CH0')).toBeInTheDocument();
      expect(screen.getByText('CH1')).toBeInTheDocument();
    });
  });

  describe('selecting a region', () => {
    it('opens the edit panel when a region is clicked', async () => {
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));
      expect(screen.getByText('Edit Region')).toBeInTheDocument();
    });

    it('pre-fills label input with the region label', async () => {
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));
      expect(screen.getByDisplayValue('Stage Left')).toBeInTheDocument();
    });

    it('pre-fills start LED input', async () => {
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));
      const [startInput] = screen.getAllByRole('spinbutton');
      expect(startInput).toHaveValue(0);
    });

    it('pre-fills end LED input', async () => {
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));
      const [, endInput] = screen.getAllByRole('spinbutton');
      expect(endInput).toHaveValue(149);
    });

    it('shows the LED range summary', async () => {
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));
      expect(screen.getByText(/LEDs 0–149/)).toBeInTheDocument();
    });
  });

  describe('editing a region', () => {
    it('calls onUpdateRegions with new label on blur', async () => {
      const onUpdate = vi.fn();
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={onUpdate} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));

      const labelInput = screen.getByDisplayValue('Stage Left');
      await userEvent.clear(labelInput);
      await userEvent.type(labelInput, 'New Name');
      fireEvent.blur(labelInput);

      expect(onUpdate).toHaveBeenCalled();
        const updatedRegions: Region[] = onUpdate.mock.calls.at(-1)?.[0] ?? [];
      expect(updatedRegions.find((r) => r.id === 'r1')?.label).toBe('New Name');
    });

    it('panel stays open after editing label', async () => {
      const onUpdate = vi.fn();
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={onUpdate} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));

      const labelInput = screen.getByDisplayValue('Stage Left');
      await userEvent.clear(labelInput);
      await userEvent.type(labelInput, 'Renamed');
      fireEvent.blur(labelInput);

      expect(screen.getByText('Edit Region')).toBeInTheDocument();
    });

    it('calls onUpdateRegions with new startIndex on blur', async () => {
      const onUpdate = vi.fn();
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={onUpdate} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));

      const [startInput] = screen.getAllByRole('spinbutton');
      await userEvent.clear(startInput);
      await userEvent.type(startInput, '10');
      fireEvent.blur(startInput);

      expect(onUpdate).toHaveBeenCalled();
        const updatedRegions: Region[] = onUpdate.mock.calls.at(-1)?.[0] ?? [];
      expect(updatedRegions.find((r) => r.id === 'r1')?.startIndex).toBe(10);
    });

    it('calls onUpdateRegions with new endIndex on blur', async () => {
      const onUpdate = vi.fn();
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={onUpdate} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));

      const [, endInput] = screen.getAllByRole('spinbutton');
      await userEvent.clear(endInput);
      await userEvent.type(endInput, '199');
      fireEvent.blur(endInput);

      expect(onUpdate).toHaveBeenCalled();
        const updatedRegions: Region[] = onUpdate.mock.calls.at(-1)?.[0] ?? [];
      expect(updatedRegions.find((r) => r.id === 'r1')?.endIndex).toBe(199);
    });

    it('calls onUpdateRegions immediately when a color swatch is clicked', async () => {
      const onUpdate = vi.fn();
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={onUpdate} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));

      // The blue swatch (#3b82f6) is a different color from r1's current uiColor (#a855f7)
      const blueSwatchTitle = '#3b82f6';
      // Swatches are plain buttons styled via backgroundColor — find by iterating
      const swatches = document
        .querySelectorAll<HTMLButtonElement>('button[style*="background-color"]');
      const blueSwatch = [...swatches].find(
        (btn) => btn.style.backgroundColor && !btn.style.backgroundColor.includes('168') // not the purple one
      );
      if (!blueSwatch) throw new Error('Could not find a non-selected color swatch');
      await userEvent.click(blueSwatch);

      expect(onUpdate).toHaveBeenCalled();
      const updatedRegions: Region[] = onUpdate.mock.calls.at(-1)?.[0] ?? [];
      expect(updatedRegions.find((r) => r.id === 'r1')?.uiColor).not.toBe('#a855f7');
      void blueSwatchTitle; // suppress unused var warning
    });
  });

  describe('deleting a region', () => {
    it('calls onUpdateRegions without the deleted region', async () => {
      const onUpdate = vi.fn();
      render(<RegionManager play={makePlay([r1, r2])} onUpdateRegions={onUpdate} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));
      await userEvent.click(screen.getByText('Delete'));

      expect(onUpdate).toHaveBeenCalled();
      const updatedRegions: Region[] = onUpdate.mock.calls.at(-1)?.[0] ?? [];
      expect(updatedRegions.some((r) => r.id === 'r1')).toBe(false);
      expect(updatedRegions.some((r) => r.id === 'r2')).toBe(true);
    });

    it('closes the edit panel after deletion', async () => {
      const onUpdate = vi.fn();
      render(<RegionManager play={makePlay([r1])} onUpdateRegions={onUpdate} />, { wrapper: Wrapper });
      await userEvent.click(getListButton('Stage Left'));
      await userEvent.click(screen.getByText('Delete'));
      expect(screen.queryByText('Edit Region')).not.toBeInTheDocument();
    });
  });

  describe('adding a region via the strip gap', () => {
    it('shows a + button for unallocated spans', () => {
      render(<RegionManager play={makePlay()} onUpdateRegions={vi.fn()} />, { wrapper: Wrapper });
      const addButtons = screen.getAllByTitle(/Add region/);
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('calls onUpdateRegions with a new region when + is clicked', async () => {
      const onUpdate = vi.fn();
      render(<RegionManager play={makePlay()} onUpdateRegions={onUpdate} />, { wrapper: Wrapper });
      const [firstAddButton] = screen.getAllByTitle(/Add region/);
      await userEvent.click(firstAddButton);
      expect(onUpdate).toHaveBeenCalled();
      const newRegions: Region[] = onUpdate.mock.calls[0][0];
      expect(newRegions).toHaveLength(1);
    });

    it('opens the edit panel after adding (controlled re-render)', async () => {
      let currentRegions: Region[] = [];
      const { rerender } = render(
        <RegionManager
          play={makePlay(currentRegions)}
          onUpdateRegions={(r) => { currentRegions = r; }}
        />,
        { wrapper: Wrapper }
      );

      const [firstAddButton] = screen.getAllByTitle(/Add region/);
      await userEvent.click(firstAddButton);

      rerender(
        <RegionManager
          play={makePlay(currentRegions)}
          onUpdateRegions={(r) => { currentRegions = r; }}
        />
      );

      expect(screen.getByText('Edit Region')).toBeInTheDocument();
    });
  });
});

"""
Per-channel animation loop.

Architecture
------------
One ChannelRenderer per channel. Each runs a single asyncio Task that loops at
the configured FPS. On WebSocket disconnect the loop keeps running — LEDs hold
their last rendered frame.
"""
from __future__ import annotations
import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from models import ChannelConfig, ActiveRegionEntry, Effect
from effects import render_effect

logger = logging.getLogger(__name__)

# One pixel frame: (channel_id, pixel_list)
PixelFrame = tuple[int, list[tuple[int, int, int, int]]]


# ─── Per-region state ─────────────────────────────────────────────────────────

@dataclass
class ActiveRegionState:
    region_id: str
    start_index: int
    end_index: int
    effect: Effect
    started_at: float = field(default_factory=time.monotonic)
    # Mutable dict that persists across frames for stateful effects
    # (Fire heat array, Twinkle levels, Chase position/direction, etc.)
    per_effect_state: dict[str, Any] = field(default_factory=dict)


# ─── Single-channel renderer ──────────────────────────────────────────────────

class ChannelRenderer:
    def __init__(self, channel_config: ChannelConfig, strip: Any, fps: int) -> None:
        self._config = channel_config
        self._strip = strip
        self._fps = fps
        self._frame_interval = 1.0 / fps
        self._lock = asyncio.Lock()
        self._active_regions: dict[str, ActiveRegionState] = {}
        self._task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._preview_queues: set[asyncio.Queue[PixelFrame]] = set()

    # ── Public API ────────────────────────────────────────────────────────────

    async def start(self) -> None:
        self._task = asyncio.create_task(
            self._render_loop(),
            name=f"renderer-ch{self._config.id}",
        )
        logger.info("Channel %d renderer started at %d FPS", self._config.id, self._fps)

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def set_regions(self, entries: list[ActiveRegionEntry]) -> None:
        """
        Apply effect definitions for the given regions on this channel.
        Preserves per-effect state when the same effect type is re-applied
        (e.g. tweaking Fire brightness shouldn't reset the heat array).
        """
        async with self._lock:
            for entry in entries:
                existing = self._active_regions.get(entry.regionId)
                if existing and existing.effect.type == entry.effect.type:
                    per_state = existing.per_effect_state
                    started_at = existing.started_at
                else:
                    per_state = {}
                    started_at = time.monotonic()
                self._active_regions[entry.regionId] = ActiveRegionState(
                    region_id=entry.regionId,
                    start_index=entry.startIndex,
                    end_index=entry.endIndex,
                    effect=entry.effect,
                    started_at=started_at,
                    per_effect_state=per_state,
                )

    async def blackout(self) -> None:
        """Clear all regions and immediately push zeros to hardware."""
        async with self._lock:
            self._active_regions.clear()
        self._write_blackout()

    def add_preview_subscriber(self, q: asyncio.Queue[PixelFrame]) -> None:
        """Register a queue to receive a copy of every rendered pixel frame."""
        self._preview_queues.add(q)

    def remove_preview_subscriber(self, q: asyncio.Queue[PixelFrame]) -> None:
        """Deregister a preview queue."""
        self._preview_queues.discard(q)

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _render_loop(self) -> None:
        self._strip.begin()
        logger.info(
            "Channel %d strip begin(), %d LEDs on GPIO %d",
            self._config.id, self._config.ledCount, self._config.gpioPin,
        )
        while True:
            frame_start = time.monotonic()
            try:
                await self._render_frame()
            except Exception:
                logger.exception("Channel %d frame error", self._config.id)
            elapsed = time.monotonic() - frame_start
            await asyncio.sleep(max(0.0, self._frame_interval - elapsed))

    async def _render_frame(self) -> None:
        led_count = self._config.ledCount
        dt = self._frame_interval
        now = time.monotonic()

        # Snapshot under lock to keep critical section short
        async with self._lock:
            snapshot = list(self._active_regions.values())

        pixels: list[tuple[int, int, int, int]] = [(0, 0, 0, 0)] * led_count

        for rs in snapshot:
            region_length = rs.end_index - rs.start_index + 1
            if region_length <= 0:
                continue
            t = now - rs.started_at
            rs.per_effect_state["dt"] = dt
            rendered = render_effect(rs.effect, region_length, t, rs.per_effect_state)
            for i, pixel in enumerate(rendered):
                idx = rs.start_index + i
                if 0 <= idx < led_count:
                    pixels[idx] = pixel

        self._write_pixels(pixels)
        self._strip.show()

        # Broadcast to any connected preview subscribers.
        # Drop the frame (put_nowait) if a subscriber is falling behind.
        for q in self._preview_queues:
            try:
                q.put_nowait((self._config.id, pixels))
            except asyncio.QueueFull:
                pass

    def _make_color(self, r: int, g: int, b: int, w: int) -> Any:
        try:
            from rpi_ws281x import Color  # type: ignore[import]
        except (ImportError, RuntimeError):
            from led_stub import Color  # type: ignore[import, no-redef]
        return Color(r, g, b, w)

    def _write_pixels(self, pixels: list[tuple[int, int, int, int]]) -> None:
        for i, (r, g, b, w) in enumerate(pixels):
            self._strip.setPixelColor(i, self._make_color(r, g, b, w))

    def _write_blackout(self) -> None:
        led_count = self._config.ledCount
        black = self._make_color(0, 0, 0, 0)
        for i in range(led_count):
            self._strip.setPixelColor(i, black)
        self._strip.show()


# ─── Multi-channel manager ────────────────────────────────────────────────────

class RendererManager:
    """Top-level manager owning one ChannelRenderer per channel."""

    def __init__(self, channel_configs: list[ChannelConfig], fps: int) -> None:
        self._fps = fps
        self._renderers: dict[int, ChannelRenderer] = {}
        self._build(channel_configs)

    def _build(self, channel_configs: list[ChannelConfig]) -> None:
        try:
            from rpi_ws281x import PixelStrip, WS2811_STRIP_RGB, WS2811_STRIP_GRB  # type: ignore[import]
            logger.info("rpi_ws281x loaded — running on Pi hardware")
        except (ImportError, RuntimeError):
            from led_stub import PixelStrip, WS2811_STRIP_RGB, WS2811_STRIP_GRB  # type: ignore[import, no-redef]
            logger.info("rpi_ws281x unavailable — using LED stub (dev mode)")

        for cfg in channel_configs:
            strip_type = WS2811_STRIP_GRB if cfg.colorOrder == "GRB" else WS2811_STRIP_RGB
            strip = PixelStrip(num=cfg.ledCount, pin=cfg.gpioPin, channel=cfg.id, dma=10, strip_type=strip_type)
            self._renderers[cfg.id] = ChannelRenderer(cfg, strip, self._fps)

    async def start_all(self) -> None:
        for renderer in self._renderers.values():
            await renderer.start()

    async def stop_all(self) -> None:
        for renderer in self._renderers.values():
            await renderer.stop()

    async def apply_set_regions(self, entries: list[ActiveRegionEntry]) -> None:
        """Fan out entries to the correct channel renderer by channelId."""
        by_channel: dict[int, list[ActiveRegionEntry]] = {}
        for entry in entries:
            by_channel.setdefault(entry.channelId, []).append(entry)
        for ch_id, ch_entries in by_channel.items():
            if ch_id in self._renderers:
                await self._renderers[ch_id].set_regions(ch_entries)

    async def blackout(self) -> None:
        for renderer in self._renderers.values():
            await renderer.blackout()

    def channel_ids(self) -> list[int]:
        return list(self._renderers.keys())

    def subscribe_preview(self, channel_id: int, q: asyncio.Queue[PixelFrame]) -> None:
        if channel_id in self._renderers:
            self._renderers[channel_id].add_preview_subscriber(q)

    def unsubscribe_preview(self, channel_id: int, q: asyncio.Queue[PixelFrame]) -> None:
        if channel_id in self._renderers:
            self._renderers[channel_id].remove_preview_subscriber(q)

    async def reload_channels(self, new_configs: list[ChannelConfig]) -> None:
        """
        Replace hardware config. Stops current renderers, rebuilds strips,
        restarts. Active region state is lost (channels may have resized).
        """
        await self.stop_all()
        # Explicitly call ws2811_fini on each strip so DMA/PWM hardware is
        # fully released before ws2811_init is called again. Without this the
        # second init lands on top of still-live hardware and the two PWM
        # channels can end up crossed.
        for renderer in self._renderers.values():
            cleanup = getattr(renderer._strip, '_cleanup', None)
            if callable(cleanup):
                cleanup()
        self._renderers.clear()
        self._build(new_configs)
        await self.start_all()
        logger.info("Channels reloaded: %s", [c.id for c in new_configs])

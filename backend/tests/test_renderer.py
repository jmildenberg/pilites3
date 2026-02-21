"""Unit tests for ChannelRenderer subscriber infrastructure and RendererManager helpers."""
import asyncio
from typing import Any

import pytest

from models import ChannelConfig
from renderer import ChannelRenderer, RendererManager, PixelFrame


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cfg(ch_id: int = 0, led_count: int = 10) -> ChannelConfig:
    return ChannelConfig(
        id=ch_id,
        label=f"Ch{ch_id}",
        ledCount=led_count,
        gpioPin=18 if ch_id == 0 else 13,
    )


class FakeStrip:
    """Minimal LED strip stub for renderer unit tests."""

    def __init__(self, led_count: int) -> None:
        self.led_count = led_count
        self.show_count = 0

    def begin(self) -> None:
        pass

    def setPixelColor(self, _i: int, _color: Any) -> None:
        pass

    def show(self) -> None:
        self.show_count += 1


def _renderer(ch_id: int = 0, led_count: int = 10) -> ChannelRenderer:
    return ChannelRenderer(_cfg(ch_id, led_count), FakeStrip(led_count), fps=30)


def _queue(maxsize: int = 4) -> "asyncio.Queue[PixelFrame]":
    return asyncio.Queue(maxsize=maxsize)


# ── ChannelRenderer — synchronous subscriber methods ─────────────────────────

class TestChannelRendererSubscriber:
    def test_add_subscriber(self) -> None:
        r = _renderer()
        q = _queue()
        r.add_preview_subscriber(q)
        assert q in r._preview_queues

    def test_remove_subscriber(self) -> None:
        r = _renderer()
        q = _queue()
        r.add_preview_subscriber(q)
        r.remove_preview_subscriber(q)
        assert q not in r._preview_queues

    def test_remove_nonexistent_is_safe(self) -> None:
        r = _renderer()
        q = _queue()
        r.remove_preview_subscriber(q)  # must not raise

    def test_multiple_subscribers_tracked(self) -> None:
        r = _renderer()
        q1, q2 = _queue(), _queue()
        r.add_preview_subscriber(q1)
        r.add_preview_subscriber(q2)
        assert q1 in r._preview_queues
        assert q2 in r._preview_queues

    def test_starts_with_no_subscribers(self) -> None:
        r = _renderer()
        assert len(r._preview_queues) == 0


# ── ChannelRenderer — async broadcast behaviour ───────────────────────────────

class TestChannelRendererBroadcast:
    def test_frame_delivered_to_subscriber(self) -> None:
        async def _run() -> None:
            r = _renderer(led_count=10)
            q: asyncio.Queue[PixelFrame] = asyncio.Queue(maxsize=4)
            r.add_preview_subscriber(q)
            await r._render_frame()
            assert not q.empty()
            ch_id, pixels = q.get_nowait()
            assert ch_id == 0
            assert len(pixels) == 10

        asyncio.run(_run())

    def test_pixel_values_are_tuples_of_four(self) -> None:
        async def _run() -> None:
            r = _renderer(led_count=5)
            q: asyncio.Queue[PixelFrame] = asyncio.Queue(maxsize=4)
            r.add_preview_subscriber(q)
            await r._render_frame()
            _, pixels = q.get_nowait()
            for pixel in pixels:
                assert len(pixel) == 4
                assert all(0 <= v <= 255 for v in pixel)

        asyncio.run(_run())

    def test_frame_dropped_when_queue_full(self) -> None:
        async def _run() -> None:
            r = _renderer()
            q: asyncio.Queue[PixelFrame] = asyncio.Queue(maxsize=1)
            r.add_preview_subscriber(q)
            await r._render_frame()  # fills the queue
            assert q.full()
            await r._render_frame()  # must not raise; should drop the frame
            assert q.qsize() == 1   # still only one item

        asyncio.run(_run())

    def test_frame_broadcast_to_multiple_subscribers(self) -> None:
        async def _run() -> None:
            r = _renderer()
            q1: asyncio.Queue[PixelFrame] = asyncio.Queue(maxsize=4)
            q2: asyncio.Queue[PixelFrame] = asyncio.Queue(maxsize=4)
            r.add_preview_subscriber(q1)
            r.add_preview_subscriber(q2)
            await r._render_frame()
            assert not q1.empty()
            assert not q2.empty()

        asyncio.run(_run())

    def test_unsubscribed_queue_receives_no_more_frames(self) -> None:
        async def _run() -> None:
            r = _renderer()
            q: asyncio.Queue[PixelFrame] = asyncio.Queue(maxsize=4)
            r.add_preview_subscriber(q)
            await r._render_frame()
            assert not q.empty()
            q.get_nowait()          # drain

            r.remove_preview_subscriber(q)
            await r._render_frame()
            assert q.empty()        # no new frame after unsubscribe

        asyncio.run(_run())

    def test_strip_show_called_each_frame(self) -> None:
        async def _run() -> None:
            strip = FakeStrip(10)
            r = ChannelRenderer(_cfg(led_count=10), strip, fps=30)
            await r._render_frame()
            await r._render_frame()
            assert strip.show_count == 2

        asyncio.run(_run())


# ── RendererManager — channel_ids and subscribe helpers ──────────────────────

class TestRendererManagerHelpers:
    def test_channel_ids_both_channels(self) -> None:
        configs = [
            ChannelConfig(id=0, label="A", ledCount=10, gpioPin=18),
            ChannelConfig(id=1, label="B", ledCount=10, gpioPin=13),
        ]
        rm = RendererManager(configs, fps=30)
        assert set(rm.channel_ids()) == {0, 1}

    def test_channel_ids_single_channel(self) -> None:
        configs = [ChannelConfig(id=0, label="A", ledCount=10, gpioPin=18)]
        rm = RendererManager(configs, fps=30)
        assert rm.channel_ids() == [0]

    def test_subscribe_preview_registers_queue(self) -> None:
        rm = RendererManager(
            [ChannelConfig(id=0, label="A", ledCount=10, gpioPin=18)],
            fps=30,
        )
        q: asyncio.Queue[PixelFrame] = asyncio.Queue()
        rm.subscribe_preview(0, q)
        assert q in rm._renderers[0]._preview_queues

    def test_unsubscribe_preview_removes_queue(self) -> None:
        rm = RendererManager(
            [ChannelConfig(id=0, label="A", ledCount=10, gpioPin=18)],
            fps=30,
        )
        q: asyncio.Queue[PixelFrame] = asyncio.Queue()
        rm.subscribe_preview(0, q)
        rm.unsubscribe_preview(0, q)
        assert q not in rm._renderers[0]._preview_queues

    def test_subscribe_nonexistent_channel_is_safe(self) -> None:
        rm = RendererManager(
            [ChannelConfig(id=0, label="A", ledCount=10, gpioPin=18)],
            fps=30,
        )
        q: asyncio.Queue[PixelFrame] = asyncio.Queue()
        rm.subscribe_preview(99, q)  # must not raise

    def test_unsubscribe_nonexistent_channel_is_safe(self) -> None:
        rm = RendererManager(
            [ChannelConfig(id=0, label="A", ledCount=10, gpioPin=18)],
            fps=30,
        )
        q: asyncio.Queue[PixelFrame] = asyncio.Queue()
        rm.unsubscribe_preview(99, q)  # must not raise

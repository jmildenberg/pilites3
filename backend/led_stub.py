"""
No-op stub for rpi_ws281x that allows the backend to run on non-Pi platforms
(macOS, Linux dev machines, CI). The API is identical to rpi_ws281x so the
try/except import in renderer.py swaps it in transparently.
"""
import logging

logger = logging.getLogger(__name__)

# ── Strip type constants (mirror rpi_ws281x values) ───────────────────────────
SK6812_STRIP_RGBW = 0x00081000
SK6812_STRIP_RBGW = 0x00041000
WS2811_STRIP_RGB  = 0x00081000
WS2812_STRIP      = 0x00081000


class Color(int):
    """WRGB packed integer, same interface as rpi_ws281x.Color."""
    def __new__(cls, red: int, green: int, blue: int, white: int = 0) -> "Color":
        value = (white << 24) | (red << 16) | (green << 8) | blue
        return super().__new__(cls, value)


class PixelStrip:
    """No-op pixel strip; logs initialisation and silently discards all writes."""

    def __init__(
        self,
        num: int,
        pin: int,
        freq_hz: int = 800_000,
        dma: int = 10,
        invert: bool = False,
        brightness: int = 255,
        channel: int = 0,
        strip_type: int = WS2812_STRIP,
    ) -> None:
        self._num = num
        self._pixels = [0] * num
        logger.info(
            "LED stub: PixelStrip(num=%d, pin=%d, channel=%d) — no hardware output",
            num, pin, channel,
        )

    def begin(self) -> None:
        pass

    def show(self) -> None:
        pass

    def setPixelColor(self, n: int, color: int) -> None:
        if 0 <= n < self._num:
            self._pixels[n] = int(color)

    def getPixelColor(self, n: int) -> int:
        return self._pixels[n] if 0 <= n < self._num else 0

    def numPixels(self) -> int:
        return self._num

    def setBrightness(self, brightness: int) -> None:
        pass

    def getBrightness(self) -> int:
        return 255

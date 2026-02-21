"""
Per-frame pixel colour computation for all 8 effect types.

Convention
----------
render_<effect>(effect, n, t, state) -> list[tuple[int,int,int,int]]

Parameters
----------
effect : Pydantic effect model instance
n      : number of LEDs in the region (endIndex - startIndex + 1)
t      : elapsed seconds since this effect was activated
state  : mutable dict for per-effect persistent state (mutated in-place).
         The renderer injects state["dt"] before each call.

Returns
-------
List of (r, g, b, w) tuples, length == n, values 0-255.
"""
from __future__ import annotations
import math
import random
from typing import Any

from models import (
    SolidEffect, GradientEffect, RainbowEffect, PulseEffect,
    StrobeEffect, ChaseEffect, TwinkleEffect, FireEffect, Color,
)

Pixel = tuple[int, int, int, int]  # (r, g, b, w)


# ─── Colour helpers ───────────────────────────────────────────────────────────

def _scale(c: Color, brightness: float) -> Pixel:
    b = max(0.0, min(1.0, brightness))
    return (int(c.r * b), int(c.g * b), int(c.b * b), int(c.w * b))


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _lerp_color(ca: Color, cb: Color, t: float, brightness: float) -> Pixel:
    b = max(0.0, min(1.0, brightness))
    return (
        int(_lerp(ca.r, cb.r, t) * b),
        int(_lerp(ca.g, cb.g, t) * b),
        int(_lerp(ca.b, cb.b, t) * b),
        int(_lerp(ca.w, cb.w, t) * b),
    )


def _hsv_to_rgb(h: float, s: float, v: float) -> tuple[int, int, int]:
    """h in [0, 360), s and v in [0, 1]. Returns (r, g, b) 0-255."""
    h = h % 360
    c = v * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = v - c
    if   h <  60: r, g, b = c, x, 0.0
    elif h < 120: r, g, b = x, c, 0.0
    elif h < 180: r, g, b = 0.0, c, x
    elif h < 240: r, g, b = 0.0, x, c
    elif h < 300: r, g, b = x, 0.0, c
    else:         r, g, b = c, 0.0, x
    return int((r + m) * 255), int((g + m) * 255), int((b + m) * 255)


# ─── Solid ────────────────────────────────────────────────────────────────────

def render_solid(effect: SolidEffect, n: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    pixel = _scale(effect.color, effect.brightness)
    return [pixel] * n


# ─── Gradient ─────────────────────────────────────────────────────────────────

def render_gradient(effect: GradientEffect, n: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    if n == 1:
        return [_lerp_color(effect.colorA, effect.colorB, 0.5, effect.brightness)]
    return [
        _lerp_color(effect.colorA, effect.colorB, i / (n - 1), effect.brightness)
        for i in range(n)
    ]


# ─── Rainbow ──────────────────────────────────────────────────────────────────

def render_rainbow(effect: RainbowEffect, n: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    """Full hue spectrum spread across the region, shifting with time."""
    hue_offset = (t * effect.speed) % 360
    pixels: list[Pixel] = []
    span = max(n - 1, 1)
    for i in range(n):
        hue = (hue_offset + (i / span) * 360) % 360
        r, g, b = _hsv_to_rgb(hue, 1.0, effect.brightness)
        pixels.append((r, g, b, 0))
    return pixels


# ─── Pulse ────────────────────────────────────────────────────────────────────

def render_pulse(effect: PulseEffect, n: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    """Sinusoidal brightness oscillating between minBrightness and maxBrightness."""
    phase = (t / effect.period) * 2 * math.pi
    norm = (math.sin(phase - math.pi / 2) + 1) / 2  # 0..1
    brightness = _lerp(effect.minBrightness, effect.maxBrightness, norm)
    pixel = _scale(effect.color, brightness)
    return [pixel] * n


# ─── Strobe ───────────────────────────────────────────────────────────────────

def render_strobe(effect: StrobeEffect, n: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    """Rapid on/off at effect.rate Hz with given duty cycle."""
    period = 1.0 / max(effect.rate, 0.1)
    phase = math.fmod(t, period) / period  # 0..1 within current cycle
    pixel = _scale(effect.color, effect.brightness) if phase < effect.dutyCycle else (0, 0, 0, 0)
    return [pixel] * n


# ─── Chase ────────────────────────────────────────────────────────────────────

def render_chase(effect: ChaseEffect, n: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    """A lit segment moves along the region."""
    dt = state.get("dt", 1.0 / 30)

    if "pos" not in state:
        state["pos"] = 0.0
        state["dir"] = 1  # 1 = forward, -1 = reverse

    if effect.direction == "forward":
        state["pos"] = (state["pos"] + effect.speed * dt) % n
    elif effect.direction == "reverse":
        state["pos"] = (state["pos"] - effect.speed * dt) % n
    else:  # bounce
        state["pos"] += state["dir"] * effect.speed * dt
        if state["pos"] >= n - 1:
            state["pos"] = float(n - 1)
            state["dir"] = -1
        elif state["pos"] <= 0:
            state["pos"] = 0.0
            state["dir"] = 1

    head = int(state["pos"])
    fg = _scale(effect.color, 1.0)
    bg = _scale(effect.backgroundColor, 1.0)
    pixels = [bg] * n
    for offset in range(effect.pixelCount):
        idx = (head + offset) % n
        pixels[idx] = fg
    return pixels


# ─── Twinkle ──────────────────────────────────────────────────────────────────

def render_twinkle(effect: TwinkleEffect, n: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    """Random pixels fade on and off independently."""
    dt = state.get("dt", 1.0 / 30)

    if "levels" not in state:
        state["levels"] = [0.0] * n

    levels: list[float] = state["levels"]
    fade_rate = effect.speed * dt
    target_active = max(1, int(n * effect.density))
    active = sum(1 for lv in levels if lv > 0.01)

    for i in range(n):
        if levels[i] > 0.0:
            levels[i] = max(0.0, levels[i] - fade_rate)
        elif active < target_active and random.random() < (effect.density * 0.3):
            levels[i] = 1.0
            active += 1

    return [_scale(effect.color, lv * effect.brightness) for lv in levels]


# ─── Fire ─────────────────────────────────────────────────────────────────────

def render_fire(effect: FireEffect, n: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    """
    Classic FASTLED fire simulation.
    heat[0] = bottom (near ignition source), heat[n-1] = top.
    Pixels are mapped reversed so flames visually rise from index 0.
    """
    if "heat" not in state:
        state["heat"] = [0] * n

    heat: list[int] = state["heat"]

    # Step 1: Cool every cell
    for i in range(n):
        cooldown = random.randint(0, max(1, int((effect.cooling * 10 / n) + 2)))
        heat[i] = max(0, heat[i] - cooldown)

    # Step 2: Heat drifts upward
    for i in range(n - 1, 1, -1):
        heat[i] = (heat[i - 1] + heat[i - 2] + heat[i - 2]) // 3

    # Step 3: Randomly ignite new sparks at the bottom
    if random.randint(0, 255) < effect.sparking:
        y = random.randint(0, min(7, n - 1))
        heat[y] = min(255, heat[y] + random.randint(160, 255))

    # Step 4: Map heat → black-body colour palette
    b = effect.brightness
    pixels: list[Pixel] = []
    for i in range(n):
        h = heat[n - 1 - i]  # reversed: flames rise from start of region
        t192 = int(h * 192 / 255)
        heatramp = (t192 & 0x3F) << 2  # 0..252

        if t192 > 0x80:        # hottest: white-yellow
            rv, gv, bv = 255, 255, heatramp
        elif t192 > 0x40:      # medium: yellow-orange
            rv, gv, bv = 255, heatramp, 0
        else:                  # coolest: black-red
            rv, gv, bv = heatramp, 0, 0

        pixels.append((int(rv * b), int(gv * b), int(bv * b), 0))

    return pixels


# ─── Dispatch ─────────────────────────────────────────────────────────────────

_RENDERERS = {
    "solid":    render_solid,
    "gradient": render_gradient,
    "rainbow":  render_rainbow,
    "pulse":    render_pulse,
    "strobe":   render_strobe,
    "chase":    render_chase,
    "twinkle":  render_twinkle,
    "fire":     render_fire,
}


def render_effect(effect: Any, region_length: int, t: float, state: dict[str, Any]) -> list[Pixel]:
    """Dispatch to the correct renderer by effect.type."""
    renderer = _RENDERERS.get(effect.type)
    if renderer is None:
        raise ValueError(f"Unknown effect type: {effect.type!r}")
    return renderer(effect, region_length, t, state)

"""Unit tests for the per-frame effect renderers in effects.py."""
from typing import Any

import pytest

from effects import render_effect
from models import (
    ChaseEffect,
    Color,
    FireEffect,
    GradientEffect,
    PulseEffect,
    RainbowEffect,
    SolidEffect,
    StrobeEffect,
    TwinkleEffect,
)

# ── Shared helpers ─────────────────────────────────────────────────────────────

def _state(dt: float = 1 / 30) -> dict[str, Any]:
    """Fresh state dict with dt pre-injected (as the renderer does each frame)."""
    return {"dt": dt}


def _color(r: int = 255, g: int = 255, b: int = 255, w: int = 0) -> Color:
    return Color(r=r, g=g, b=b, w=w)


# ── Effect fixtures ────────────────────────────────────────────────────────────

SOLID    = SolidEffect(type="solid", color=_color(200, 100, 50), brightness=1.0)
DARK     = SolidEffect(type="solid", color=_color(255, 255, 255), brightness=0.0)
GRADIENT = GradientEffect(type="gradient", colorA=_color(255, 0, 0), colorB=_color(0, 0, 255), brightness=1.0)
RAINBOW  = RainbowEffect(type="rainbow", brightness=1.0, speed=30)
PULSE    = PulseEffect(type="pulse", color=_color(), minBrightness=0.0, maxBrightness=1.0, period=2.0)
STROBE   = StrobeEffect(type="strobe", color=_color(), brightness=1.0, rate=5.0, dutyCycle=0.5)
CHASE    = ChaseEffect(type="chase", color=_color(), backgroundColor=_color(0, 0, 0), pixelCount=5, speed=50, direction="forward")
TWINKLE  = TwinkleEffect(type="twinkle", color=_color(255, 200, 150), brightness=1.0, density=0.3, speed=1.0)
FIRE     = FireEffect(type="fire", brightness=1.0, cooling=55, sparking=120)

ALL_EFFECTS = [SOLID, DARK, GRADIENT, RAINBOW, PULSE, STROBE, CHASE, TWINKLE, FIRE]
ALL_IDS     = [e.type for e in ALL_EFFECTS]


# ── Parametrised sanity checks ─────────────────────────────────────────────────

@pytest.mark.parametrize("effect", ALL_EFFECTS, ids=ALL_IDS)
def test_pixel_count_equals_region_length(effect: Any) -> None:
    n = 20
    pixels = render_effect(effect, n, 0.0, _state())
    assert len(pixels) == n, f"{effect.type}: expected {n} pixels, got {len(pixels)}"


@pytest.mark.parametrize("effect", ALL_EFFECTS, ids=ALL_IDS)
def test_pixel_values_in_range(effect: Any) -> None:
    pixels = render_effect(effect, 20, 1.0, _state())
    for i, (r, g, b, w) in enumerate(pixels):
        assert 0 <= r <= 255, f"{effect.type} pixel {i}: r={r}"
        assert 0 <= g <= 255, f"{effect.type} pixel {i}: g={g}"
        assert 0 <= b <= 255, f"{effect.type} pixel {i}: b={b}"
        assert 0 <= w <= 255, f"{effect.type} pixel {i}: w={w}"


@pytest.mark.parametrize("n", [1, 5, 50, 500])
def test_various_region_lengths(n: int) -> None:
    pixels = render_effect(SOLID, n, 0.0, _state())
    assert len(pixels) == n


# ── Solid effect ───────────────────────────────────────────────────────────────

def test_solid_color_matches_effect() -> None:
    pixels = render_effect(SOLID, 5, 0.0, _state())
    for r, g, b, w in pixels:
        assert r == 200
        assert g == 100
        assert b == 50


def test_solid_zero_brightness_is_black() -> None:
    pixels = render_effect(DARK, 10, 0.0, _state())
    for r, g, b, w in pixels:
        assert r == 0 and g == 0 and b == 0


def test_solid_all_pixels_identical() -> None:
    pixels = render_effect(SOLID, 10, 0.0, _state())
    assert all(p == pixels[0] for p in pixels)


# ── Gradient effect ────────────────────────────────────────────────────────────

def test_gradient_first_pixel_near_color_a() -> None:
    # colorA = red (255,0,0)
    pixels = render_effect(GRADIENT, 10, 0.0, _state())
    r, g, b, w = pixels[0]
    assert r > 200, f"First gradient pixel should be mostly red, got r={r}"


def test_gradient_last_pixel_near_color_b() -> None:
    # colorB = blue (0,0,255)
    pixels = render_effect(GRADIENT, 10, 0.0, _state())
    r, g, b, w = pixels[-1]
    assert b > 200, f"Last gradient pixel should be mostly blue, got b={b}"


def test_gradient_not_all_same() -> None:
    pixels = render_effect(GRADIENT, 10, 0.0, _state())
    assert pixels[0] != pixels[-1]


# ── Fire effect ─────────────────────────────────────────────────────────────────

def test_fire_heat_state_created() -> None:
    state = _state()
    render_effect(FIRE, 20, 0.0, state)
    assert "heat" in state
    assert len(state["heat"]) == 20


def test_fire_heat_values_valid() -> None:
    state = _state()
    render_effect(FIRE, 20, 0.0, state)
    for h in state["heat"]:
        assert 0 <= h <= 255


def test_fire_animates_over_time() -> None:
    """After a warm-up period fire pixels should not all be black."""
    state = _state()
    # Run several frames so sparks have time to propagate up the heat array
    last = render_effect(FIRE, 30, 0.0, state)
    for i in range(1, 10):
        last = render_effect(FIRE, 30, i / 30, state)
    total_brightness = sum(r + g + b for r, g, b, w in last)
    assert total_brightness > 0, "Fire should produce non-black pixels after warm-up"


# ── Chase effect ───────────────────────────────────────────────────────────────

def test_chase_pos_state_created() -> None:
    state = _state()
    render_effect(CHASE, 20, 0.0, state)
    assert "pos" in state


def test_chase_bounce_dir_state_created() -> None:
    bounce = ChaseEffect(
        type="chase", color=_color(), backgroundColor=_color(0, 0, 0),
        pixelCount=5, speed=50, direction="bounce",
    )
    state = _state()
    render_effect(bounce, 20, 0.0, state)
    assert "dir" in state


def test_chase_moves_over_time() -> None:
    """Position should advance as t increases."""
    state = _state()
    render_effect(CHASE, 50, 0.0, state)
    pos_t0 = state["pos"]
    render_effect(CHASE, 50, 0.5, state)
    pos_t1 = state["pos"]
    assert pos_t0 != pos_t1


# ── Twinkle effect ─────────────────────────────────────────────────────────────

def test_twinkle_levels_state_created() -> None:
    state = _state()
    render_effect(TWINKLE, 20, 0.0, state)
    assert "levels" in state
    assert len(state["levels"]) == 20


def test_twinkle_levels_in_range() -> None:
    state = _state()
    render_effect(TWINKLE, 20, 0.0, state)
    for lvl in state["levels"]:
        assert 0.0 <= lvl <= 1.0


# ── Strobe effect ──────────────────────────────────────────────────────────────

def test_strobe_on_at_t0() -> None:
    """At t=0, within the duty-cycle on-phase, pixels should be lit."""
    pixels = render_effect(STROBE, 5, 0.0, _state())
    total = sum(r + g + b for r, g, b, w in pixels)
    assert total > 0, "Strobe should be ON at t=0"


def test_strobe_off_mid_cycle() -> None:
    """At t=0.15s with rate=5Hz, period=0.2s, duty=0.5 → off phase starts at 0.1s."""
    pixels = render_effect(STROBE, 5, 0.15, _state())
    total = sum(r + g + b for r, g, b, w in pixels)
    assert total == 0, "Strobe should be OFF at t=0.15s"


# ── State independence between calls ──────────────────────────────────────────

def test_independent_state_dicts() -> None:
    """Two calls with separate state dicts should not interfere."""
    state_a = _state()
    state_b = _state()
    render_effect(FIRE, 20, 0.0, state_a)
    render_effect(FIRE, 20, 0.0, state_b)
    # Both should have their own heat arrays
    assert state_a["heat"] is not state_b["heat"]

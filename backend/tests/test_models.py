"""Unit tests for Pydantic model validation."""
from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError

from models import (
    ChannelConfig,
    Color,
    Cue,
    FireEffect,
    Play,
    Region,
    SolidEffect,
)


# ── Color ──────────────────────────────────────────────────────────────────────

class TestColor:
    def test_valid(self) -> None:
        c = Color(r=255, g=128, b=0, w=0)
        assert c.r == 255
        assert c.g == 128

    def test_default_w_is_zero(self) -> None:
        c = Color(r=10, g=20, b=30)
        assert c.w == 0

    def test_boundary_values(self) -> None:
        Color(r=0, g=0, b=0, w=0)
        Color(r=255, g=255, b=255, w=255)

    def test_r_too_high(self) -> None:
        with pytest.raises(ValidationError):
            Color(r=256, g=0, b=0, w=0)

    def test_negative_value(self) -> None:
        with pytest.raises(ValidationError):
            Color(r=-1, g=0, b=0, w=0)

    def test_w_too_high(self) -> None:
        with pytest.raises(ValidationError):
            Color(r=0, g=0, b=0, w=256)


# ── ChannelConfig ─────────────────────────────────────────────────────────────

class TestChannelConfig:
    def test_channel_zero(self) -> None:
        ch = ChannelConfig(id=0, label="Main", ledCount=500, gpioPin=18)
        assert ch.id == 0

    def test_channel_one(self) -> None:
        ch = ChannelConfig(id=1, label="Secondary", ledCount=300, gpioPin=13)
        assert ch.id == 1

    def test_invalid_id(self) -> None:
        with pytest.raises(ValidationError):
            ChannelConfig(id=2, label="Bad", ledCount=100, gpioPin=18) # type: ignore

    def test_led_count_zero(self) -> None:
        with pytest.raises(ValidationError):
            ChannelConfig(id=0, label="X", ledCount=0, gpioPin=18)

    def test_led_count_maximum(self) -> None:
        ch = ChannelConfig(id=0, label="X", ledCount=1200, gpioPin=18)
        assert ch.ledCount == 1200

    def test_led_count_over_maximum(self) -> None:
        with pytest.raises(ValidationError):
            ChannelConfig(id=0, label="X", ledCount=1201, gpioPin=18)


# ── Effect discriminated union ─────────────────────────────────────────────────

class TestEffectUnion:
    def _parse(self, data: dict[str, Any]) -> Any:
        from models import Effect
        return TypeAdapter(Effect).validate_python(data)

    def test_solid(self) -> None:
        e = self._parse({"type": "solid", "color": {"r": 255, "g": 0, "b": 0}, "brightness": 1.0})
        assert e.type == "solid"
        assert e.brightness == 1.0

    def test_gradient(self) -> None:
        e = self._parse({
            "type": "gradient",
            "colorA": {"r": 255, "g": 0, "b": 0},
            "colorB": {"r": 0, "g": 0, "b": 255},
            "brightness": 0.8,
        })
        assert e.type == "gradient"

    def test_rainbow(self) -> None:
        e = self._parse({"type": "rainbow", "brightness": 1.0, "speed": 30})
        assert e.type == "rainbow"

    def test_fire(self) -> None:
        e = self._parse({"type": "fire", "brightness": 0.8, "cooling": 55, "sparking": 120})
        assert e.type == "fire"

    def test_unknown_type_raises(self) -> None:
        with pytest.raises(ValidationError):
            self._parse({"type": "sparkle", "brightness": 1.0})

    def test_fire_cooling_below_minimum(self) -> None:
        with pytest.raises(ValidationError):
            FireEffect(type="fire", brightness=1.0, cooling=19, sparking=120)

    def test_fire_cooling_at_minimum(self) -> None:
        e = FireEffect(type="fire", brightness=1.0, cooling=20, sparking=120)
        assert e.cooling == 20

    def test_fire_sparking_above_maximum(self) -> None:
        with pytest.raises(ValidationError):
            FireEffect(type="fire", brightness=1.0, cooling=55, sparking=201)

    def test_brightness_above_one(self) -> None:
        with pytest.raises(ValidationError):
            SolidEffect(type="solid", color=Color(r=0, g=0, b=0), brightness=1.1)

    def test_brightness_below_zero(self) -> None:
        with pytest.raises(ValidationError):
            SolidEffect(type="solid", color=Color(r=0, g=0, b=0), brightness=-0.1)


# ── Region ─────────────────────────────────────────────────────────────────────

class TestRegion:
    def test_valid(self) -> None:
        r = Region(id="r1", label="Stage", channelId=0, segments=[{"startIndex": 0, "endIndex": 99}], uiColor="#ff0000")
        assert r.id == "r1"
        assert len(r.segments) == 1
        assert r.segments[0].startIndex == 0

    def test_multi_segment(self) -> None:
        r = Region(id="r1", label="Stage", channelId=0,
                   segments=[{"startIndex": 0, "endIndex": 49}, {"startIndex": 100, "endIndex": 149}],
                   uiColor="#ff0000")
        assert len(r.segments) == 2

    def test_legacy_migration(self) -> None:
        """Old format with startIndex/endIndex is coerced to segments."""
        r = Region.model_validate({"id": "r1", "label": "X", "channelId": 0, "startIndex": 10, "endIndex": 50, "uiColor": "#fff"})
        assert len(r.segments) == 1
        assert r.segments[0].startIndex == 10
        assert r.segments[0].endIndex == 50

    def test_invalid_channel_id(self) -> None:
        with pytest.raises(ValidationError):
            Region(id="r1", label="X", channelId=2, segments=[{"startIndex": 0, "endIndex": 10}], uiColor="#fff") # type: ignore

    def test_negative_start_index(self) -> None:
        with pytest.raises(ValidationError):
            Region(id="r1", label="X", channelId=0, segments=[{"startIndex": -1, "endIndex": 10}], uiColor="#fff")


# ── Play ───────────────────────────────────────────────────────────────────────

class TestPlay:
    BASE = dict(
        id="play-1",
        title="Test",
        description="",
        regions=[],
        cues=[],
        createdAt="2024-01-01T00:00:00Z",
        updatedAt="2024-01-01T00:00:00Z",
    )

    def test_valid(self) -> None:
        p = Play(**self.BASE) # type: ignore
        assert p.id == "play-1"
        assert p.title == "Test"

    def test_missing_id_raises(self) -> None:
        data = {k: v for k, v in self.BASE.items() if k != "id"}
        with pytest.raises(ValidationError):
            Play(**data) # type: ignore

    def test_with_region(self) -> None:
        region = Region(id="r1", label="Stage", channelId=0, segments=[{"startIndex": 0, "endIndex": 49}], uiColor="#aabbcc")
        p = Play(**{**self.BASE, "regions": [region]})
        assert len(p.regions) == 1
        assert p.regions[0].id == "r1"

    def test_with_cue(self) -> None:
        cue = Cue(id="c1", number="1", label="Intro", notes="", regionStates=[])
        p = Play(**{**self.BASE, "cues": [cue]})
        assert len(p.cues) == 1

    def test_cue_optional_follow_time(self) -> None:
        cue = Cue(id="c1", number="1", label="Auto", notes="", regionStates=[], followTime=2.5)
        assert cue.followTime == 2.5

    def test_cue_follow_time_defaults_none(self) -> None:
        cue = Cue(id="c1", number="1", label="Manual", notes="", regionStates=[])
        assert cue.followTime is None

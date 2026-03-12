"""
Pydantic models mirroring the TypeScript types in frontend/src/types/index.ts.
Field names use camelCase to match the JSON produced by the frontend exactly,
avoiding any need for aliases or serialisation transforms.
"""
from __future__ import annotations
from typing import Annotated, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator


# ── Channel ───────────────────────────────────────────────────────────────────

class ChannelConfig(BaseModel):
    id: Literal[0, 1]
    label: str
    ledCount: int = Field(gt=0, le=1200)
    type: Literal["rpi", "wled"] = "rpi"
    # rpi-only
    gpioPin: int = 18
    colorOrder: Literal["RGB", "GRB", "BGR"] = "RGB"
    # wled-only
    wledHost: str | None = None
    wledPort: int = 4048


# ── Color ─────────────────────────────────────────────────────────────────────

class Color(BaseModel):
    r: int = Field(ge=0, le=255)
    g: int = Field(ge=0, le=255)
    b: int = Field(ge=0, le=255)
    w: int = Field(ge=0, le=255, default=0)


# ── Effects ───────────────────────────────────────────────────────────────────

class SolidEffect(BaseModel):
    type: Literal["solid"]
    color: Color
    brightness: float = Field(ge=0.0, le=1.0)


class GradientEffect(BaseModel):
    type: Literal["gradient"]
    colorA: Color
    colorB: Color
    brightness: float = Field(ge=0.0, le=1.0)


class RainbowEffect(BaseModel):
    type: Literal["rainbow"]
    brightness: float = Field(ge=0.0, le=1.0)
    speed: float  # hue degrees per second


class PulseEffect(BaseModel):
    type: Literal["pulse"]
    color: Color
    minBrightness: float = Field(ge=0.0, le=1.0)
    maxBrightness: float = Field(ge=0.0, le=1.0)
    period: float = Field(gt=0)  # seconds per full cycle


class StrobeEffect(BaseModel):
    type: Literal["strobe"]
    color: Color
    brightness: float = Field(ge=0.0, le=1.0)
    rate: float = Field(gt=0)      # Hz
    dutyCycle: float = Field(ge=0.0, le=1.0)


class ChaseEffect(BaseModel):
    type: Literal["chase"]
    color: Color
    backgroundColor: Color
    pixelCount: int = Field(gt=0)
    speed: float                   # LEDs per second
    direction: Literal["forward", "reverse", "bounce"]


class TwinkleEffect(BaseModel):
    type: Literal["twinkle"]
    color: Color
    brightness: float = Field(ge=0.0, le=1.0)
    density: float = Field(ge=0.0, le=1.0)
    speed: float = Field(gt=0)     # relative fade speed


class FireEffect(BaseModel):
    type: Literal["fire"]
    brightness: float = Field(ge=0.0, le=1.0)
    cooling: int = Field(ge=20, le=100)
    sparking: int = Field(ge=50, le=200)


Effect = Annotated[
    Union[
        SolidEffect,
        GradientEffect,
        RainbowEffect,
        PulseEffect,
        StrobeEffect,
        ChaseEffect,
        TwinkleEffect,
        FireEffect,
    ],
    Field(discriminator="type"),
]


# ── Region ────────────────────────────────────────────────────────────────────

class Segment(BaseModel):
    startIndex: int = Field(ge=0)
    endIndex: int = Field(ge=0)


class Region(BaseModel):
    id: str
    label: str
    channelId: Literal[0, 1]
    segments: list[Segment]
    uiColor: str  # hex e.g. "#a855f7"

    @model_validator(mode="before")
    @classmethod
    def _migrate_legacy(cls, obj: object) -> object:
        """Accept legacy single-range format {startIndex, endIndex} and coerce to segments."""
        if isinstance(obj, dict) and "startIndex" in obj and "segments" not in obj:
            start, end = obj.get("startIndex", 0), obj.get("endIndex", 0)
            obj = {k: v for k, v in obj.items() if k not in ("startIndex", "endIndex")}
            obj["segments"] = [{"startIndex": start, "endIndex": end}]
        return obj


class RegionGroup(BaseModel):
    id: str
    label: str
    regionIds: list[str]
    strandMode: bool = False


# ── Cue ───────────────────────────────────────────────────────────────────────

class RegionCueState(BaseModel):
    regionId: Optional[str] = None  # set for individual region ownership
    groupId: Optional[str] = None   # set for group ownership (mutually exclusive)
    fadeTime: float = Field(ge=0)   # seconds
    effect: Effect


class Cue(BaseModel):
    id: str
    number: str
    label: str
    notes: str
    regionStates: list[RegionCueState]
    followTime: Optional[float] = None


# ── Play ──────────────────────────────────────────────────────────────────────

class Play(BaseModel):
    id: str
    title: str
    description: str
    regions: list[Region]
    regionGroups: list[RegionGroup] = []
    palette: list[Color] = []
    cues: list[Cue]
    createdAt: str
    updatedAt: str


# ── WebSocket inbound messages ────────────────────────────────────────────────

class ActiveRegionEntry(BaseModel):
    """One region entry in a set_regions message."""
    regionId: str
    channelId: Literal[0, 1]
    segments: list[Segment]
    effect: Effect


class SetRegionsMessage(BaseModel):
    type: Literal["set_regions"]
    regions: list[ActiveRegionEntry]


class BlackoutMessage(BaseModel):
    type: Literal["blackout"]

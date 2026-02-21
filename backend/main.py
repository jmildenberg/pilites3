"""
PiLites3 FastAPI backend.

- REST API for show and channel config CRUD  (/api/...)
- WebSocket endpoint for real-time cue firing  (/ws)
- Serves built React frontend as static files  (/)
"""
from __future__ import annotations
import asyncio
import json
import logging
import struct
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from config import SHOWS_DIR, FRONTEND_DIST, FPS, DEFAULT_CHANNELS
from models import Play, ChannelConfig, SetRegionsMessage, BlackoutMessage
from renderer import RendererManager, PixelFrame

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Show file helpers ─────────────────────────────────────────────────────────

CHANNELS_FILE = SHOWS_DIR / "channels.json"


def _safe_id(play_id: str) -> str:
    """Strip characters that are unsafe in filenames."""
    return "".join(c for c in play_id if c.isalnum() or c == "-")


def _play_path(play_id: str) -> Path:
    return SHOWS_DIR / f"{_safe_id(play_id)}.json"


def _load_channels() -> list[ChannelConfig]:
    if CHANNELS_FILE.exists():
        return [ChannelConfig(**c) for c in json.loads(CHANNELS_FILE.read_text())]
    channels = [ChannelConfig(**c) for c in DEFAULT_CHANNELS]
    _save_channels(channels)
    return channels


def _save_channels(channels: list[ChannelConfig]) -> None:
    CHANNELS_FILE.write_text(
        json.dumps([c.model_dump() for c in channels], indent=2)
    )


def _load_all_plays() -> list[Play]:
    plays = []
    for p in sorted(SHOWS_DIR.glob("*.json")):
        if p.name == "channels.json":
            continue
        try:
            plays.append(Play(**json.loads(p.read_text())))
        except Exception:
            logger.warning("Skipping malformed play file: %s", p)
    return plays


def _load_play(play_id: str) -> Play:
    path = _play_path(play_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Play {play_id!r} not found")
    return Play(**json.loads(path.read_text()))


def _save_play(play: Play) -> None:
    _play_path(play.id).write_text(play.model_dump_json(indent=2))


def _delete_play(play_id: str) -> None:
    path = _play_path(play_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Play {play_id!r} not found")
    path.unlink()


# ── App lifespan ──────────────────────────────────────────────────────────────

renderer_manager: RendererManager | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global renderer_manager
    channels = _load_channels()
    renderer_manager = RendererManager(channels, FPS)
    await renderer_manager.start_all()
    logger.info("Renderer started: %d channel(s) at %d FPS", len(channels), FPS)
    yield
    if renderer_manager:
        await renderer_manager.stop_all()
        logger.info("Renderer stopped")


def _rm() -> RendererManager:
    if renderer_manager is None:
        raise RuntimeError("RendererManager not initialised")
    return renderer_manager


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="PiLites3", version="1.0.0", lifespan=lifespan)

# Allow any origin — needed for laptop dev against Pi.
# When the Pi serves its own frontend (same origin) CORS is not used.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST: channels ────────────────────────────────────────────────────────────

@app.get("/api/channels", response_model=list[ChannelConfig])
async def get_channels() -> list[ChannelConfig]:
    return _load_channels()


@app.put("/api/channels", response_model=list[ChannelConfig])
async def put_channels(channels: list[ChannelConfig]) -> list[ChannelConfig]:
    """Replace full channel config and restart the LED renderer."""
    _save_channels(channels)
    await _rm().reload_channels(channels)
    return channels


# ── REST: plays ───────────────────────────────────────────────────────────────

@app.get("/api/plays", response_model=list[Play])
async def list_plays() -> list[Play]:
    return _load_all_plays()


@app.post("/api/plays", response_model=Play, status_code=201)
async def create_play(play: Play) -> Play:
    if not play.id:
        play = play.model_copy(update={"id": str(uuid.uuid4())})
    now = datetime.now(timezone.utc).isoformat()
    play = play.model_copy(update={"createdAt": now, "updatedAt": now})
    _save_play(play)
    return play


@app.get("/api/plays/{play_id}", response_model=Play)
async def get_play(play_id: str) -> Play:
    return _load_play(play_id)


@app.put("/api/plays/{play_id}", response_model=Play)
async def update_play(play_id: str, play: Play) -> Play:
    _load_play(play_id)  # 404 if not found
    now = datetime.now(timezone.utc).isoformat()
    play = play.model_copy(update={"id": play_id, "updatedAt": now})
    _save_play(play)
    return play


@app.delete("/api/plays/{play_id}", status_code=204)
async def delete_play(play_id: str) -> None:
    _delete_play(play_id)


# ── WebSocket: real-time cue control ──────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("WebSocket connected: %s", websocket.client)
    rm = _rm()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = data.get("type")

            if msg_type == "set_regions":
                try:
                    msg = SetRegionsMessage(**data)
                except ValidationError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue
                await rm.apply_set_regions(msg.regions)
                await websocket.send_json({"type": "ack", "action": "set_regions"})

            elif msg_type == "blackout":
                await rm.blackout()
                await websocket.send_json({"type": "ack", "action": "blackout"})

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type!r}",
                })

    except WebSocketDisconnect:
        # Renderer loop keeps running — LEDs hold their last frame.
        logger.info("WebSocket disconnected: %s", websocket.client)


@app.websocket("/ws/preview")
async def websocket_preview(websocket: WebSocket) -> None:
    """
    Read-only pixel stream for the browser preview.

    Binary frame format per message:
        [channel_id: uint8][led_count: uint16 LE][r0,g0,b0, r1,g1,b1, ...]

    One message is sent per rendered frame per channel (~30 Hz).
    Frames are dropped (not queued) when the client falls behind.
    """
    await websocket.accept()
    logger.info("Preview WebSocket connected: %s", websocket.client)
    rm = _rm()

    # Single shared queue for all channels — bounded so slow clients drop frames
    shared_q: asyncio.Queue[PixelFrame] = asyncio.Queue(maxsize=4)
    channel_ids = rm.channel_ids()
    for ch_id in channel_ids:
        rm.subscribe_preview(ch_id, shared_q)

    try:
        while True:
            ch_id, pixels = await shared_q.get()
            # Pack header: channel_id (1 B) + led_count (2 B LE)
            header = struct.pack("<BH", ch_id, len(pixels))
            # RGB bytes only — W channel omitted (browser has no white LED)
            rgb = bytes(val for r, g, b, _w in pixels for val in (r, g, b))
            await websocket.send_bytes(header + rgb)
    except WebSocketDisconnect:
        logger.info("Preview WebSocket disconnected: %s", websocket.client)
    except Exception as exc:
        logger.debug("Preview WebSocket error: %s", exc)
    finally:
        for ch_id in channel_ids:
            rm.unsubscribe_preview(ch_id, shared_q)


# ── Static file serving — MUST be mounted last ───────────────────────────────

if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")
    logger.info("Serving frontend from %s", FRONTEND_DIST)
else:
    logger.warning(
        "Frontend dist not found at %s — run 'npm run build' in frontend/ first",
        FRONTEND_DIST,
    )

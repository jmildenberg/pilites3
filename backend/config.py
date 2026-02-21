"""
Centralised configuration for PiLites3 backend.
All values can be overridden via environment variables.
"""
import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
SHOWS_DIR     = Path(os.environ.get("PILITES_SHOWS_DIR", str(BASE_DIR / "shows")))
FRONTEND_DIST = Path(os.environ.get("PILITES_FRONTEND_DIST", str(BASE_DIR.parent / "frontend" / "dist")))

# ── Rendering ─────────────────────────────────────────────────────────────────
FPS: int = int(os.environ.get("PILITES_FPS", "30"))

# ── Default hardware config (written to channels.json on first run) ───────────
DEFAULT_CHANNELS = [
    {"id": 0, "label": "Channel 0", "ledCount": 500, "gpioPin": 18},
    {"id": 1, "label": "Channel 1", "ledCount": 500, "gpioPin": 13},
]

# ── Ensure shows directory exists ─────────────────────────────────────────────
SHOWS_DIR.mkdir(parents=True, exist_ok=True)

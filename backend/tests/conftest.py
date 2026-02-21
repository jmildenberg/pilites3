"""
Shared fixtures for backend tests.

Each test gets its own isolated temporary shows directory so tests
never read or write the real shows/ folder.
"""
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def shows_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Isolated temporary shows directory — patched into main before the app starts."""
    d = tmp_path / "shows"
    d.mkdir()

    import main as m
    monkeypatch.setattr(m, "SHOWS_DIR", d)
    monkeypatch.setattr(m, "CHANNELS_FILE", d / "channels.json")
    return d


@pytest.fixture()
def client(shows_dir: Path) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with isolated shows directory and full app lifespan."""
    from main import app
    with TestClient(app) as c:
        yield c

"""Integration tests for the /api/plays REST endpoints."""
import json
from pathlib import Path

from fastapi.testclient import TestClient

# ── Shared test play payload ───────────────────────────────────────────────────

PLAY = {
    "id": "play-abc",
    "title": "Test Show",
    "description": "A test show",
    "regions": [],
    "cues": [],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
}

PLAY_WITH_CONTENT = {
    "id": "play-full",
    "title": "Full Show",
    "description": "Has regions and cues",
    "regions": [
        {
            "id": "r1",
            "label": "Stage",
            "channelId": 0,
            "startIndex": 0,
            "endIndex": 99,
            "uiColor": "#ff0000",
        }
    ],
    "cues": [
        {
            "id": "c1",
            "number": "1",
            "label": "Intro",
            "notes": "Opening cue",
            "regionStates": [
                {
                    "regionId": "r1",
                    "fadeTime": 3.0,
                    "effect": {
                        "type": "solid",
                        "color": {"r": 255, "g": 220, "b": 180, "w": 0},
                        "brightness": 1.0,
                    },
                }
            ],
        }
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
}


# ── GET /api/plays ─────────────────────────────────────────────────────────────

class TestListPlays:
    def test_empty_on_fresh_start(self, client: TestClient) -> None:
        r = client.get("/api/plays")
        assert r.status_code == 200
        assert r.json() == []

    def test_returns_play_after_create(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        r = client.get("/api/plays")
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_returns_all_plays(self, client: TestClient) -> None:
        for i in range(3):
            client.post("/api/plays", json={**PLAY, "id": f"play-{i}", "title": f"Show {i}"})
        r = client.get("/api/plays")
        assert len(r.json()) == 3

    def test_skips_channels_json(self, client: TestClient, shows_dir: Path) -> None:
        """channels.json in the shows directory must not appear as a play."""
        client.get("/api/channels")  # triggers channels.json creation
        r = client.get("/api/plays")
        assert r.json() == []


# ── POST /api/plays ────────────────────────────────────────────────────────────

class TestCreatePlay:
    def test_returns_201(self, client: TestClient) -> None:
        r = client.post("/api/plays", json=PLAY)
        assert r.status_code == 201

    def test_response_has_correct_title(self, client: TestClient) -> None:
        r = client.post("/api/plays", json=PLAY)
        assert r.json()["title"] == "Test Show"

    def test_response_has_correct_id(self, client: TestClient) -> None:
        r = client.post("/api/plays", json=PLAY)
        assert r.json()["id"] == "play-abc"

    def test_timestamps_set_by_backend(self, client: TestClient) -> None:
        r = client.post("/api/plays", json=PLAY)
        data = r.json()
        assert data["createdAt"] != ""
        assert data["updatedAt"] != ""

    def test_empty_id_gets_generated(self, client: TestClient) -> None:
        r = client.post("/api/plays", json={**PLAY, "id": ""})
        assert r.status_code == 201
        assert r.json()["id"] != ""

    def test_persists_to_disk(self, client: TestClient, shows_dir: Path) -> None:
        client.post("/api/plays", json=PLAY)
        assert (shows_dir / "play-abc.json").exists()

    def test_persisted_json_is_valid(self, client: TestClient, shows_dir: Path) -> None:
        client.post("/api/plays", json=PLAY)
        raw = json.loads((shows_dir / "play-abc.json").read_text())
        assert raw["title"] == "Test Show"

    def test_play_with_regions_and_cues(self, client: TestClient) -> None:
        r = client.post("/api/plays", json=PLAY_WITH_CONTENT)
        assert r.status_code == 201
        data = r.json()
        assert len(data["regions"]) == 1
        assert len(data["cues"]) == 1

    def test_invalid_missing_required_fields(self, client: TestClient) -> None:
        r = client.post("/api/plays", json={"title": "Incomplete"})
        assert r.status_code == 422

    def test_invalid_region_channel(self, client: TestClient) -> None:
        bad = {
            **PLAY,
            "regions": [{"id": "r1", "label": "X", "channelId": 9,
                          "startIndex": 0, "endIndex": 10, "uiColor": "#fff"}],
        }
        r = client.post("/api/plays", json=bad)
        assert r.status_code == 422


# ── GET /api/plays/{id} ────────────────────────────────────────────────────────

class TestGetPlay:
    def test_success(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        r = client.get(f"/api/plays/{PLAY['id']}")
        assert r.status_code == 200
        assert r.json()["title"] == "Test Show"

    def test_not_found(self, client: TestClient) -> None:
        r = client.get("/api/plays/nonexistent-id")
        assert r.status_code == 404

    def test_round_trips_regions_and_cues(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY_WITH_CONTENT)
        r = client.get(f"/api/plays/{PLAY_WITH_CONTENT['id']}")
        data = r.json()
        assert data["regions"][0]["label"] == "Stage"
        assert data["cues"][0]["label"] == "Intro"


# ── PUT /api/plays/{id} ────────────────────────────────────────────────────────

class TestUpdatePlay:
    def test_success(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        r = client.put(f"/api/plays/{PLAY['id']}", json={**PLAY, "title": "Updated"})
        assert r.status_code == 200
        assert r.json()["title"] == "Updated"

    def test_id_preserved_from_path(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        # Even if body has a different id, path id wins
        r = client.put(f"/api/plays/{PLAY['id']}", json={**PLAY, "title": "New"})
        assert r.json()["id"] == PLAY["id"]

    def test_updated_at_refreshed(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        r = client.put(f"/api/plays/{PLAY['id']}", json={**PLAY, "title": "New"})
        assert r.json()["updatedAt"] != PLAY["updatedAt"]

    def test_not_found(self, client: TestClient) -> None:
        r = client.put("/api/plays/nonexistent", json=PLAY)
        assert r.status_code == 404

    def test_change_visible_on_get(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        client.put(f"/api/plays/{PLAY['id']}", json={**PLAY, "title": "Saved"})
        r = client.get(f"/api/plays/{PLAY['id']}")
        assert r.json()["title"] == "Saved"


# ── DELETE /api/plays/{id} ─────────────────────────────────────────────────────

class TestDeletePlay:
    def test_returns_204(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        r = client.delete(f"/api/plays/{PLAY['id']}")
        assert r.status_code == 204

    def test_play_gone_after_delete(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        client.delete(f"/api/plays/{PLAY['id']}")
        r = client.get(f"/api/plays/{PLAY['id']}")
        assert r.status_code == 404

    def test_not_in_list_after_delete(self, client: TestClient) -> None:
        client.post("/api/plays", json=PLAY)
        client.delete(f"/api/plays/{PLAY['id']}")
        assert client.get("/api/plays").json() == []

    def test_file_removed_from_disk(self, client: TestClient, shows_dir: Path) -> None:
        client.post("/api/plays", json=PLAY)
        assert (shows_dir / "play-abc.json").exists()
        client.delete(f"/api/plays/{PLAY['id']}")
        assert not (shows_dir / "play-abc.json").exists()

    def test_not_found(self, client: TestClient) -> None:
        r = client.delete("/api/plays/nonexistent")
        assert r.status_code == 404

"""Integration tests for the /ws WebSocket endpoint."""
from fastapi.testclient import TestClient

# ── Shared payloads ────────────────────────────────────────────────────────────

SOLID_EFFECT = {
    "type": "solid",
    "color": {"r": 255, "g": 0, "b": 0, "w": 0},
    "brightness": 1.0,
}

REGION_ENTRY = {
    "regionId": "region-1",
    "channelId": 0,
    "startIndex": 0,
    "endIndex": 9,
    "effect": SOLID_EFFECT,
}


# ── set_regions ────────────────────────────────────────────────────────────────

class TestSetRegions:
    def test_ack_returned(self, client: TestClient) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "set_regions", "regions": [REGION_ENTRY]})
            data = ws.receive_json()
        assert data["type"] == "ack"
        assert data["action"] == "set_regions"

    def test_empty_regions_list(self, client: TestClient) -> None:
        """Empty regions list is valid — effectively clears the stage."""
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "set_regions", "regions": []})
            data = ws.receive_json()
        assert data["type"] == "ack"

    def test_multiple_regions(self, client: TestClient) -> None:
        regions = [
            {**REGION_ENTRY, "regionId": "r1", "startIndex": 0,   "endIndex": 49},
            {**REGION_ENTRY, "regionId": "r2", "startIndex": 50,  "endIndex": 99},
        ]
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "set_regions", "regions": regions})
            data = ws.receive_json()
        assert data["type"] == "ack"

    def test_channel_1_region(self, client: TestClient) -> None:
        entry = {**REGION_ENTRY, "channelId": 1}
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "set_regions", "regions": [entry]})
            data = ws.receive_json()
        assert data["type"] == "ack"

    def test_invalid_channel_returns_error(self, client: TestClient) -> None:
        bad = {**REGION_ENTRY, "channelId": 5}
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "set_regions", "regions": [bad]})
            data = ws.receive_json()
        assert data["type"] == "error"

    def test_invalid_effect_type_returns_error(self, client: TestClient) -> None:
        bad_effect = {**REGION_ENTRY, "effect": {"type": "unknown_fx", "brightness": 1.0}}
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "set_regions", "regions": [bad_effect]})
            data = ws.receive_json()
        assert data["type"] == "error"

    def test_various_effect_types(self, client: TestClient) -> None:
        effects = [
            {"type": "solid",    "color": {"r": 255, "g": 0, "b": 0, "w": 0}, "brightness": 1.0},
            {"type": "rainbow",  "brightness": 0.8, "speed": 30},
            {"type": "fire",     "brightness": 1.0, "cooling": 55, "sparking": 120},
        ]
        for effect in effects:
            entry = {**REGION_ENTRY, "effect": effect}
            with client.websocket_connect("/ws") as ws:
                ws.send_json({"type": "set_regions", "regions": [entry]})
                data = ws.receive_json()
            assert data["type"] == "ack", f"Failed for effect type: {effect['type']}"


# ── blackout ───────────────────────────────────────────────────────────────────

class TestBlackout:
    def test_ack_returned(self, client: TestClient) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "blackout"})
            data = ws.receive_json()
        assert data["type"] == "ack"
        assert data["action"] == "blackout"

    def test_blackout_after_set_regions(self, client: TestClient) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "set_regions", "regions": [REGION_ENTRY]})
            ws.receive_json()
            ws.send_json({"type": "blackout"})
            data = ws.receive_json()
        assert data["type"] == "ack"
        assert data["action"] == "blackout"


# ── Error handling ─────────────────────────────────────────────────────────────

class TestErrorHandling:
    def test_invalid_json_returns_error(self, client: TestClient) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.send_text("this is not json {{{")
            data = ws.receive_json()
        assert data["type"] == "error"

    def test_unknown_message_type_returns_error(self, client: TestClient) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "do_something_undefined"})
            data = ws.receive_json()
        assert data["type"] == "error"

    def test_missing_type_field_returns_error(self, client: TestClient) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"action": "set_regions"})
            data = ws.receive_json()
        assert data["type"] == "error"

    def test_session_recovers_after_error(self, client: TestClient) -> None:
        """After receiving an error, the connection should still accept valid messages."""
        with client.websocket_connect("/ws") as ws:
            ws.send_text("bad json")
            ws.receive_json()  # error response
            ws.send_json({"type": "blackout"})
            data = ws.receive_json()
        assert data["type"] == "ack"


# ── Multiple messages in one session ──────────────────────────────────────────

class TestSession:
    def test_multiple_messages(self, client: TestClient) -> None:
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "set_regions", "regions": [REGION_ENTRY]})
            r1 = ws.receive_json()
            ws.send_json({"type": "blackout"})
            r2 = ws.receive_json()
            ws.send_json({"type": "set_regions", "regions": []})
            r3 = ws.receive_json()

        assert r1["type"] == "ack" and r1["action"] == "set_regions"
        assert r2["type"] == "ack" and r2["action"] == "blackout"
        assert r3["type"] == "ack"

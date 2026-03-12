"""Integration tests for the /ws and /ws/preview WebSocket endpoints."""
import struct

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
    "segments": [{"startIndex": 0, "endIndex": 9}],
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
            {**REGION_ENTRY, "regionId": "r1", "segments": [{"startIndex": 0,  "endIndex": 49}]},
            {**REGION_ENTRY, "regionId": "r2", "segments": [{"startIndex": 50, "endIndex": 99}]},
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


# ── /ws/preview — pixel stream ─────────────────────────────────────────────────

def _decode_frame(data: bytes) -> tuple[int, int, bytes]:
    """Decode a binary preview frame → (channel_id, led_count, rgb_bytes)."""
    assert len(data) >= 3, "Frame too short for header"
    channel_id = data[0]
    led_count = struct.unpack_from("<H", data, 1)[0]
    rgb = data[3:]
    return channel_id, led_count, rgb


class TestPreviewWebSocket:
    def test_connects_and_receives_binary_frames(self, client: TestClient) -> None:
        """Connecting to /ws/preview immediately delivers binary pixel frames."""
        with client.websocket_connect("/ws/preview") as ws:
            data = ws.receive_bytes()
        assert isinstance(data, bytes)
        assert len(data) >= 3

    def test_frame_header_channel_id_valid(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/preview") as ws:
            data = ws.receive_bytes()
        channel_id, _, _ = _decode_frame(data)
        assert channel_id in (0, 1)

    def test_frame_header_led_count_matches_payload(self, client: TestClient) -> None:
        """Total frame length must equal header (3 B) + led_count × 3 RGB bytes."""
        with client.websocket_connect("/ws/preview") as ws:
            data = ws.receive_bytes()
        channel_id, led_count, rgb = _decode_frame(data)
        assert led_count > 0
        assert len(rgb) == led_count * 3, (
            f"Channel {channel_id}: expected {led_count * 3} RGB bytes, got {len(rgb)}"
        )

    def test_rgb_values_in_range(self, client: TestClient) -> None:
        """Every byte in the RGB payload must be 0–255."""
        with client.websocket_connect("/ws/preview") as ws:
            data = ws.receive_bytes()
        _, _, rgb = _decode_frame(data)
        assert all(0 <= b <= 255 for b in rgb)

    def test_receives_frames_for_both_channels(self, client: TestClient) -> None:
        """Over several frames both channel 0 and channel 1 must appear."""
        seen_channels: set[int] = set()
        with client.websocket_connect("/ws/preview") as ws:
            for _ in range(20):
                data = ws.receive_bytes()
                seen_channels.add(data[0])
                if seen_channels == {0, 1}:
                    break
        assert seen_channels == {0, 1}, f"Only saw channels: {seen_channels}"

    def test_multiple_clients_each_receive_frames(self, client: TestClient) -> None:
        """Two simultaneously connected preview clients both get pixel frames."""
        with client.websocket_connect("/ws/preview") as ws1:
            with client.websocket_connect("/ws/preview") as ws2:
                d1 = ws1.receive_bytes()
                d2 = ws2.receive_bytes()
        assert len(d1) >= 3
        assert len(d2) >= 3

    def test_active_region_color_appears_in_preview(self, client: TestClient) -> None:
        """After set_regions with solid red (LEDs 0–9), preview stream for
        channel 0 should carry r=255, g=0, b=0 at pixel 0."""
        # Set a solid-red region on channel 0, covering LEDs 0–9
        with client.websocket_connect("/ws") as cmd_ws:
            cmd_ws.send_json({
                "type": "set_regions",
                "regions": [{
                    "regionId": "preview-test",
                    "channelId": 0,
                    "segments": [{"startIndex": 0, "endIndex": 9}],
                    "effect": {
                        "type": "solid",
                        "color": {"r": 255, "g": 0, "b": 0, "w": 0},
                        "brightness": 1.0,
                    },
                }],
            })
            cmd_ws.receive_json()  # wait for ack — region is now active

        # Connect to preview and find the first channel-0 frame
        ch0_frame = b""
        with client.websocket_connect("/ws/preview") as ws:
            for _ in range(20):
                frame = ws.receive_bytes()
                if frame[0] == 0:  # channel 0
                    ch0_frame = frame
                    break

        assert ch0_frame, "No channel-0 frame received within 20 frames"
        _, led_count, rgb = _decode_frame(ch0_frame)
        assert led_count >= 10
        # Pixel 0 should be fully red
        assert rgb[0] == 255, f"LED 0 R expected 255, got {rgb[0]}"
        assert rgb[1] == 0,   f"LED 0 G expected 0, got {rgb[1]}"
        assert rgb[2] == 0,   f"LED 0 B expected 0, got {rgb[2]}"

    def test_blackout_yields_all_zero_pixels(self, client: TestClient) -> None:
        """After blackout, preview channel frames should be all-zero."""
        # First set a region, then blackout
        with client.websocket_connect("/ws") as cmd_ws:
            cmd_ws.send_json({
                "type": "set_regions",
                "regions": [REGION_ENTRY],
            })
            cmd_ws.receive_json()
            cmd_ws.send_json({"type": "blackout"})
            cmd_ws.receive_json()

        ch0_frame = b""
        with client.websocket_connect("/ws/preview") as ws:
            for _ in range(20):
                frame = ws.receive_bytes()
                if frame[0] == 0:
                    ch0_frame = frame
                    break

        assert ch0_frame
        _, _, rgb = _decode_frame(ch0_frame)
        assert all(b == 0 for b in rgb), "Expected all-zero pixels after blackout"

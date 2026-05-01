"""FR-006 — finite retries with exponential backoff. Final failure does not abort siblings."""
from __future__ import annotations

import io

import pytest
import requests
from PIL import Image

import download_cards


class _FakeResponse:
    def __init__(self, status: int, content: bytes = b""):
        self.status_code = status
        self.content = content

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")


def _png() -> bytes:
    img = Image.new("RGB", (4, 4), (1, 2, 3))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_retry_eventually_succeeds(monkeypatch) -> None:
    calls = []
    sleeps: list[float] = []

    def fake_get(url, **_kwargs):
        calls.append(url)
        if len(calls) <= 2:
            return _FakeResponse(503)
        return _FakeResponse(200, content=_png())

    monkeypatch.setattr(download_cards.requests, "get", fake_get)
    monkeypatch.setattr(download_cards.time, "sleep", lambda s: sleeps.append(s))

    result = download_cards.download_image("https://example.test/x.png", retries=4, backoff=0.5)
    assert result == _png()
    assert len(calls) == 3
    # Backoff is exponential: 0.5, 1.0 between the first 3 attempts
    assert sleeps == pytest.approx([0.5, 1.0])


def test_retry_gives_up_after_limit(monkeypatch) -> None:
    monkeypatch.setattr(download_cards.requests, "get", lambda *a, **k: _FakeResponse(500))
    monkeypatch.setattr(download_cards.time, "sleep", lambda _: None)

    with pytest.raises(RuntimeError, match="after 3 attempts"):
        download_cards.download_image("https://example.test/x.png", retries=3, backoff=0)

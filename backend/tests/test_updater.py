import pytest
from backend.core.updater import Updater


class _DummyResp:
    def __init__(self, status_code: int, data: dict):
        self.status_code = status_code
        self._data = data

    def json(self):
        return self._data


class _DummyAsyncClient:
    def __init__(self, resp: _DummyResp):
        self._resp = resp

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, _url: str, timeout: float = 10.0):
        return self._resp


@pytest.mark.asyncio
async def test_check_for_updates_returns_notes(monkeypatch):
    from backend.core import updater as updater_mod
    from backend.core.config import settings

    monkeypatch.setattr(
        settings, "UPDATE_CHECK_URL", "https://example.test/latest.json"
    )
    monkeypatch.setattr(settings, "CURRENT_VERSION", "1.0.0")

    resp = _DummyResp(
        200,
        {
            "version": "1.0.1",
            "url": "https://example.test/medx-update.zip",
            "sha256": "deadbeef",
            "notes": "Hello",
            "published_at": "2026-02-03T00:00:00Z",
        },
    )
    monkeypatch.setattr(
        updater_mod.httpx, "AsyncClient", lambda **_kwargs: _DummyAsyncClient(resp)
    )

    info = await Updater().check_for_updates()
    assert info is not None
    assert info["latest"] == "1.0.1"
    assert info["url"].endswith(".zip")
    assert info["notes"] == "Hello"


@pytest.mark.asyncio
async def test_check_for_updates_returns_none_when_same_version(monkeypatch):
    from backend.core import updater as updater_mod
    from backend.core.config import settings

    monkeypatch.setattr(
        settings, "UPDATE_CHECK_URL", "https://example.test/latest.json"
    )
    monkeypatch.setattr(settings, "CURRENT_VERSION", "1.0.0")

    resp = _DummyResp(
        200,
        {
            "version": "1.0.0",
            "url": "https://example.test/medx-update.zip",
            "sha256": "deadbeef",
        },
    )
    monkeypatch.setattr(
        updater_mod.httpx, "AsyncClient", lambda **_kwargs: _DummyAsyncClient(resp)
    )

    info = await Updater().check_for_updates()
    assert info is None

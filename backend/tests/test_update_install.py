import pytest
from fastapi import BackgroundTasks


class _DummySession:
    def add(self, _obj):
        return None

    async def commit(self):
        return None

    async def rollback(self):
        return None


class _DummyUser:
    def __init__(self, user_id: int = 1):
        self.id = user_id


@pytest.mark.asyncio
async def test_update_install_spawns_updater(monkeypatch):
    from backend.modules.system import router as system_router

    spawned = {"called": False, "url": None, "sha256": None}

    def _fake_spawn(download_url: str, sha256: str | None):
        spawned["called"] = True
        spawned["url"] = download_url
        spawned["sha256"] = sha256

    async def _fake_check():
        return {
            "current": "1.0.0",
            "latest": "1.0.1",
            "url": "https://example.test/medx-update.zip",
            "sha256": "deadbeef",
            "notes": "Release notes",
            "published_at": "2026-02-03T00:00:00Z",
        }

    monkeypatch.setattr(system_router.updater, "check_for_updates", _fake_check)
    monkeypatch.setattr(system_router, "_spawn_update", _fake_spawn)

    bg = BackgroundTasks()
    out = await system_router.install_update(
        background=bg,
        db=_DummySession(),
        user=_DummyUser(),
    )

    assert out["update_available"] is True
    assert out["latest_version"] == "1.0.1"
    assert "Release notes" in out["release_notes"]
    assert spawned["called"] is True
    assert spawned["url"].endswith(".zip")


@pytest.mark.asyncio
async def test_update_install_returns_up_to_date_when_no_update(monkeypatch):
    from backend.modules.system import router as system_router

    async def _fake_check():
        return None

    monkeypatch.setattr(system_router.updater, "check_for_updates", _fake_check)

    bg = BackgroundTasks()
    out = await system_router.install_update(
        background=bg,
        db=_DummySession(),
        user=_DummyUser(),
    )

    assert out["update_available"] is False
    assert out["download_url"] is None

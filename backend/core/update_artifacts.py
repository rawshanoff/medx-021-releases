import logging
import os
import shutil
import time
from pathlib import Path

logger = logging.getLogger("medx.update_artifacts")


def _unlink_with_retry(path: Path, attempts: int = 40, delay_sec: float = 0.5) -> None:
    for _ in range(int(attempts)):
        try:
            if not path.exists():
                return
            path.unlink()
            return
        except PermissionError:
            time.sleep(delay_sec)
        except FileNotFoundError:
            return
        except OSError:
            time.sleep(delay_sec)


def _rmtree_with_retry(path: Path, attempts: int = 40, delay_sec: float = 0.5) -> None:
    for _ in range(int(attempts)):
        try:
            if not path.exists():
                return
            shutil.rmtree(path, ignore_errors=False)
            return
        except FileNotFoundError:
            return
        except PermissionError:
            time.sleep(delay_sec)
        except OSError:
            time.sleep(delay_sec)
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception:
        logger.debug("Cleanup fallback rmtree failed: %s", path, exc_info=True)


def cleanup_update_artifacts(app_dir: str | None = None) -> None:
    """Best-effort cleanup of update leftovers in desktop resources root.

    This is intentionally robust against temporary locks (Defender/AV).
    """
    root = (app_dir or os.getenv("MEDX_APP_DIR") or os.getcwd()).strip() or os.getcwd()
    base = Path(root)

    in_progress = base / "._update_in_progress"
    if in_progress.exists():
        # Do not interfere while updater is running.
        return

    # Markers
    _unlink_with_retry(base / "._update_done")
    _unlink_with_retry(base / "._update_failed")

    # Temp and zip
    _rmtree_with_retry(base / "_update_tmp")
    # Give Windows a moment to release handles after startup.
    time.sleep(0.5)
    _unlink_with_retry(base / "update.zip")

    # Backups pruning
    backups_dir = base / "_update_backup"
    keep_raw = os.getenv("MEDX_UPDATE_BACKUPS_KEEP", "2").strip() or "2"
    try:
        keep = max(0, int(keep_raw))
    except Exception:
        keep = 2

    if not backups_dir.exists() or not backups_dir.is_dir():
        return

    items: list[Path] = []
    try:
        for p in backups_dir.iterdir():
            if p.is_dir():
                items.append(p)
    except Exception:
        return

    items.sort(key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
    for p in items[keep:]:
        _rmtree_with_retry(p)

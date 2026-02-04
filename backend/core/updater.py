import logging
import os
import subprocess
import sys
from pathlib import Path

import httpx
from backend.core.config import settings

logger = logging.getLogger("medx.updater")


class Updater:
    async def check_for_updates(self):
        """Проверка наличия обновлений с удаленного сервера"""
        update_url = settings.UPDATE_CHECK_URL
        if not update_url:
            return None

        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(update_url, timeout=10.0)
                if resp.status_code != 200:
                    logger.warning(
                        "Update check failed: %s -> %s", update_url, resp.status_code
                    )
                    return None

                try:
                    data = resp.json()
                except Exception:
                    logger.exception("Update check: invalid JSON from %s", update_url)
                    return None
                remote_version = data.get("version")
                download_url = data.get("url")
                sha256 = data.get("sha256")  # Для проверки целостности
                notes = data.get("notes")
                published_at = data.get("published_at")

                if remote_version and remote_version != settings.CURRENT_VERSION:
                    return {
                        "current": settings.CURRENT_VERSION,
                        "latest": remote_version,
                        "url": download_url,
                        "sha256": sha256,
                        "notes": notes,
                        "published_at": published_at,
                    }
                return None
        except Exception:
            logger.exception("Update check failed: %s", update_url)
            return None

    def spawn_update_process(self, download_url: str, sha256: str | None = None):
        """Spawn the external updater script which downloads and applies the update.

        Note: This method does NOT exit the current process. Callers should decide
        how/when to terminate the app after responding to the client.
        """
        # Prefer bundled updater executable if present (desktop build).
        exe_dir = Path(sys.executable).resolve().parent
        bundled_exe = exe_dir / "medx-updater.exe"
        if bundled_exe.exists():
            args = [
                str(bundled_exe),
                "--url",
                download_url,
                "--app-dir",
                os.getcwd(),
            ]
            # Pass PID so updater can wait for backend to exit before replacing exes.
            # (We fixed Windows PID waiting in the updater itself.)
            args.extend(["--pid", str(os.getpid())])
            if sha256:
                args.extend(["--sha256", sha256])
            return subprocess.Popen(args)

        # Fallback (dev): run python script
        updater_script = os.path.join(os.getcwd(), "scripts", "updater.py")

        # Build arguments for updater script
        args = [
            sys.executable,
            updater_script,
            "--url",
            download_url,
            "--app-dir",
            os.getcwd(),
        ]
        args.extend(["--pid", str(os.getpid())])
        if sha256:
            args.extend(["--sha256", sha256])

        # Spawn external process (updater will download and apply update)
        return subprocess.Popen(args)

    # Backward-compatible alias (some tests/docs used this name).
    def download_update(self, download_url: str, sha256: str | None = None):
        return self.spawn_update_process(download_url=download_url, sha256=sha256)


updater = Updater()

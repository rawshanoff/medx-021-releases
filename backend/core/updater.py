import os
import subprocess
import sys

import httpx
from backend.core.config import settings


class Updater:
    async def check_for_updates(self):
        """Проверка наличия обновлений с удаленного сервера"""
        update_url = settings.UPDATE_CHECK_URL
        if not update_url:
            return None

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(update_url, timeout=10.0)
                if resp.status_code != 200:
                    return None

                data = resp.json()
                remote_version = data.get("version")
                download_url = data.get("url")
                sha256 = data.get("sha256")  # Для проверки целостности

                if remote_version and remote_version != settings.CURRENT_VERSION:
                    return {
                        "current": settings.CURRENT_VERSION,
                        "latest": remote_version,
                        "url": download_url,
                        "sha256": sha256,
                    }
                return None
        except Exception:
            return None

    def start_update_process(self, download_url: str, sha256: str | None = None):
        """
        1. Spawns the external updater script which downloads and applies the update.
        2. Exits the current process.
        """
        # Determine path to external updater script
        updater_script = os.path.join(os.getcwd(), "scripts", "updater.py")

        # Build arguments for updater script
        args = [
            sys.executable,
            updater_script,
            "--url",
            download_url,
            "--pid",
            str(os.getpid()),
            "--app-dir",
            os.getcwd(),
        ]
        if sha256:
            args.extend(["--sha256", sha256])

        # Spawn external process (updater will download and apply update)
        subprocess.Popen(args)

        # Kill current app - updater will restart it after applying update
        sys.exit(0)


updater = Updater()

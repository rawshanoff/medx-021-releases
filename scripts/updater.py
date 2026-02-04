import argparse
import hashlib
import os
import shutil
import time
import zipfile
from datetime import datetime

import httpx


def _pid_is_running(pid: int) -> bool:
    """Best-effort check if a PID is still running.

    We avoid `os.kill(pid, 0)` on Windows because it can raise WinError 87 and
    even crash with SystemError in some frozen/PyInstaller environments.
    """
    if not pid:
        return False

    if os.name == "nt":
        try:
            import ctypes
        except Exception:
            # If ctypes is unavailable for some reason, assume running.
            return True

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        SYNCHRONIZE = 0x00100000

        handle = kernel32.OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, 0, int(pid)
        )
        if not handle:
            err = ctypes.get_last_error()
            # Access denied -> process exists but we can't query it.
            if err == 5:
                return True
            return False

        try:
            WAIT_TIMEOUT = 0x00000102
            res = kernel32.WaitForSingleObject(handle, 0)
            return res == WAIT_TIMEOUT
        finally:
            kernel32.CloseHandle(handle)

    # POSIX
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _cleanup_update_zip(zip_path: str) -> None:
    if not zip_path:
        return
    # On Windows, AV scanners can temporarily lock newly downloaded zips.
    for _ in range(40):  # ~20s max
        try:
            if not os.path.exists(zip_path):
                return
            os.remove(zip_path)
            return
        except PermissionError:
            time.sleep(0.5)
        except Exception:
            return


def _rmtree_with_retry(path: str, attempts: int = 40, delay_sec: float = 0.5) -> None:
    for _ in range(int(attempts)):
        try:
            if not os.path.exists(path):
                return
            shutil.rmtree(path, ignore_errors=False)
            return
        except FileNotFoundError:
            return
        except PermissionError:
            time.sleep(delay_sec)
        except OSError:
            # some transient lock / access issue
            time.sleep(delay_sec)
    # Last attempt: best-effort ignore errors
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass


def _cleanup_old_backups(app_dir: str, keep: int = 2, protect: set[str] | None = None) -> None:
    """Remove old backups under <app_dir>/_update_backup, keep latest N.

    `protect` can contain absolute paths that must not be deleted.
    """
    protect = protect or set()
    try:
        backups_root = os.path.join(app_dir, "_update_backup")
        if not os.path.isdir(backups_root):
            return
        items: list[tuple[str, float]] = []
        for name in os.listdir(backups_root):
            p = os.path.join(backups_root, name)
            if not os.path.isdir(p):
                continue
            try:
                items.append((p, os.path.getmtime(p)))
            except Exception:
                items.append((p, 0.0))
        # Newest first
        items.sort(key=lambda x: x[1], reverse=True)
        keep_n = max(0, int(keep))
        for p, _ in items[keep_n:]:
            if os.path.abspath(p) in protect:
                continue
            try:
                _rmtree_with_retry(p)
            except Exception:
                continue
    except Exception:
        pass


def _copy2_with_retry(
    src: str, dst: str, attempts: int = 30, delay_sec: float = 0.5
) -> None:
    last_err: Exception | None = None
    for _ in range(int(attempts)):
        try:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            return
        except PermissionError as e:
            last_err = e
            time.sleep(delay_sec)
        except Exception as e:
            last_err = e
            break
    raise last_err or RuntimeError(f"Failed to copy {src} -> {dst}")


def _replace_file_with_retry(
    src: str, dst: str, attempts: int = 30, delay_sec: float = 0.5
) -> None:
    """Copy to temp then replace destination (handles AV/locks better)."""
    tmp = dst + ".new"
    _copy2_with_retry(src, tmp, attempts=attempts, delay_sec=delay_sec)
    last_err: Exception | None = None
    for _ in range(int(attempts)):
        try:
            os.replace(tmp, dst)
            return
        except PermissionError as e:
            last_err = e
            time.sleep(delay_sec)
        except Exception as e:
            last_err = e
            break
    try:
        os.remove(tmp)
    except Exception:
        pass
    raise last_err or RuntimeError(f"Failed to replace {dst}")


def _read_env_key(env_path: str, key: str) -> str:
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith("#"):
                    continue
                if not s.startswith(key + "="):
                    continue
                return s.split("=", 1)[1].strip().strip("'\"")
    except Exception:
        return ""
    return ""


def _marker_path(app_dir: str, name: str) -> str:
    return os.path.join(app_dir, name)


def _write_marker(app_dir: str, name: str, text: str) -> None:
    path = _marker_path(app_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def _safe_unlink(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


def _wait_for_pid(pid: int, timeout_sec: int = 120) -> None:
    """Ждём завершения процесса, чтобы можно было заменить файлы."""
    if not pid:
        return
    started = time.time()
    while time.time() - started < timeout_sec:
        if not _pid_is_running(pid):
            return
        time.sleep(1)
    raise RuntimeError(f"Timeout waiting for PID {pid}")


def _backup_app(app_dir: str, backup_dir: str) -> None:
    os.makedirs(backup_dir, exist_ok=True)
    # Бэкапим только ключевые каталоги (чтобы не копировать node_modules и т.д.)
    for name in ["backend", "license_server", "scripts", "frontend_dist"]:
        src = os.path.join(app_dir, name)
        if os.path.exists(src):
            dst = os.path.join(backup_dir, name.replace("/", "_"))
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)

    # Bin: do NOT backup the updater itself (can be locked). Backup backend exe if present.
    bin_backend = os.path.join(app_dir, "bin", "medx-backend.exe")
    if os.path.exists(bin_backend):
        os.makedirs(os.path.join(backup_dir, "bin"), exist_ok=True)
        _copy2_with_retry(
            bin_backend, os.path.join(backup_dir, "bin", "medx-backend.exe")
        )

    # Version marker (optional)
    version_file = os.path.join(app_dir, "VERSION")
    if os.path.exists(version_file):
        shutil.copy2(version_file, os.path.join(backup_dir, "VERSION"))


def _restore_backup(app_dir: str, backup_dir: str) -> None:
    mapping = {
        "backend": "backend",
        "license_server": "license_server",
        "scripts": "scripts",
        "frontend_dist": "frontend_dist",
    }
    for backup_name, target in mapping.items():
        src = os.path.join(backup_dir, backup_name)
        dst = os.path.join(app_dir, target)
        if os.path.exists(src):
            if os.path.isdir(dst):
                shutil.rmtree(dst, ignore_errors=True)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)

    # Restore backend exe if it was backed up
    src_backend_exe = os.path.join(backup_dir, "bin", "medx-backend.exe")
    if os.path.exists(src_backend_exe):
        os.makedirs(os.path.join(app_dir, "bin"), exist_ok=True)
        _replace_file_with_retry(
            src_backend_exe, os.path.join(app_dir, "bin", "medx-backend.exe")
        )

    # Restore VERSION if present
    src_version = os.path.join(backup_dir, "VERSION")
    if os.path.exists(src_version):
        shutil.copy2(src_version, os.path.join(app_dir, "VERSION"))


def _apply_update_zip(app_dir: str, zip_path: str) -> None:
    tmp_dir = os.path.join(app_dir, "_update_tmp")
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir, ignore_errors=True)
    os.makedirs(tmp_dir, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tmp_dir)

    # Ожидаемый формат архива (desktop resources root):
    # - backend/, license_server/, scripts/, frontend_dist/, bin/(optional), VERSION(optional)
    for rel in ["backend", "license_server", "scripts", "frontend_dist"]:
        src = os.path.join(tmp_dir, rel)
        if not os.path.exists(src):
            continue
        dst = os.path.join(app_dir, rel)
        if os.path.isdir(dst):
            shutil.rmtree(dst, ignore_errors=True)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copytree(src, dst, dirs_exist_ok=True)

    # Update backend exe without touching the updater exe (can be locked).
    src_backend_exe = os.path.join(tmp_dir, "bin", "medx-backend.exe")
    if os.path.exists(src_backend_exe):
        os.makedirs(os.path.join(app_dir, "bin"), exist_ok=True)
        dst_backend_exe = os.path.join(app_dir, "bin", "medx-backend.exe")
        print(f"Updater: update backend exe -> {dst_backend_exe}")
        _replace_file_with_retry(src_backend_exe, dst_backend_exe)
    else:
        raise RuntimeError("Update zip is missing bin/medx-backend.exe")

    # Optional VERSION file at zip root
    src_version = os.path.join(tmp_dir, "VERSION")
    if os.path.exists(src_version):
        shutil.copy2(src_version, os.path.join(app_dir, "VERSION"))

    shutil.rmtree(tmp_dir, ignore_errors=True)


def _run_migrations(app_dir: str) -> None:
    # Миграции должны идти через Alembic (предсказуемый upgrade path).
    #
    # IMPORTANT: this must work even when running as a packaged executable
    # (e.g. PyInstaller), where `sys.executable -m alembic` is not available.
    from alembic import command
    from alembic.config import Config

    # Ensure Alembic env.py can resolve DATABASE_URL without importing backend settings.
    # In normal desktop flow Electron/Backend sets MEDX_ENV_FILE, but for manual runs
    # it's convenient to auto-detect <app_dir>/backend/.env.
    if not os.getenv("DATABASE_URL"):
        env_file = os.getenv("MEDX_ENV_FILE", "").strip()
        if not env_file:
            candidate = os.path.join(app_dir, "backend", ".env")
            if os.path.exists(candidate):
                env_file = candidate
                os.environ["MEDX_ENV_FILE"] = env_file
        if env_file:
            v = _read_env_key(env_file, "DATABASE_URL")
            if v:
                os.environ["DATABASE_URL"] = v

    cfg_path = os.path.join(app_dir, "backend", "alembic.ini")
    cfg = Config(cfg_path)
    # Ensure relative paths inside alembic.ini resolve from app_dir
    cfg.set_main_option("script_location", os.path.join(app_dir, "backend", "alembic").replace("\\", "/"))
    command.upgrade(cfg, "head")


def _download_update(url: str, output_path: str, expected_sha256: str | None = None) -> None:
    """Скачивает обновление и проверяет SHA256 если указан"""
    print(f"Downloading update from {url}...")
    with httpx.Client(timeout=300.0) as client:
        resp = client.get(url, follow_redirects=True)
        resp.raise_for_status()
        with open(output_path, "wb") as f:
            f.write(resp.content)

    if expected_sha256:
        print("Verifying SHA256...")
        sha256_hash = hashlib.sha256()
        with open(output_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        actual_sha256 = sha256_hash.hexdigest()
        if actual_sha256.lower() != expected_sha256.lower():
            os.remove(output_path)
            raise ValueError(
                f"SHA256 mismatch: expected {expected_sha256}, got {actual_sha256}"
            )
        print("SHA256 verified successfully")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pid", type=int, help="PID of the main process to wait for")
    parser.add_argument("--zip", type=str, help="Path to the downloaded zip file", default="update.zip")
    parser.add_argument("--url", type=str, help="URL to download update zip from")
    parser.add_argument("--sha256", type=str, help="Expected SHA256 hash of the update zip")
    parser.add_argument("--app-dir", type=str, default=".", help="Root directory of MedX app")
    args = parser.parse_args()

    app_dir = os.path.abspath(args.app_dir)
    zip_arg = (args.zip or "update.zip").strip() or "update.zip"
    if os.path.isabs(zip_arg):
        zip_path = os.path.abspath(zip_arg)
    else:
        zip_path = os.path.abspath(os.path.join(app_dir, zip_arg))
    marker_in_progress = _marker_path(app_dir, "._update_in_progress")
    marker_done = _marker_path(app_dir, "._update_done")
    marker_failed = _marker_path(app_dir, "._update_failed")

    # Reset markers from previous runs
    _safe_unlink(marker_done)
    _safe_unlink(marker_failed)
    _write_marker(
        app_dir,
        "._update_in_progress",
        f"started_at={datetime.now().isoformat()}\n",
    )

    backup_dir: str | None = None
    try:
        # Если указан URL, скачиваем обновление
        if args.url:
            _download_update(args.url, zip_path, args.sha256)

        if not os.path.exists(zip_path):
            raise SystemExit(f"Update zip not found: {zip_path}")

        print(f"Updater: waiting for PID {args.pid}...")
        if args.pid:
            _wait_for_pid(args.pid, timeout_sec=120)

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = os.path.join(app_dir, "_update_backup", ts)

        print(f"Updater: backup -> {backup_dir}")
        _backup_app(app_dir, backup_dir)

        print(f"Updater: apply zip -> {zip_path}")
        _apply_update_zip(app_dir, zip_path)

        print("Updater: run migrations (alembic upgrade head)")
        _run_migrations(app_dir)

        print("Updater: done. Main app should restart it.")
        _write_marker(
            app_dir,
            "._update_done",
            f"done_at={datetime.now().isoformat()}\nzip={zip_path}\n",
        )

        # Cleanup: delete zip and prune old backups (keep last 2 by default).
        # Give Windows a moment to release file handles (AV scanning).
        time.sleep(1.0)
        _cleanup_update_zip(zip_path)
        keep_backups = os.getenv("MEDX_UPDATE_BACKUPS_KEEP", "2").strip() or "2"
        # Protect current backup directory from deletion (paranoia).
        protect = {os.path.abspath(backup_dir)} if backup_dir else set()
        _cleanup_old_backups(app_dir, keep=int(keep_backups), protect=protect)
    except Exception as e:
        print(f"Updater failed: {e}")
        if backup_dir and os.path.exists(backup_dir):
            print("Updater: restoring backup...")
            _restore_backup(app_dir, backup_dir)
        _write_marker(
            app_dir,
            "._update_failed",
            f"failed_at={datetime.now().isoformat()}\nerror={e!r}\n",
        )

        # Prune old backups even on failure, but never delete the last backup we just used.
        keep_backups = os.getenv("MEDX_UPDATE_BACKUPS_KEEP", "2").strip() or "2"
        protect = {os.path.abspath(backup_dir)} if backup_dir else set()
        _cleanup_old_backups(app_dir, keep=max(2, int(keep_backups)), protect=protect)
        raise
    finally:
        _safe_unlink(marker_in_progress)
    
if __name__ == "__main__":
    main()

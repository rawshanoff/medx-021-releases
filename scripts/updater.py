import argparse
import os
import shutil
import subprocess
import sys
import time
import zipfile
from datetime import datetime


def _wait_for_pid(pid: int, timeout_sec: int = 120) -> None:
    """Ждём завершения процесса, чтобы можно было заменить файлы."""
    if not pid:
        return
    started = time.time()
    while time.time() - started < timeout_sec:
        try:
            os.kill(pid, 0)
            time.sleep(1)
        except OSError:
            return
    raise RuntimeError(f"Timeout waiting for PID {pid}")


def _backup_app(app_dir: str, backup_dir: str) -> None:
    os.makedirs(backup_dir, exist_ok=True)
    # Бэкапим только ключевые каталоги (чтобы не копировать node_modules и т.д.)
    for name in ["backend", "license_server", "scripts", "frontend/dist"]:
        src = os.path.join(app_dir, name)
        if os.path.exists(src):
            dst = os.path.join(backup_dir, name.replace("/", "_"))
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)


def _restore_backup(app_dir: str, backup_dir: str) -> None:
    mapping = {
        "backend": "backend",
        "license_server": "license_server",
        "scripts": "scripts",
        "frontend_dist": os.path.join("frontend", "dist"),
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


def _apply_update_zip(app_dir: str, zip_path: str) -> None:
    tmp_dir = os.path.join(app_dir, "_update_tmp")
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir, ignore_errors=True)
    os.makedirs(tmp_dir, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tmp_dir)

    # Ожидаемый формат архива: корень содержит папки backend/, license_server/, scripts/, frontend/dist/
    for rel in ["backend", "license_server", "scripts", os.path.join("frontend", "dist")]:
        src = os.path.join(tmp_dir, rel)
        if not os.path.exists(src):
            continue
        dst = os.path.join(app_dir, rel)
        if os.path.isdir(dst):
            shutil.rmtree(dst, ignore_errors=True)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copytree(src, dst, dirs_exist_ok=True)

    shutil.rmtree(tmp_dir, ignore_errors=True)


def _run_migrations(app_dir: str) -> None:
    # Миграции должны идти через Alembic (предсказуемый upgrade path).
    subprocess.check_call(
        [sys.executable, "-m", "alembic", "-c", os.path.join(app_dir, "backend", "alembic.ini"), "upgrade", "head"],
        cwd=app_dir,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pid", type=int, help="PID of the main process to wait for")
    parser.add_argument("--zip", type=str, help="Path to the downloaded zip file", default="update.zip")
    parser.add_argument("--app-dir", type=str, default=".", help="Root directory of MedX app")
    args = parser.parse_args()

    app_dir = os.path.abspath(args.app_dir)
    zip_path = os.path.abspath(args.zip)
    if not os.path.exists(zip_path):
        raise SystemExit(f"Update zip not found: {zip_path}")

    print(f"Updater: waiting for PID {args.pid}...")
    _wait_for_pid(args.pid, timeout_sec=120)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(app_dir, "_update_backup", ts)

    print(f"Updater: backup -> {backup_dir}")
    _backup_app(app_dir, backup_dir)

    try:
        print(f"Updater: apply zip -> {zip_path}")
        _apply_update_zip(app_dir, zip_path)

        print("Updater: run migrations (alembic upgrade head)")
        _run_migrations(app_dir)

        print("Updater: done. Main app should restart it.")
    except Exception as e:
        print(f"Updater failed: {e}")
        print("Updater: restoring backup...")
        _restore_backup(app_dir, backup_dir)
        raise
    
if __name__ == "__main__":
    main()

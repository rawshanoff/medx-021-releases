#!/usr/bin/env python3
"""
Build script for MedX release package.

Creates a ZIP archive for distribution:
- backend/
- license_server/ (without private keys)
- scripts/
- frontend_dist/ (for desktop resources root)
- bin/ (desktop backend/updater exes if present)
- VERSION (app version marker)

Usage:
    python scripts/build_release.py --version 1.0.1 --output releases/
"""

import argparse
import hashlib
import json
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path


def get_project_root() -> Path:
    """Get the project root directory."""
    return Path(__file__).parent.parent.resolve()


def build_frontend(project_root: Path) -> None:
    """Build the frontend using npm."""
    frontend_dir = project_root / "frontend"
    print("Building frontend...")
    subprocess.check_call(["npm", "run", "build"], cwd=frontend_dir, shell=True)
    print("Frontend build complete.")


def calculate_sha256(file_path: Path) -> str:
    """Calculate SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def create_release_zip(
    project_root: Path,
    output_dir: Path,
    version: str,
    skip_frontend_build: bool = False,
) -> tuple[Path, str]:
    """Create the release ZIP archive."""
    
    # Build frontend if not skipped
    if not skip_frontend_build:
        build_frontend(project_root)
    
    # Verify frontend/dist exists
    frontend_dist = project_root / "frontend" / "dist"
    if not frontend_dist.exists():
        raise FileNotFoundError(
            f"Frontend dist not found at {frontend_dist}. "
            "Run 'npm run build' in frontend/ first."
        )
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Create ZIP filename
    zip_filename = f"medx-{version}.zip"
    zip_path = output_dir / zip_filename
    
    # Remove existing file if present
    if zip_path.exists():
        zip_path.unlink()
    
    print(f"Creating release archive: {zip_path}")
    
    # Files/directories to exclude
    exclude_patterns = {
        "__pycache__",
        ".pyc",
        ".pyo",
        ".pyd",
        ".git",
        ".gitignore",
        ".env",
        ".env.local",
        ".env.",
        "node_modules",
        ".pytest_cache",
        ".mypy_cache",
        "htmlcov",
        ".coverage",
        "*.log",
        "medx.db",
        "private_key.pem",
        "license_server/private_key.pem",
        "*.pem",
        "*.key",
        "license.key",
        ".ruff_cache",
    }
    
    def should_exclude(path: Path) -> bool:
        """Check if path should be excluded."""
        path_str = str(path).replace("\\", "/")
        name = path.name
        for pattern in exclude_patterns:
            # crude glob support for our needs
            if pattern.startswith("*.") and name.lower().endswith(pattern[1:].lower()):
                return True
            if pattern == ".env." and name.startswith(".env."):
                return True
            if pattern in path_str:
                return True
            if name == pattern:
                return True
        return False
    
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add backend/
        backend_dir = project_root / "backend"
        for file_path in backend_dir.rglob("*"):
            if file_path.is_file() and not should_exclude(file_path):
                arcname = file_path.relative_to(project_root)
                zf.write(file_path, arcname)
                print(f"  + {arcname}")
        
        # Add license_server/ (without private keys)
        license_dir = project_root / "license_server"
        if license_dir.exists():
            for file_path in license_dir.rglob("*"):
                if file_path.is_file() and not should_exclude(file_path):
                    if "private" in file_path.name.lower():
                        continue  # Skip private keys
                    arcname = file_path.relative_to(project_root)
                    zf.write(file_path, arcname)
                    print(f"  + {arcname}")
        
        # Add scripts/
        scripts_dir = project_root / "scripts"
        for file_path in scripts_dir.rglob("*"):
            if file_path.is_file() and not should_exclude(file_path):
                arcname = file_path.relative_to(project_root)
                zf.write(file_path, arcname)
                print(f"  + {arcname}")
        
        # Add frontend_dist/ (desktop resources layout)
        for file_path in frontend_dist.rglob("*"):
            if file_path.is_file() and not should_exclude(file_path):
                arcname = Path("frontend_dist") / file_path.relative_to(frontend_dist)
                zf.write(file_path, arcname)
                print(f"  + {arcname}")

        # Add VERSION (for updater/version check)
        # IMPORTANT: always use CLI --version to avoid mismatches when repo file is stale.
        zf.writestr("VERSION", f"{version}\n")
        print("  + VERSION")

        # Add bin/ (desktop exes) if present
        bin_dir = project_root / "desktop" / "electron" / "bin"
        if bin_dir.exists():
            for file_path in bin_dir.rglob("*"):
                if file_path.is_file() and not should_exclude(file_path):
                    arcname = Path("bin") / file_path.relative_to(bin_dir)
                    zf.write(file_path, arcname)
                    print(f"  + {arcname}")
    
    # Calculate SHA256
    sha256 = calculate_sha256(zip_path)
    print(f"SHA256: {sha256}")
    
    return zip_path, sha256


def create_latest_json(
    output_dir: Path,
    version: str,
    sha256: str,
    download_url: str,
    release_notes: str = "",
) -> Path:
    """Create the latest.json manifest file."""
    latest_json_path = output_dir / "latest.json"
    
    manifest = {
        "version": version,
        "url": download_url,
        "sha256": sha256,
        "notes": release_notes or f"MedX {version} release",
        "published_at": datetime.now(timezone.utc).isoformat(),
    }
    
    with open(latest_json_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    print(f"Created manifest: {latest_json_path}")
    return latest_json_path


def main():
    parser = argparse.ArgumentParser(description="Build MedX release package")
    parser.add_argument(
        "--version",
        required=True,
        help="Version string (e.g., 1.0.1)",
    )
    parser.add_argument(
        "--output",
        default="releases",
        help="Output directory for the release files",
    )
    parser.add_argument(
        "--base-url",
        default="https://github.com/rawshanoff/medx-021-releases/releases/latest/download",
        help="Base URL for download links in latest.json",
    )
    parser.add_argument(
        "--notes",
        default="",
        help="Release notes",
    )
    parser.add_argument(
        "--skip-frontend-build",
        action="store_true",
        help="Skip frontend build (use existing dist/)",
    )
    args = parser.parse_args()
    
    project_root = get_project_root()
    output_dir = Path(args.output)
    if not output_dir.is_absolute():
        output_dir = project_root / output_dir
    
    print(f"Building MedX {args.version}")
    print(f"Project root: {project_root}")
    print(f"Output dir: {output_dir}")
    print()
    
    # Create ZIP
    zip_path, sha256 = create_release_zip(
        project_root=project_root,
        output_dir=output_dir,
        version=args.version,
        skip_frontend_build=args.skip_frontend_build,
    )
    
    # Create latest.json
    zip_filename = zip_path.name
    download_url = f"{args.base_url.rstrip('/')}/{zip_filename}"
    
    create_latest_json(
        output_dir=output_dir,
        version=args.version,
        sha256=sha256,
        download_url=download_url,
        release_notes=args.notes,
    )
    
    print()
    print("=" * 60)
    print(f"Release {args.version} built successfully!")
    print(f"  ZIP: {zip_path}")
    print(f"  SHA256: {sha256}")
    print(f"  Manifest: {output_dir / 'latest.json'}")
    print()
    print("To publish:")
    print(f"  1. Upload {zip_filename} to your release server")
    print("  2. Upload latest.json to your release server")
    print("  3. Update UPDATE_CHECK_URL in .env to point to latest.json")
    print("=" * 60)


if __name__ == "__main__":
    main()

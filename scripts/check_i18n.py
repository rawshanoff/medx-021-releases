#!/usr/bin/env python3
"""
Script to check i18n translation completeness.
Compares ru.json (reference) with en.json and uz.json.
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List

def load_json(file_path: Path) -> Dict[str, Any]:
    """Load JSON file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def flatten_keys(data: Dict[str, Any], prefix: str = '') -> List[str]:
    """Flatten nested dict to list of dot-separated keys."""
    keys = []
    for key, value in data.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            keys.extend(flatten_keys(value, full_key))
        else:
            keys.append(full_key)
    return keys

def check_translations():
    """Check translation completeness."""
    frontend_dir = Path(__file__).parent.parent / 'frontend' / 'src' / 'locales'

    # Load all locale files
    ru_file = frontend_dir / 'ru.json'
    en_file = frontend_dir / 'en.json'
    uz_file = frontend_dir / 'uz.json'

    if not all(f.exists() for f in [ru_file, en_file, uz_file]):
        print("ERROR: Missing locale files")
        return False

    try:
        ru_data = load_json(ru_file)
        en_data = load_json(en_file)
        uz_data = load_json(uz_file)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON: {e}")
        return False

    # Get all keys
    ru_keys = set(flatten_keys(ru_data))
    en_keys = set(flatten_keys(en_data))
    uz_keys = set(flatten_keys(uz_data))

    print("i18n Translation Check")
    print(f"Total keys in ru.json: {len(ru_keys)}")
    print(f"Keys in en.json: {len(en_keys)}")
    print(f"Keys in uz.json: {len(uz_keys)}")
    print()

    # Check completeness
    missing_en = ru_keys - en_keys
    missing_uz = ru_keys - uz_keys
    extra_en = en_keys - ru_keys
    extra_uz = uz_keys - ru_keys

    success = True

    if missing_en:
        print("ERROR: Missing in en.json:")
        for key in sorted(missing_en):
            print(f"  - {key}")
        success = False
        print()

    if missing_uz:
        print("ERROR: Missing in uz.json:")
        for key in sorted(missing_uz):
            print(f"  - {key}")
        success = False
        print()

    if extra_en:
        print("WARNING: Extra keys in en.json (not in ru.json):")
        for key in sorted(extra_en):
            print(f"  - {key}")
        print()

    if extra_uz:
        print("WARNING: Extra keys in uz.json (not in ru.json):")
        for key in sorted(extra_uz):
            print(f"  - {key}")
        print()

    if success:
        print("SUCCESS: All translations complete!")
        return True
    else:
        print("ERROR: Translation issues found")
        return False

if __name__ == '__main__':
    success = check_translations()
    sys.exit(0 if success else 1)
"""Loads variables from .env (project root) into os.environ.

Values already set in the real environment win, so hosting secrets override the file.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_env():
    try:
        text = (ROOT / ".env").read_text(encoding="utf-8")
    except OSError:
        return
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        if value != "":
            os.environ.setdefault(key, value)


_load_env()

"""Statik fayllar (CSS, JS, logotip) — versiyali URL bilan."""
import hashlib
from pathlib import Path

WEB_DIR = Path(__file__).resolve().parent.parent / "web"

TYPES = {
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
}

_cache: dict[str, tuple[bytes, str, str]] = {}


def load(name: str):
    """(bayt, content-type, versiya) yoki None."""
    if name in _cache:
        return _cache[name]
    if "/" in name or "\\" in name or name.startswith("."):
        return None
    path = WEB_DIR / name
    if path.suffix not in TYPES or not path.is_file():
        return None
    data = path.read_bytes()
    item = (data, TYPES[path.suffix], hashlib.sha1(data).hexdigest()[:10])
    _cache[name] = item
    return item


def asset_url(name: str) -> str:
    item = load(name)
    return f"/static/{name}?v={item[2]}" if item else f"/static/{name}"

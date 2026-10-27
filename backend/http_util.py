"""Small HTTP helpers shared by the API routes."""
import json
import os
import threading
import time
from urllib.parse import urlparse

from fastapi import Request


class HttpError(Exception):
    def __init__(self, status, message, **extra):
        super().__init__(message)
        self.status = status
        self.message = message
        self.extra = extra


async def read_json(request: Request, limit=100_000):
    if "application/json" not in request.headers.get("content-type", ""):
        raise HttpError(415, "Send JSON")
    raw = await request.body()
    if len(raw) > limit:
        raise HttpError(413, "Request too large")
    try:
        data = json.loads(raw or b"{}")
    except ValueError:
        raise HttpError(400, "Invalid JSON")
    if not isinstance(data, dict):
        raise HttpError(400, "Invalid JSON")
    return data


# Behind a reverse proxy, set TRUST_PROXY=1 so the real client address and protocol are used.
def _trust_proxy():
    return os.environ.get("TRUST_PROXY") == "1"


def client_ip(request: Request):
    if _trust_proxy():
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def is_https(request: Request):
    return request.url.scheme == "https" or (_trust_proxy() and request.headers.get("x-forwarded-proto") == "https")


def same_origin(request: Request):
    """Browsers send Origin on cross-site writes; refuse the ones that do not come from this site."""
    origin = request.headers.get("origin")
    if not origin:
        return True
    return urlparse(origin).netloc == request.headers.get("host")


def limiter(maximum, window_ms):
    """In-memory limiter: at most `maximum` hits per `window_ms` for each key."""
    hits = {}
    lock = threading.Lock()

    def allow(key):
        t = time.time() * 1000
        with lock:
            if len(hits) > 5000:
                for k in [k for k, v in hits.items() if v[1] < t]:
                    del hits[k]
            cur = hits.get(key)
            if cur is None or cur[1] < t:
                hits[key] = [1, t + window_ms]
                return True
            cur[0] += 1
            return cur[0] <= maximum

    return allow

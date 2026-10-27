"""OMDb access for the server. The key stays here; the browser never talks to OMDb.
https://www.omdbapi.com/  (GET /?apikey=...&i=imdbID | t=title&y=year | s=search&page=n)
"""
import json
import os
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request


class OmdbError(Exception):
    # kind: 'unconfigured' | 'denied' | 'unavailable' | 'not-found'
    def __init__(self, kind, message):
        super().__init__(message)
        self.kind = kind


def configured():
    return bool(os.environ.get("OMDB_API_KEY"))


def _base():
    return os.environ.get("OMDB_BASE_URL") or "https://www.omdbapi.com/"


def call(params):
    key = os.environ.get("OMDB_API_KEY")
    if not key:
        raise OmdbError("unconfigured", "OMDB_API_KEY is not set on the server")
    url = f"{_base()}?{urllib.parse.urlencode(params)}&apikey={urllib.parse.quote(key)}"
    status, body = 200, None
    try:
        try:
            with urllib.request.urlopen(url, timeout=8) as res:
                body = json.loads(res.read())
        except urllib.error.HTTPError as e:
            status = e.code
            body = json.loads(e.read() or b"{}")
    except Exception as e:  # network trouble or a body that is not JSON
        print("[omdb]", type(e).__name__, e, flush=True)
        raise OmdbError("unavailable", "Could not reach OMDb")
    # OMDb answers 401 for a bad key and when the daily limit is reached.
    if status == 401:
        raise OmdbError("denied", body.get("Error") or "OMDb rejected the API key")
    if status >= 400:
        raise OmdbError("unavailable", "OMDb is unavailable right now")
    if body.get("Response") == "False":
        raise OmdbError("not-found", body.get("Error") or "Not found")
    return body


def _na(v):
    return v if v and v != "N/A" else None


def _list(v):
    return [x.strip() for x in v.split(",") if x.strip()] if _na(v) else []


def _num(v):
    m = re.match(r"\s*([+-]?\d+)", str(v if v is not None else ""))
    return int(m.group(1)) if m else None


def _float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def normalize_details(d):
    """OMDb's full record -> a row for our titles table."""
    rt = next((r.get("Value") for r in d.get("Ratings", []) if r.get("Source") == "Rotten Tomatoes"), None)
    return {
        "id": d.get("imdbID"),
        "kind": "show" if d.get("Type") == "series" else "movie",
        "title": d.get("Title"),
        "year": _num(d.get("Year")),
        "poster": _na(d.get("Poster")),
        "plot": _na(d.get("Plot")),
        "rated": _na(d.get("Rated")),
        "released": _na(d.get("Released")),
        "runtime": _num(d.get("Runtime")),
        "genres": _list(d.get("Genre")),
        "director": _na(d.get("Director")),
        "writer": _na(d.get("Writer")),
        "actors": _list(d.get("Actors")),
        "language": _na(d.get("Language")),
        "country": _na(d.get("Country")),
        "awards": _na(d.get("Awards")),
        "rt": _num(rt) if rt else None,
        "imdb": _float(d.get("imdbRating")),
        "imdb_votes": _na(d.get("imdbVotes")),
        "meta": _num(d.get("Metascore")),
        "seasons": _num(d.get("totalSeasons")),
    }


def normalize_search_item(r):
    """One entry of an OMDb search -> the basic fields we can store right away."""
    return {
        "id": r.get("imdbID"),
        "kind": "show" if r.get("Type") == "series" else "movie",
        "title": r.get("Title"),
        "year": _num(r.get("Year")),
        "poster": _na(r.get("Poster")),
    }


def _strip(s):
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def looks_like(row, details):
    """Guard against a wrong IMDb id in the starter list: title and year must roughly agree."""
    a, b = _strip(row["title"]), _strip(details["title"])
    same_title = a == b or a in b or b in a
    same_year = not row.get("year") or not details.get("year") or abs(row["year"] - details["year"]) <= 1
    return same_title and same_year

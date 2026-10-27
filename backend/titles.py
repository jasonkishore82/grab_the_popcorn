"""The shared catalogue: every title anyone looks up is stored once, with everyone's ratings and comments."""
import json
import math
import re
import threading
import time

from . import omdb
from .config import ROOT
from .db import many, now, one, run, scalar, tx
from .http_util import HttpError
from .omdb import OmdbError

SEARCH_TTL = 30 * 864e5  # a stored search is reused for 30 days
RETRY_AFTER = 864e5  # after a failed details lookup, wait a day before asking OMDb again

_STARTERS = json.loads((ROOT / "backend" / "starter_titles.json").read_text(encoding="utf-8"))
TITLES = _STARTERS["titles"]
LEGACY = _STARTERS["legacy"]

IMDB_ID = re.compile(r"^tt\d{6,10}$")


def is_imdb_id(s):
    return bool(IMDB_ID.match(s))


def canonical_id(raw):
    return LEGACY.get(raw, raw)


def _round1(x):
    return math.floor(x * 10 + 0.5) / 10


# ---------- reading titles ----------

STATS = """LEFT JOIN (
  SELECT title_id,
         COUNT(rating) AS rating_count,
         AVG(rating) AS rating_avg,
         SUM(CASE WHEN review IS NOT NULL AND review <> '' THEN 1 ELSE 0 END) AS review_count,
         SUM(status = 'watched') AS watched,
         SUM(status = 'watchlist') AS watchlist
  FROM library_entries GROUP BY title_id
) s ON s.title_id = t.id"""

SELECT = f"""SELECT t.*, COALESCE(s.rating_count, 0) AS rating_count, s.rating_avg,
  COALESCE(s.review_count, 0) AS review_count, COALESCE(s.watched, 0) AS watched, COALESCE(s.watchlist, 0) AS watchlist
  FROM titles t {STATS}"""


def to_json(r):
    return {
        "id": r["id"],
        "type": r["kind"],
        "title": r["title"],
        "year": r["year"],
        "poster": r["poster"],
        "plot": r["plot"],
        "rated": r["rated"],
        "released": r["released"],
        "runtime": r["runtime"],
        "genres": json.loads(r["genres"]),
        "director": r["director"],
        "writer": r["writer"],
        "actors": json.loads(r["actors"]),
        "language": r["language"],
        "country": r["country"],
        "awards": r["awards"],
        "rt": r["rt"],
        "imdb": r["imdb"],
        "imdbVotes": r["imdb_votes"],
        "meta": r["meta"],
        "seasons": r["seasons"],
        "detailed": r["detail_level"] > 0,
        "seeded": bool(r["seeded"]),
        "addedAt": r["created_at"],
        "stats": {
            "ratingCount": int(r["rating_count"]),
            "ratingAvg": None if r["rating_avg"] is None else _round1(r["rating_avg"]),
            "reviewCount": int(r["review_count"]),
            "watched": int(r["watched"]),
            "watchlist": int(r["watchlist"]),
        },
    }


def resolve_id(raw):
    id_ = canonical_id(str(raw))
    row = one("SELECT new_id FROM id_aliases WHERE old_id = ?", id_)
    return row["new_id"] if row else id_


def row_by_id(id_):
    return one(f"{SELECT} WHERE t.id = ?", id_)


def rows_by_ids(ids):
    if not ids:
        return []
    rows = many(f"{SELECT} WHERE t.id IN ({','.join('?' * len(ids))})", *ids)
    by_id = {r["id"]: r for r in rows}
    return [by_id[i] for i in ids if i in by_id]


def id_aliases():
    return {r["old_id"]: r["new_id"] for r in many("SELECT old_id, new_id FROM id_aliases")}


def catalog(limit=200, offset=0):
    rows = many(
        f"{SELECT} ORDER BY t.seeded DESC, t.created_at DESC, t.title LIMIT ? OFFSET ?",
        min(max(limit, 1), 300),
        max(offset, 0),
    )
    return [to_json(r) for r in rows]


def _like(s):
    return re.sub(r"([\\%_])", r"\\\1", s)


def search_local(q, kind, limit=40):
    kind_sql = "" if kind == "all" else "AND t.kind = ?"
    args = [f"%{_like(q)}%"] + ([] if kind == "all" else [kind]) + [f"{_like(q)}%", limit]
    return many(
        f"""{SELECT} WHERE t.title LIKE ? ESCAPE '\\' {kind_sql}
       ORDER BY (t.title LIKE ? ESCAPE '\\') DESC, COALESCE(s.rating_count, 0) DESC, t.year DESC LIMIT ?""",
        *args,
    )


# ---------- writing titles ----------

def upsert_basic(items, user_id):
    added = 0
    with tx():
        for it in items:
            if not it["id"] or not is_imdb_id(it["id"]):
                continue
            if one("SELECT 1 FROM titles WHERE id = ?", it["id"]):
                if it["poster"]:
                    run("UPDATE titles SET poster = ? WHERE id = ? AND poster IS NULL", it["poster"], it["id"])
            else:
                run(
                    "INSERT INTO titles (id, kind, title, year, poster, detail_level, seeded, created_by, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)",
                    it["id"], it["kind"], it["title"], it["year"], it["poster"], user_id, now(),
                )
                added += 1
    return added


def save_details(d, user_id):
    run(
        """INSERT INTO titles (id, kind, title, year, poster, plot, rated, released, runtime, genres, director, writer, actors, language, country, awards,
                         rt, imdb, imdb_votes, meta, seasons, detail_level, seeded, created_by, created_at, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       kind = excluded.kind, title = excluded.title, year = COALESCE(excluded.year, titles.year),
       poster = COALESCE(excluded.poster, titles.poster), plot = COALESCE(excluded.plot, titles.plot),
       rated = excluded.rated, released = excluded.released, runtime = COALESCE(excluded.runtime, titles.runtime),
       genres = CASE WHEN excluded.genres = '[]' THEN titles.genres ELSE excluded.genres END,
       director = excluded.director, writer = excluded.writer, actors = excluded.actors,
       language = excluded.language, country = excluded.country, awards = excluded.awards,
       rt = excluded.rt, imdb = excluded.imdb, imdb_votes = excluded.imdb_votes, meta = excluded.meta, seasons = excluded.seasons,
       detail_level = 1, fetched_at = excluded.fetched_at""",
        d["id"], d["kind"], d["title"], d["year"], d["poster"], d["plot"], d["rated"], d["released"], d["runtime"],
        json.dumps(d["genres"], ensure_ascii=False), d["director"], d["writer"], json.dumps(d["actors"], ensure_ascii=False),
        d["language"], d["country"], d["awards"], d["rt"], d["imdb"], d["imdb_votes"], d["meta"], d["seasons"],
        user_id, now(), now(),
    )


def remap(old_id, new_id):
    """A starter title whose IMDb id was wrong moves to the right id; people's entries move with it."""
    with tx():
        if not one("SELECT 1 FROM titles WHERE id = ?", new_id):
            run("UPDATE titles SET id = ? WHERE id = ?", new_id, old_id)  # cascades to library_entries
        else:
            run("UPDATE OR IGNORE library_entries SET title_id = ? WHERE title_id = ?", new_id, old_id)
            run("DELETE FROM titles WHERE id = ?", old_id)
        run("INSERT OR REPLACE INTO id_aliases (old_id, new_id) VALUES (?, ?)", old_id, new_id)


def seed_starter_titles():
    with tx():
        for t in TITLES:
            if one("SELECT 1 FROM id_aliases WHERE old_id = ?", t["id"]):
                continue
            run(
                "INSERT OR IGNORE INTO titles (id, kind, title, year, plot, runtime, genres, detail_level, seeded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)",
                t["id"], t["type"], t["title"], t["year"], t["synopsis"], t.get("runtime"), json.dumps(t["genres"], ensure_ascii=False), now(),
            )


# ---------- full details, fetched from OMDb once and kept ----------

def _fail(e):
    if not isinstance(e, OmdbError):
        return e
    status = {"unconfigured": 503, "denied": 502, "unavailable": 502, "not-found": 404}.get(e.kind, 502)
    return HttpError(status, "Title not found" if e.kind == "not-found" else str(e), omdb=e.kind)


_locks = {}
_locks_guard = threading.Lock()


def _lock_for(id_):
    with _locks_guard:
        return _locks.setdefault(id_, threading.Lock())


def ensure_detailed(raw_id, user_id=None):
    """Make sure a title has its full details stored. Returns the title's id (it can change for a wrong starter id)."""
    id_ = resolve_id(raw_id)
    row = row_by_id(id_)
    if row and row["detail_level"] > 0:
        return id_
    if not omdb.configured():
        if row:
            return id_
        raise HttpError(503, "OMDb is not set up, so new titles cannot be looked up", omdb="unconfigured")
    if row and row["fetched_at"] and now() - row["fetched_at"] < RETRY_AFTER:
        return id_  # we already tried recently
    with _lock_for(id_):  # one lookup per title at a time
        row = row_by_id(id_)
        if row and row["detail_level"] > 0:
            return id_
        return _load_from_omdb(id_, row)


def _load_from_omdb(id_, row):
    details = None
    try:
        details = omdb.normalize_details(omdb.call({"i": id_}))
    except OmdbError as e:
        if e.kind != "not-found":
            raise _fail(e)
    # A starter title must match by name and year; otherwise its id was wrong, so look it up by name instead.
    if row and row["seeded"] and (not details or not omdb.looks_like(row, details)):
        details = None
        try:
            details = omdb.normalize_details(
                omdb.call({"t": row["title"], "y": str(row["year"]), "type": "series" if row["kind"] == "show" else "movie"})
            )
        except OmdbError as e:
            if e.kind != "not-found":
                raise _fail(e)
    if not details:
        if not row:
            raise HttpError(404, "Title not found")
        run("UPDATE titles SET fetched_at = ? WHERE id = ?", now(), id_)  # remember the miss
        return id_
    if row and row["seeded"] and details["id"] != id_:
        remap(id_, details["id"])
    save_details(details, row["created_by"] if row else None)
    return details["id"]


# ---------- search ----------

def _save_search(q, kind, ids, total, user_id):
    run(
        """INSERT INTO search_cache (query, kind, page, ids, total, fetched_at, searched_by, hits) VALUES (?, ?, 1, ?, ?, ?, ?, 0)
     ON CONFLICT(query, kind, page) DO UPDATE SET ids = excluded.ids, total = excluded.total, fetched_at = excluded.fetched_at""",
        q, kind, json.dumps(ids), total, now(), user_id,
    )


def search(raw_query, kind, user_id=None, allow_omdb=True):
    q = re.sub(r"\s+", " ", str(raw_query).strip().lower())[:80]
    out = {"results": [], "source": "database", "omdb": "skipped", "added": 0}
    if len(q) < 3:
        out["results"] = [to_json(r) for r in search_local(q, kind)]
        return out

    cached = one("SELECT * FROM search_cache WHERE query = ? AND kind = ? AND page = 1", q, kind)
    ids = []
    if cached and now() - cached["fetched_at"] < SEARCH_TTL:
        ids = json.loads(cached["ids"])
        out["omdb"] = "cached"
        run("UPDATE search_cache SET hits = hits + 1 WHERE query = ? AND kind = ? AND page = 1", q, kind)
    elif not omdb.configured():
        out["omdb"] = "unconfigured"
        if cached:
            ids = json.loads(cached["ids"])
    elif not allow_omdb:
        out["omdb"] = "throttled"
        if cached:
            ids = json.loads(cached["ids"])
    else:
        try:
            params = {"s": q, "page": "1"}
            if kind != "all":
                params["type"] = "series" if kind == "show" else "movie"
            body = omdb.call(params)
            items = [omdb.normalize_search_item(r) for r in body.get("Search", []) if r.get("Type") in ("movie", "series")]
            out["added"] = upsert_basic(items, user_id)
            ids = [i["id"] for i in items]
            try:
                total = int(body.get("totalResults"))
            except (TypeError, ValueError):
                total = len(ids)
            _save_search(q, kind, ids, total or len(ids), user_id)
            out["source"] = "omdb"
            out["omdb"] = "ok"
        except OmdbError as e:
            if e.kind == "not-found":
                _save_search(q, kind, [], 0, user_id)  # remember that nothing matched
                out["omdb"] = "ok"
            else:
                out["omdb"] = e.kind
                if cached:
                    ids = json.loads(cached["ids"])

    # Answers from OMDb first, then anything already in our catalogue whose name contains the search.
    rows = rows_by_ids(ids)
    seen = {r["id"] for r in rows}
    for r in search_local(q, kind):
        if r["id"] not in seen:
            rows.append(r)
    out["results"] = [to_json(r) for r in rows[:40]]
    return out


# ---------- one title with everyone's reviews ----------

REVIEW_LIMIT = 50


def reviews_for(title_id):
    where = "e.title_id = ? AND (e.rating IS NOT NULL OR (e.review IS NOT NULL AND e.review <> ''))"
    rows = many(
        f"""SELECT e.rating, e.review, e.status, e.updated_at AS updatedAt, u.handle, u.name
       FROM library_entries e JOIN users u ON u.id = e.user_id
       WHERE {where} ORDER BY e.updated_at DESC LIMIT {REVIEW_LIMIT}""",
        title_id,
    )
    reviews = [
        {"rating": r["rating"] or 0, "review": r["review"] or "", "status": r["status"], "updatedAt": r["updatedAt"], "user": {"handle": r["handle"], "name": r["name"]}}
        for r in rows
    ]
    total = int(scalar(f"SELECT COUNT(*) FROM library_entries e WHERE {where}", title_id))
    return {"reviews": reviews, "reviewTotal": total}


def get_title_full(raw_id, viewer):
    id_ = resolve_id(raw_id)
    if not is_imdb_id(id_):
        raise HttpError(404, "Title not found")
    degraded = None
    try:
        id_ = ensure_detailed(id_, viewer["id"] if viewer else None)
    except HttpError as e:
        if not row_by_id(id_):
            raise
        degraded = e.extra.get("omdb") or "unavailable"  # show what we already have
    row = row_by_id(id_)
    if not row:
        raise HttpError(404, "Title not found")
    return {"title": to_json(row), **reviews_for(id_), "mine": entry_for(viewer["id"], id_) if viewer else None, "degraded": degraded}


# ---------- a user's own entries ----------

def entry_json(e):
    return {
        "status": e["status"],
        "rating": e["rating"] or 0,
        "review": e["review"] or "",
        "timesWatched": (e["times_watched"] if e["times_watched"] is not None else 1) if e["status"] == "watched" else 0,
        "addedAt": e["added_at"],
        "updatedAt": e["updated_at"],
    }


def entry_for(user_id, title_id):
    e = one("SELECT * FROM library_entries WHERE user_id = ? AND title_id = ?", user_id, title_id)
    return entry_json(e) if e else None


def _as_int(v):
    """JSON numbers like 3 and 3.0 both count as whole numbers (as they do in JavaScript)."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return None


def put_entry(user_id, raw_title_id, patch):
    title_id = resolve_id(raw_title_id)
    if not row_by_id(title_id):
        raise HttpError(404, "Title not found")
    cur = one("SELECT * FROM library_entries WHERE user_id = ? AND title_id = ?", user_id, title_id)

    status = patch.get("status", (cur or {}).get("status") or "watchlist")
    if status not in ("watchlist", "watched"):
        raise HttpError(400, "Status must be watchlist or watched")

    rating = patch["rating"] if "rating" in patch else (cur or {}).get("rating")
    if rating in (0, "", None) and not isinstance(rating, bool):
        rating = None
    else:
        n = _as_int(rating)
        if n is None or n < 1 or n > 5:
            raise HttpError(400, "Rating must be 1 to 5 stars")
        rating = n

    review = patch["review"] if "review" in patch else (cur or {}).get("review")
    if review is not None:
        if not isinstance(review, str):
            raise HttpError(400, "Comment must be text")
        review = review.strip()
        if len(review) > 2000:
            raise HttpError(400, "Comments can be up to 2000 characters")
        if not review:
            review = None
    if rating is not None and status == "watchlist":
        status = "watched"  # rating something means you have seen it

    # How many times they have watched it (only for watched titles).
    if "timesWatched" in patch:
        times = _as_int(patch["timesWatched"])
        if times is None or times < 1 or times > 999:
            raise HttpError(400, "Times watched must be 1 to 999")
    else:
        times = cur["times_watched"] if cur and cur["status"] == "watched" else 1
    if times is None:
        times = 1
    if status != "watched":
        times = 1

    t = now()
    added = cur["added_at"] if cur else t
    run(
        """INSERT INTO library_entries (user_id, title_id, status, rating, review, times_watched, added_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, title_id) DO UPDATE SET status = excluded.status, rating = excluded.rating, review = excluded.review,
       times_watched = excluded.times_watched, updated_at = excluded.updated_at""",
        user_id, title_id, status, rating, review, times, added, t,
    )
    entry = entry_json({"status": status, "rating": rating, "review": review, "times_watched": times, "added_at": added, "updated_at": t})
    return {"entry": entry, "title": to_json(row_by_id(title_id))}


def delete_entry(user_id, raw_title_id):
    title_id = resolve_id(raw_title_id)
    run("DELETE FROM library_entries WHERE user_id = ? AND title_id = ?", user_id, title_id)
    row = row_by_id(title_id)
    return {"title": to_json(row) if row else None}


def library_for(user_id, status=None):
    extra = SELECT.replace(
        "SELECT t.*,",
        "SELECT t.*, e.status AS e_status, e.rating AS e_rating, e.review AS e_review, e.times_watched AS e_times, e.added_at AS e_added, e.updated_at AS e_updated,",
        1,
    )
    rows = many(
        f"""{extra}
       JOIN library_entries e ON e.title_id = t.id AND e.user_id = ? {'AND e.status = ?' if status else ''}
       ORDER BY e.updated_at DESC LIMIT 500""",
        user_id, *([status] if status else []),
    )
    return [
        {
            "title": to_json(r),
            "entry": entry_json({"status": r["e_status"], "rating": r["e_rating"], "review": r["e_review"], "times_watched": r["e_times"], "added_at": r["e_added"], "updated_at": r["e_updated"]}),
        }
        for r in rows
    ]


# ---------- startup ----------

def prune_old_searches():
    """Stored searches older than 90 days are dropped; the next person who searches them gets a fresh answer."""
    run("DELETE FROM search_cache WHERE fetched_at < ?", now() - 90 * 864e5)


def warm_starter_titles():
    """Fill in the starter titles' details once (later starts skip them because they are stored)."""
    if not omdb.configured():
        return
    for r in many("SELECT id FROM titles WHERE seeded = 1 AND detail_level = 0"):
        try:
            ensure_detailed(r["id"])
        except HttpError as e:
            if e.extra.get("omdb") in ("denied", "unconfigured"):
                return
        except Exception as e:  # keep warming the others
            print("[warm]", e, flush=True)
        time.sleep(0.15)

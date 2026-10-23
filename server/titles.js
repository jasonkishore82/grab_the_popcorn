// The shared catalogue: every title anyone looks up is stored once, with everyone's ratings and comments.
import { db, now, tx } from './db.js';
import { TITLES, canonicalId, isImdbId } from '../src/data.js';
import { HttpError } from './http.js';
import { OmdbError, looksLike, normalizeDetails, normalizeSearchItem, omdbCall, omdbConfigured } from './omdb.js';

const SEARCH_TTL = 30 * 864e5; // a stored search is reused for 30 days
const RETRY_AFTER = 864e5; // after a failed details lookup, wait a day before asking OMDb again

// ---------- reading titles ----------

const STATS = `LEFT JOIN (
  SELECT title_id,
         COUNT(rating) AS rating_count,
         AVG(rating) AS rating_avg,
         SUM(CASE WHEN review IS NOT NULL AND review <> '' THEN 1 ELSE 0 END) AS review_count,
         SUM(status = 'watched') AS watched,
         SUM(status = 'watchlist') AS watchlist
  FROM library_entries GROUP BY title_id
) s ON s.title_id = t.id`;

const SELECT = `SELECT t.*, COALESCE(s.rating_count, 0) AS rating_count, s.rating_avg,
  COALESCE(s.review_count, 0) AS review_count, COALESCE(s.watched, 0) AS watched, COALESCE(s.watchlist, 0) AS watchlist
  FROM titles t ${STATS}`;

export function toJson(r) {
  return {
    id: r.id,
    type: r.kind,
    title: r.title,
    year: r.year,
    poster: r.poster,
    plot: r.plot,
    rated: r.rated,
    released: r.released,
    runtime: r.runtime,
    genres: JSON.parse(r.genres),
    director: r.director,
    writer: r.writer,
    actors: JSON.parse(r.actors),
    language: r.language,
    country: r.country,
    awards: r.awards,
    rt: r.rt,
    imdb: r.imdb,
    imdbVotes: r.imdb_votes,
    meta: r.meta,
    seasons: r.seasons,
    detailed: r.detail_level > 0,
    seeded: Boolean(r.seeded),
    addedAt: r.created_at,
    stats: {
      ratingCount: Number(r.rating_count),
      ratingAvg: r.rating_avg == null ? null : Math.round(r.rating_avg * 10) / 10,
      reviewCount: Number(r.review_count),
      watched: Number(r.watched),
      watchlist: Number(r.watchlist),
    },
  };
}

export const resolveId = (raw) => {
  const id = canonicalId(String(raw));
  return db.prepare('SELECT new_id FROM id_aliases WHERE old_id = ?').get(id)?.new_id ?? id;
};
const rowById = (id) => db.prepare(`${SELECT} WHERE t.id = ?`).get(id);

function rowsByIds(ids) {
  if (!ids.length) return [];
  const rows = db.prepare(`${SELECT} WHERE t.id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export const idAliases = () => Object.fromEntries(db.prepare('SELECT old_id, new_id FROM id_aliases').all().map((r) => [r.old_id, r.new_id]));

export const catalog = (limit = 200, offset = 0) =>
  db
    .prepare(`${SELECT} ORDER BY t.seeded DESC, t.created_at DESC, t.title LIMIT ? OFFSET ?`)
    .all(Math.min(Math.max(limit, 1), 300), Math.max(offset, 0))
    .map(toJson);

function searchLocal(q, kind, limit = 40) {
  const like = (s) => s.replace(/[\\%_]/g, '\\$&');
  const rows = db
    .prepare(
      `${SELECT} WHERE t.title LIKE ? ESCAPE '\\' ${kind === 'all' ? '' : 'AND t.kind = ?'}
       ORDER BY (t.title LIKE ? ESCAPE '\\') DESC, COALESCE(s.rating_count, 0) DESC, t.year DESC LIMIT ?`,
    )
    .all(`%${like(q)}%`, ...(kind === 'all' ? [] : [kind]), `${like(q)}%`, limit);
  return rows;
}

// ---------- writing titles ----------

function upsertBasic(items, userId) {
  const exists = db.prepare('SELECT 1 FROM titles WHERE id = ?');
  const insert = db.prepare(
    'INSERT INTO titles (id, kind, title, year, poster, detail_level, seeded, created_by, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)',
  );
  const fillPoster = db.prepare('UPDATE titles SET poster = ? WHERE id = ? AND poster IS NULL');
  let added = 0;
  tx(() => {
    for (const it of items) {
      if (!isImdbId(it.id)) continue;
      if (exists.get(it.id)) {
        if (it.poster) fillPoster.run(it.poster, it.id);
      } else {
        insert.run(it.id, it.kind, it.title, it.year, it.poster, userId, now());
        added += 1;
      }
    }
  });
  return added;
}

function saveDetails(d, userId) {
  db.prepare(
    `INSERT INTO titles (id, kind, title, year, poster, plot, rated, released, runtime, genres, director, writer, actors, language, country, awards,
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
       detail_level = 1, fetched_at = excluded.fetched_at`,
  ).run(
    d.id, d.kind, d.title, d.year, d.poster, d.plot, d.rated, d.released, d.runtime, JSON.stringify(d.genres), d.director, d.writer,
    JSON.stringify(d.actors), d.language, d.country, d.awards, d.rt, d.imdb, d.imdbVotes, d.meta, d.seasons, userId, now(), now(),
  );
}

// A starter title whose IMDb id was wrong moves to the right id; people's entries move with it.
function remap(oldId, newId) {
  tx(() => {
    if (!db.prepare('SELECT 1 FROM titles WHERE id = ?').get(newId)) {
      db.prepare('UPDATE titles SET id = ? WHERE id = ?').run(newId, oldId); // cascades to library_entries
    } else {
      db.prepare('UPDATE OR IGNORE library_entries SET title_id = ? WHERE title_id = ?').run(newId, oldId);
      db.prepare('DELETE FROM titles WHERE id = ?').run(oldId);
    }
    db.prepare('INSERT OR REPLACE INTO id_aliases (old_id, new_id) VALUES (?, ?)').run(oldId, newId);
  });
}

export function seedStarterTitles() {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO titles (id, kind, title, year, plot, runtime, genres, detail_level, seeded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
  );
  const moved = db.prepare('SELECT 1 FROM id_aliases WHERE old_id = ?');
  tx(() => {
    for (const t of TITLES) {
      if (!moved.get(t.id)) insert.run(t.id, t.type, t.title, t.year, t.synopsis, t.runtime ?? null, JSON.stringify(t.genres), now());
    }
  });
}

// ---------- full details, fetched from OMDb once and kept ----------

const fail = (e) => {
  if (!(e instanceof OmdbError)) return e;
  const status = { unconfigured: 503, denied: 502, unavailable: 502, 'not-found': 404 }[e.kind] || 502;
  return new HttpError(status, e.kind === 'not-found' ? 'Title not found' : e.message, { omdb: e.kind });
};

const inflight = new Map();

// Make sure a title has its full details stored. Resolves to the title's id (it can change for a wrong starter id).
export function ensureDetailed(rawId, userId = null) {
  const id = resolveId(rawId);
  const row = rowById(id);
  if (row && row.detail_level > 0) return Promise.resolve(id);
  if (!omdbConfigured()) {
    return row ? Promise.resolve(id) : Promise.reject(new HttpError(503, 'OMDb is not set up, so new titles cannot be looked up', { omdb: 'unconfigured' }));
  }
  if (row?.fetched_at && now() - row.fetched_at < RETRY_AFTER) return Promise.resolve(id); // we already tried recently
  if (inflight.has(id)) return inflight.get(id);

  const job = (async () => {
    try {
      return await loadFromOmdb(id, row);
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, job);
  return job;
}

async function loadFromOmdb(id, row) {
  const userId = null;
  let details = null;
  try {
    details = normalizeDetails(await omdbCall({ i: id }));
  } catch (e) {
    if (!(e instanceof OmdbError) || e.kind !== 'not-found') throw fail(e);
  }
  // A starter title must match by name and year; otherwise its id was wrong, so look it up by name instead.
  if (row?.seeded && (!details || !looksLike(row, details))) {
    details = null;
    try {
      details = normalizeDetails(await omdbCall({ t: row.title, y: String(row.year), type: row.kind === 'show' ? 'series' : 'movie' }));
    } catch (e) {
      if (!(e instanceof OmdbError) || e.kind !== 'not-found') throw fail(e);
    }
  }
  if (!details) {
    if (!row) throw new HttpError(404, 'Title not found');
    db.prepare('UPDATE titles SET fetched_at = ? WHERE id = ?').run(now(), id); // remember the miss
    return id;
  }
  if (row?.seeded && details.id !== id) remap(id, details.id);
  saveDetails(details, row ? row.created_by : userId);
  return details.id;
}

// ---------- search ----------

export async function search(rawQuery, kind, { userId = null, allowOmdb = true } = {}) {
  const q = String(rawQuery).trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
  const out = { results: [], source: 'database', omdb: 'skipped', added: 0 };
  if (q.length < 3) {
    out.results = searchLocal(q, kind).map(toJson);
    return out;
  }

  const cached = db.prepare('SELECT * FROM search_cache WHERE query = ? AND kind = ? AND page = 1').get(q, kind);
  let ids = [];
  if (cached && now() - cached.fetched_at < SEARCH_TTL) {
    ids = JSON.parse(cached.ids);
    out.omdb = 'cached';
    db.prepare('UPDATE search_cache SET hits = hits + 1 WHERE query = ? AND kind = ? AND page = 1').run(q, kind);
  } else if (!omdbConfigured()) {
    out.omdb = 'unconfigured';
    if (cached) ids = JSON.parse(cached.ids);
  } else if (!allowOmdb) {
    out.omdb = 'throttled';
    if (cached) ids = JSON.parse(cached.ids);
  } else {
    try {
      const params = { s: q, page: '1' };
      if (kind !== 'all') params.type = kind === 'show' ? 'series' : 'movie';
      const body = await omdbCall(params);
      const items = (body.Search || []).filter((r) => r.Type === 'movie' || r.Type === 'series').map(normalizeSearchItem);
      out.added = upsertBasic(items, userId);
      ids = items.map((i) => i.id);
      saveSearch(q, kind, ids, Number(body.totalResults) || ids.length, userId);
      out.source = 'omdb';
      out.omdb = 'ok';
    } catch (e) {
      if (e instanceof OmdbError && e.kind === 'not-found') {
        saveSearch(q, kind, [], 0, userId); // remember that nothing matched
        out.omdb = 'ok';
      } else {
        out.omdb = e instanceof OmdbError ? e.kind : 'unavailable';
        if (cached) ids = JSON.parse(cached.ids);
      }
    }
  }

  // Answers from OMDb first, then anything already in our catalogue whose name contains the search.
  const rows = rowsByIds(ids);
  const seen = new Set(rows.map((r) => r.id));
  for (const r of searchLocal(q, kind)) if (!seen.has(r.id)) rows.push(r);
  out.results = rows.slice(0, 40).map(toJson);
  return out;
}

function saveSearch(q, kind, ids, total, userId) {
  db.prepare(
    `INSERT INTO search_cache (query, kind, page, ids, total, fetched_at, searched_by, hits) VALUES (?, ?, 1, ?, ?, ?, ?, 0)
     ON CONFLICT(query, kind, page) DO UPDATE SET ids = excluded.ids, total = excluded.total, fetched_at = excluded.fetched_at`,
  ).run(q, kind, JSON.stringify(ids), total, now(), userId);
}

// ---------- one title with everyone's reviews ----------

const REVIEW_LIMIT = 50;

export function reviewsFor(titleId) {
  const where = `e.title_id = ? AND (e.rating IS NOT NULL OR (e.review IS NOT NULL AND e.review <> ''))`;
  const rows = db
    .prepare(
      `SELECT e.rating, e.review, e.status, e.updated_at AS updatedAt, u.handle, u.name
       FROM library_entries e JOIN users u ON u.id = e.user_id
       WHERE ${where} ORDER BY e.updated_at DESC LIMIT ${REVIEW_LIMIT}`,
    )
    .all(titleId)
    .map((r) => ({ rating: r.rating ?? 0, review: r.review ?? '', status: r.status, updatedAt: r.updatedAt, user: { handle: r.handle, name: r.name } }));
  const total = Number(db.prepare(`SELECT COUNT(*) AS n FROM library_entries e WHERE ${where}`).get(titleId).n);
  return { reviews: rows, reviewTotal: total };
}

export async function getTitleFull(rawId, viewer) {
  let id = resolveId(rawId);
  if (!isImdbId(id)) throw new HttpError(404, 'Title not found');
  let degraded = null;
  try {
    id = await ensureDetailed(id, viewer?.id ?? null);
  } catch (e) {
    if (!rowById(id)) throw e;
    degraded = e.extra?.omdb || 'unavailable'; // show what we already have
  }
  const row = rowById(id);
  if (!row) throw new HttpError(404, 'Title not found');
  return { title: toJson(row), ...reviewsFor(id), mine: viewer ? entryFor(viewer.id, id) : null, degraded };
}

// ---------- a user's own entries ----------

const entryJson = (e) => ({ status: e.status, rating: e.rating ?? 0, review: e.review ?? '', timesWatched: e.status === 'watched' ? e.times_watched ?? 1 : 0, addedAt: e.added_at, updatedAt: e.updated_at });

export function entryFor(userId, titleId) {
  const e = db.prepare('SELECT * FROM library_entries WHERE user_id = ? AND title_id = ?').get(userId, titleId);
  return e ? entryJson(e) : null;
}

export function putEntry(userId, rawTitleId, patch) {
  const titleId = resolveId(rawTitleId);
  if (!rowById(titleId)) throw new HttpError(404, 'Title not found');
  const cur = db.prepare('SELECT * FROM library_entries WHERE user_id = ? AND title_id = ?').get(userId, titleId);

  let status = patch.status ?? cur?.status ?? 'watchlist';
  if (status !== 'watchlist' && status !== 'watched') throw new HttpError(400, 'Status must be watchlist or watched');

  let rating = patch.rating === undefined ? cur?.rating ?? null : patch.rating;
  if (rating === 0 || rating === '' || rating === null) rating = null;
  else if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be 1 to 5 stars');

  let review = patch.review === undefined ? cur?.review ?? null : patch.review;
  if (review !== null) {
    if (typeof review !== 'string') throw new HttpError(400, 'Comment must be text');
    review = review.trim();
    if (review.length > 2000) throw new HttpError(400, 'Comments can be up to 2000 characters');
    if (!review) review = null;
  }
  if (rating !== null && status === 'watchlist') status = 'watched'; // rating something means you have seen it

  // How many times they have watched it (only for watched titles).
  let times = patch.timesWatched === undefined ? (cur?.status === 'watched' ? cur.times_watched : 1) : patch.timesWatched;
  if (!Number.isInteger(times) || times < 1 || times > 999) {
    if (patch.timesWatched !== undefined) throw new HttpError(400, 'Times watched must be 1 to 999');
    times = 1;
  }
  if (status !== 'watched') times = 1;

  const t = now();
  db.prepare(
    `INSERT INTO library_entries (user_id, title_id, status, rating, review, times_watched, added_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, title_id) DO UPDATE SET status = excluded.status, rating = excluded.rating, review = excluded.review,
       times_watched = excluded.times_watched, updated_at = excluded.updated_at`,
  ).run(userId, titleId, status, rating, review, times, cur?.added_at ?? t, t);
  return { entry: entryJson({ status, rating, review, times_watched: times, added_at: cur?.added_at ?? t, updated_at: t }), title: toJson(rowById(titleId)) };
}

export function deleteEntry(userId, rawTitleId) {
  const titleId = resolveId(rawTitleId);
  db.prepare('DELETE FROM library_entries WHERE user_id = ? AND title_id = ?').run(userId, titleId);
  const row = rowById(titleId);
  return { title: row ? toJson(row) : null };
}

export function libraryFor(userId, status = null) {
  const rows = db
    .prepare(
      `${SELECT.replace('SELECT t.*,', 'SELECT t.*, e.status AS e_status, e.rating AS e_rating, e.review AS e_review, e.times_watched AS e_times, e.added_at AS e_added, e.updated_at AS e_updated,')}
       JOIN library_entries e ON e.title_id = t.id AND e.user_id = ? ${status ? 'AND e.status = ?' : ''}
       ORDER BY e.updated_at DESC LIMIT 500`,
    )
    .all(userId, ...(status ? [status] : []));
  return rows.map((r) => ({
    title: toJson(r),
    entry: entryJson({ status: r.e_status, rating: r.e_rating, review: r.e_review, times_watched: r.e_times, added_at: r.e_added, updated_at: r.e_updated }),
  }));
}

// ---------- startup ----------

// Stored searches older than 90 days are dropped; the next person who searches them gets a fresh answer.
export function pruneOldSearches() {
  db.prepare('DELETE FROM search_cache WHERE fetched_at < ?').run(now() - 90 * 864e5);
}

// Fill in the starter titles' details once (later starts skip them because they are stored).
export async function warmStarterTitles() {
  if (!omdbConfigured()) return;
  const ids = db.prepare('SELECT id FROM titles WHERE seeded = 1 AND detail_level = 0').all().map((r) => r.id);
  for (const id of ids) {
    try {
      await ensureDetailed(id);
    } catch (e) {
      if (e.extra?.omdb === 'denied' || e.extra?.omdb === 'unconfigured') return;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

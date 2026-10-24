// OMDb access for the server. The key stays here; the browser never talks to OMDb.
// https://www.omdbapi.com/  (GET /?apikey=...&i=imdbID | t=title&y=year | s=search&page=n)
import './env.js';

export class OmdbError extends Error {
  // kind: 'unconfigured' | 'denied' | 'unavailable' | 'not-found'
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

export const omdbConfigured = () => Boolean(process.env.OMDB_API_KEY);
const base = () => process.env.OMDB_BASE_URL || 'https://www.omdbapi.com/';

export async function omdbCall(params) {
  const key = process.env.OMDB_API_KEY;
  if (!key) throw new OmdbError('unconfigured', 'OMDB_API_KEY is not set on the server');

  let res;
  let body;
  try {
    res = await fetch(`${base()}?${new URLSearchParams(params)}&apikey=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(8000) });
    body = await res.json();
  } catch (err) {
    console.error('[omdb]', err?.name, err?.message);
    throw new OmdbError('unavailable', 'Could not reach OMDb');
  }
  // OMDb answers 401 for a bad key and when the daily limit is reached.
  if (res.status === 401) throw new OmdbError('denied', body?.Error || 'OMDb rejected the API key');
  if (!res.ok) throw new OmdbError('unavailable', 'OMDb is unavailable right now');
  if (body.Response === 'False') throw new OmdbError('not-found', body.Error || 'Not found'); // "Movie not found!", "Too many results.", ...
  return body;
}

const NA = (v) => (v && v !== 'N/A' ? v : null);
const list = (v) => (NA(v) ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

// OMDb's full record -> a row for our titles table.
export function normalizeDetails(d) {
  const rt = d.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value;
  const imdb = parseFloat(d.imdbRating);
  return {
    id: d.imdbID,
    kind: d.Type === 'series' ? 'show' : 'movie',
    title: d.Title,
    year: num(d.Year),
    poster: NA(d.Poster),
    plot: NA(d.Plot),
    rated: NA(d.Rated),
    released: NA(d.Released),
    runtime: num(d.Runtime),
    genres: list(d.Genre),
    director: NA(d.Director),
    writer: NA(d.Writer),
    actors: list(d.Actors),
    language: NA(d.Language),
    country: NA(d.Country),
    awards: NA(d.Awards),
    rt: rt ? num(rt) : null,
    imdb: Number.isFinite(imdb) ? imdb : null,
    imdbVotes: NA(d.imdbVotes),
    meta: num(d.Metascore),
    seasons: num(d.totalSeasons),
  };
}

// One entry of an OMDb search -> the basic fields we can store right away.
export const normalizeSearchItem = (r) => ({
  id: r.imdbID,
  kind: r.Type === 'series' ? 'show' : 'movie',
  title: r.Title,
  year: num(r.Year),
  poster: NA(r.Poster),
});

const strip = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Guard against a wrong IMDb id in the starter list: title and year must roughly agree.
export function looksLike(row, details) {
  const a = strip(row.title);
  const b = strip(details.title);
  const sameTitle = a === b || a.includes(b) || b.includes(a);
  const sameYear = !row.year || !details.year || Math.abs(row.year - details.year) <= 1;
  return sameTitle && sameYear;
}

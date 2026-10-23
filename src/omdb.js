// Browser side of OMDb: talks to our own /api/omdb route (the key stays on the server).

export class OmdbError extends Error {
  // kind: 'unconfigured' | 'denied' | 'unavailable' | 'not-found'
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

const NA = (v) => (v && v !== 'N/A' ? v : null);
const list = (v) => (NA(v) ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function call(params) {
  let res;
  try {
    res = await fetch(`/api/omdb?${new URLSearchParams(params)}`);
  } catch {
    throw new OmdbError('unavailable', 'Could not reach the server');
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) throw new OmdbError('unavailable', 'The OMDb route is not available here');
  const body = await res.json().catch(() => null);
  if (res.status === 503) throw new OmdbError('unconfigured', body?.Error || 'OMDB_API_KEY is not set');
  if (res.status === 401) throw new OmdbError('denied', body?.Error || 'OMDb rejected the API key');
  if (!res.ok || !body) throw new OmdbError('unavailable', body?.Error || 'OMDb is unavailable');
  if (body.Response === 'False') {
    // "Movie not found!", "Incorrect IMDb ID.", "Too many results." ... all mean "nothing to show"
    throw new OmdbError('not-found', body.Error || 'Not found');
  }
  return body;
}

// Turn OMDb's field names into the shape the app uses.
export function normalize(d) {
  const rt = d.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value;
  const imdb = parseFloat(d.imdbRating);
  const meta = parseInt(d.Metascore, 10);
  const runtime = parseInt(d.Runtime, 10);
  return {
    imdbID: d.imdbID,
    title: d.Title,
    year: parseInt(d.Year, 10) || null,
    type: d.Type === 'series' ? 'show' : 'movie',
    poster: NA(d.Poster),
    plot: NA(d.Plot),
    rated: NA(d.Rated),
    released: NA(d.Released),
    runtime: Number.isFinite(runtime) ? runtime : null, // minutes (per episode for series)
    genres: list(d.Genre),
    director: NA(d.Director),
    writer: NA(d.Writer),
    actors: list(d.Actors),
    language: NA(d.Language),
    country: NA(d.Country),
    awards: NA(d.Awards),
    rt: rt ? parseInt(rt, 10) : null,
    imdb: Number.isFinite(imdb) ? imdb : null,
    imdbVotes: NA(d.imdbVotes),
    meta: Number.isFinite(meta) ? meta : null,
    seasons: parseInt(d.totalSeasons, 10) || null,
    fetchedAt: Date.now(),
  };
}

// Guard against a wrong IMDb id in our catalog: the title and year must roughly agree.
function looksLike(title, d) {
  const a = norm(title.title);
  const b = norm(d.title);
  const sameTitle = a === b || a.includes(b) || b.includes(a);
  const sameYear = !title.year || !d.year || Math.abs(title.year - d.year) <= 1;
  return sameTitle && sameYear;
}

export async function fetchDetails(title) {
  const type = title.type === 'show' ? 'series' : 'movie';
  let lastError;

  if (title.imdb) {
    try {
      const d = normalize(await call({ i: title.imdb }));
      if (title.external || looksLike(title, d)) return d;
    } catch (e) {
      if (e.kind !== 'not-found') throw e;
      lastError = e;
    }
  }
  if (!title.external) {
    try {
      return normalize(await call({ t: title.title, y: String(title.year), type }));
    } catch (e) {
      if (e.kind !== 'not-found') throw e;
      lastError = e;
    }
  }
  throw lastError || new OmdbError('not-found', 'Not found');
}

export async function searchOmdb(q, kind = 'all', page = 1) {
  const params = { s: q, page: String(page) };
  if (kind === 'movie') params.type = 'movie';
  if (kind === 'show') params.type = 'series';
  try {
    const body = await call(params);
    const results = (body.Search || [])
      .filter((r) => r.Type === 'movie' || r.Type === 'series')
      .map((r) => ({
        imdb: r.imdbID,
        title: r.Title,
        year: parseInt(r.Year, 10) || null,
        type: r.Type === 'series' ? 'show' : 'movie',
        poster: NA(r.Poster),
      }));
    return { results, total: parseInt(body.totalResults, 10) || results.length };
  } catch (e) {
    if (e.kind === 'not-found') return { results: [], total: 0 };
    throw e;
  }
}

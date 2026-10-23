// Starter catalogue (seeded into the shared database) and sample people. IMDb ids are the title ids.
export const TITLES = [
  { id: 'tt15239678', runtime: 166, title: 'Dune: Part Two', year: 2024, type: 'movie', genres: ['Sci-Fi', 'Adventure'], hue: 32, synopsis: 'Paul Atreides unites with the Fremen while on a path of revenge against those who destroyed his family.' },
  { id: 'tt13238346', runtime: 106, title: 'Past Lives', year: 2023, type: 'movie', genres: ['Drama', 'Romance'], hue: 200, synopsis: 'Two childhood friends reunite in New York decades later and confront notions of love and destiny.' },
  { id: 'tt15398776', runtime: 180, title: 'Oppenheimer', year: 2023, type: 'movie', genres: ['Drama', 'History'], hue: 12, synopsis: 'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.' },
  { id: 'tt9362722', runtime: 140, title: 'Spider-Man: Across the Spider-Verse', year: 2023, type: 'movie', genres: ['Animation', 'Action'], hue: 330, synopsis: 'Miles Morales catapults across the Multiverse and meets a team of Spider-People.' },
  { id: 'tt6710474', runtime: 139, title: 'Everything Everywhere All at Once', year: 2022, type: 'movie', genres: ['Sci-Fi', 'Comedy'], hue: 280, synopsis: 'A laundromat owner is swept into an adventure across the multiverse.' },
  { id: 'tt6751668', runtime: 132, title: 'Parasite', year: 2019, type: 'movie', genres: ['Thriller', 'Drama'], hue: 140, synopsis: 'A poor family schemes to become employed by a wealthy household.' },
  { id: 'tt2278388', runtime: 100, title: 'The Grand Budapest Hotel', year: 2014, type: 'movie', genres: ['Comedy'], hue: 345, synopsis: 'A legendary concierge and his lobby boy get caught up in a theft and a murder.' },
  { id: 'tt0816692', runtime: 169, title: 'Interstellar', year: 2014, type: 'movie', genres: ['Sci-Fi', 'Drama'], hue: 220, synopsis: 'Explorers travel through a wormhole in search of a new home for humanity.' },
  { id: 'tt0245429', runtime: 125, title: 'Spirited Away', year: 2001, type: 'movie', genres: ['Animation', 'Fantasy'], hue: 170, synopsis: 'A girl wanders into a world ruled by gods, witches and spirits.' },
  { id: 'tt2582802', runtime: 107, title: 'Whiplash', year: 2014, type: 'movie', genres: ['Drama', 'Music'], hue: 45, synopsis: 'A young drummer is pushed to his limits by a ruthless instructor.' },
  { id: 'tt14452776', title: 'The Bear', year: 2022, type: 'show', genres: ['Drama', 'Comedy'], hue: 0, synopsis: 'A fine-dining chef returns home to run his family\'s sandwich shop.' },
  { id: 'tt11280740', title: 'Severance', year: 2022, type: 'show', genres: ['Thriller', 'Sci-Fi'], hue: 190, synopsis: 'Office workers have their work and personal memories surgically divided.' },
  { id: 'tt0903747', title: 'Breaking Bad', year: 2008, type: 'show', genres: ['Crime', 'Drama'], hue: 90, synopsis: 'A chemistry teacher turns to making meth to secure his family\'s future.' },
  { id: 'tt2788316', title: 'Shōgun', year: 2024, type: 'show', genres: ['Drama', 'History'], hue: 5, synopsis: 'An English navigator becomes entangled in a feudal Japanese power struggle.' },
  { id: 'tt5687612', title: 'Fleabag', year: 2016, type: 'show', genres: ['Comedy', 'Drama'], hue: 320, synopsis: 'A dry-witted woman navigates life and love in London.' },
  { id: 'tt11126994', title: 'Arcane', year: 2021, type: 'show', genres: ['Animation', 'Action'], hue: 260, synopsis: 'Two sisters end up on opposite sides of a war between rival cities.' },
];

export const USERS = [
  { id: 'u1', name: 'Maya Chen', handle: 'mayawatches', bio: 'A24 apologist. Will cry at anything.', favs: ['tt13238346', 'tt6710474', 'tt5687612'] },
  { id: 'u2', name: 'Leo Martins', handle: 'leoreels', bio: 'Nolan, Villeneuve, repeat.', favs: ['tt15239678', 'tt15398776', 'tt0816692'] },
  { id: 'u3', name: 'Priya Rao', handle: 'priyapopcorn', bio: 'Animation is cinema.', favs: ['tt9362722', 'tt0245429', 'tt11126994'] },
  { id: 'u4', name: 'Sam Okafor', handle: 'samseries', bio: 'Mostly TV. Mostly prestige.', favs: ['tt11280740', 'tt0903747', 'tt2788316'] },
  { id: 'u5', name: 'Ella Novak', handle: 'ellanoir', bio: 'Thrillers and slow burns.', favs: ['tt6751668', 'tt2582802', 'tt14452776'] },
];

export const REPLIES = [
  'Oh I loved that one!',
  'Still on my watchlist, no spoilers please.',
  'The ending though…',
  'Rewatch party this weekend?',
  'Honestly overrated, fight me.',
  'The soundtrack alone is a 10/10.',
];

// Old ids from earlier versions of the app (saved lists, chats, links) still work.
export const LEGACY = {m1: 'tt15239678', m2: 'tt13238346', m3: 'tt15398776', m4: 'tt9362722', m5: 'tt6710474', m6: 'tt6751668', m7: 'tt2278388', m8: 'tt0816692', m9: 'tt0245429', m10: 'tt2582802', s1: 'tt14452776', s2: 'tt11280740', s3: 'tt0903747', s4: 'tt2788316', s5: 'tt5687612', s6: 'tt11126994'};
// Starter titles whose IMDb id was corrected on the server: old id -> new id.
const ALIASES = {};
export const registerAliases = (map) => Object.assign(ALIASES, map);
export const canonicalId = (id) => {
  const base = LEGACY[id] ?? id;
  return ALIASES[base] ?? base;
};
export const isImdbId = (id) => /^tt\d{6,10}$/.test(id);

// Stable colour for generated poster art.
export const hueFor = (id) => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const SEED_HUE = Object.fromEntries(TITLES.map((t) => [t.id, t.hue]));

// The app's shape for a title (from the starter list or from the server).
export function shapeTitle(t) {
  return {
    ...t,
    synopsis: t.plot ?? t.synopsis ?? '',
    genres: t.genres ?? [],
    critics: t.rt ?? null,
    audience: null,
    hue: t.hue ?? SEED_HUE[t.id] ?? hueFor(t.id),
  };
}

// Every title the browser knows about. Starts with the starter list and fills in from the server.
const registry = new Map(TITLES.map((t) => [t.id, { ...shapeTitle(t), starter: true }]));

// Add or update titles. With `replaceStarters`, starter titles the server no longer has are dropped.
export function registerTitles(list, { replaceStarters = false } = {}) {
  for (const t of list) {
    registry.set(t.id, { ...shapeTitle(t), starter: false });
  }
  if (replaceStarters) {
    const keep = new Set(list.map((t) => t.id));
    for (const [id, t] of registry) if (t.starter && !keep.has(id)) registry.delete(id);
  }
}
export const getTitle = (id) => registry.get(canonicalId(id));
export const allTitles = () => [...registry.values()];

export const getUser = (id) => USERS.find((u) => u.id === id);

export const runtimeLabel = (t) => (!t.runtime ? '' : t.type === 'show' ? `${t.runtime} min episodes` : `${Math.floor(t.runtime / 60)}h ${t.runtime % 60}m`);
export const kindLabel = (t) => (t.type === 'show' ? 'Series' : 'Film');

export function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const units = [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [u, n] of units) if (s >= n) return `${Math.floor(s / n)}${u} ago`;
  return 'just now';
}
